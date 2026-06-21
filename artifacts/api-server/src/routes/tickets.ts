import { Router, type IRouter } from 'express';
import {
  db,
  ticketsTable,
  customersTable,
  sitesTable,
  servicesTable,
  usersTable,
  ticketUpdatesTable,
  slaPoliciesTable,
} from '@workspace/db';
import { eq, and, ilike, or, desc, asc, lt, inArray } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { summarizeTicket, normalizeStatus, generateCustomerUpdate } from '../lib/ai';
import { calculateSeverity, type ImpactLevel, type UrgencyLevel } from '../lib/severity';
import { evaluateEscalation } from '../lib/notificationEngine';
import { resolveMatrixCellForTicket } from '../lib/matrixResolver';

const router: IRouter = Router();

async function getNextTicketNumber(): Promise<string> {
  const allNumbers = await db
    .select({ ticketNumber: ticketsTable.ticketNumber })
    .from(ticketsTable);

  if (allNumbers.length === 0) return 'SA-1001';

  let max = 1000;
  for (const row of allNumbers) {
    const match = row.ticketNumber.match(/SA-(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `SA-${max + 1}`;
}

async function enrichTickets(tickets: (typeof ticketsTable.$inferSelect)[]) {
  if (tickets.length === 0) return [];

  const customerIds = [...new Set(tickets.map((t) => t.customerId))];
  const siteIds = [...new Set(tickets.map((t) => t.siteId).filter(Boolean) as string[])];
  const serviceIds = [...new Set(tickets.map((t) => t.serviceId).filter(Boolean) as string[])];
  const assignedIds = [
    ...new Set(tickets.map((t) => t.assignedToUserId).filter(Boolean) as string[]),
  ];

  const [customers, sites, services, users] = await Promise.all([
    customerIds.length
      ? db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
      : [],
    siteIds.length ? db.select().from(sitesTable).where(inArray(sitesTable.id, siteIds)) : [],
    serviceIds.length
      ? db.select().from(servicesTable).where(inArray(servicesTable.id, serviceIds))
      : [],
    assignedIds.length
      ? db.select().from(usersTable).where(inArray(usersTable.id, assignedIds))
      : [],
  ]);

  return tickets.map((ticket) => ({
    ...ticket,
    customer: customers.find((c: typeof customersTable.$inferSelect) => c.id === ticket.customerId) ?? null,
    site: sites.find((s: typeof sitesTable.$inferSelect) => s.id === ticket.siteId) ?? null,
    service: services.find((s: typeof servicesTable.$inferSelect) => s.id === ticket.serviceId) ?? null,
    assignedTo: users.find((u: typeof usersTable.$inferSelect) => u.id === ticket.assignedToUserId) ?? null,
  }));
}

router.get('/tickets', requireAuth, async (req, res): Promise<void> => {
  const { search, status, severity, customerId, siteId, vendorName, sortBy, sortOrder } =
    req.query as Record<string, string>;
  const conditions = [];

  if (req.user?.role === 'customer' && req.user.customerId) {
    conditions.push(eq(ticketsTable.customerId, req.user.customerId));
  } else if (req.user?.role === 'telecom_services_partner') {
    const pIds = req.partnerCustomerIds ?? [];
    if (pIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(ticketsTable.customerId, pIds));
  } else if (customerId) {
    conditions.push(eq(ticketsTable.customerId, customerId));
  }

  if (siteId) conditions.push(eq(ticketsTable.siteId, siteId));
  if (status)
    conditions.push(
      eq(
        ticketsTable.status,
        status as
          | 'new'
          | 'investigating'
          | 'vendor_engaged'
          | 'dispatch_scheduled'
          | 'monitoring'
          | 'resolved'
          | 'closed',
      ),
    );
  if (severity)
    conditions.push(eq(ticketsTable.severity, severity as 'low' | 'medium' | 'high' | 'critical'));
  if (search) {
    conditions.push(
      or(
        ilike(ticketsTable.title, `%${search}%`),
        ilike(ticketsTable.ticketNumber, `%${search}%`),
        ilike(ticketsTable.vendorTicketId, `%${search}%`),
      ),
    );
  }

  const orderCol =
    sortBy === 'nextEscalationAt' ? ticketsTable.nextEscalationAt : ticketsTable.openedAt;
  const order = sortOrder === 'asc' ? asc(orderCol) : desc(orderCol);

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(order);

  const enriched = await enrichTickets(tickets);
  res.json(enriched);
});

router.post('/tickets', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const {
    customerId,
    siteId,
    serviceId,
    title,
    description,
    source,
    outageType,
    vendorTicketId,
    assignedToUserId,
  } = req.body;
  let { severity, impactLevel, urgencyLevel } = req.body;

  if (impactLevel && urgencyLevel && customerId) {
    const resolved = await resolveMatrixCellForTicket(
      { customerId, siteId: siteId ?? null, serviceId: serviceId ?? null },
      impactLevel as ImpactLevel,
      urgencyLevel as UrgencyLevel,
    );
    severity = resolved.severity;
  } else if (impactLevel && urgencyLevel) {
    severity = calculateSeverity(impactLevel as ImpactLevel, urgencyLevel as UrgencyLevel);
  }

  if (!customerId || !title || !source || !severity || !outageType) {
    res.status(400).json({ error: 'Bad Request', message: 'Required fields missing' });
    return;
  }

  const status = req.body.status || 'new';
  const ticketNumber = await getNextTicketNumber();

  let nextEscalationAt: Date | undefined;
  let slaTargetMinutes: number | undefined;

  const [slaPolicy] = await db
    .select()
    .from(slaPoliciesTable)
    .where(and(eq(slaPoliciesTable.severity, severity), eq(slaPoliciesTable.isDefault, true)));

  if (slaPolicy) {
    slaTargetMinutes = slaPolicy.resolutionTargetMinutes;
    nextEscalationAt = new Date(Date.now() + slaPolicy.escalationMinutes * 60 * 1000);
  }

  const [ticket] = await db
    .insert(ticketsTable)
    .values({
      ticketNumber,
      customerId,
      siteId: siteId || null,
      serviceId: serviceId || null,
      title,
      description,
      source,
      severity,
      status,
      outageType,
      impactLevel: impactLevel || null,
      urgencyLevel: urgencyLevel || null,
      vendorTicketId: vendorTicketId || null,
      assignedToUserId: assignedToUserId || null,
      nextEscalationAt,
      slaTargetMinutes,
    })
    .returning();

  if (req.user?.id) {
    const severityNote =
      impactLevel && urgencyLevel
        ? ` | Impact: ${impactLevel}, Urgency: ${urgencyLevel} → Severity: ${severity}`
        : ` | Severity: ${severity}`;
    await db.insert(ticketUpdatesTable).values({
      ticketId: ticket.id,
      updateType: 'system_event',
      rawText: `Ticket ${ticketNumber} created by ${req.user.name}${severityNote}`,
      visibility: 'internal',
      createdByUserId: req.user.id,
    });
  }

  evaluateEscalation(ticket).catch(() => {});

  res.status(201).json(ticket);
});

router.get('/tickets/:id', requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  if (req.user?.role === 'customer' && req.user.customerId !== ticket.customerId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (
    req.user?.role === 'telecom_services_partner' &&
    !(req.partnerCustomerIds ?? []).includes(ticket.customerId)
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, ticket.customerId));
  const [site] = ticket.siteId
    ? await db.select().from(sitesTable).where(eq(sitesTable.id, ticket.siteId))
    : [null];
  const [service] = ticket.serviceId
    ? await db.select().from(servicesTable).where(eq(servicesTable.id, ticket.serviceId))
    : [null];
  const [assignedTo] = ticket.assignedToUserId
    ? await db.select().from(usersTable).where(eq(usersTable.id, ticket.assignedToUserId))
    : [null];

  let updates = await db
    .select()
    .from(ticketUpdatesTable)
    .where(eq(ticketUpdatesTable.ticketId, id))
    .orderBy(asc(ticketUpdatesTable.createdAt));

  if (req.user?.role === 'customer') {
    updates = updates.filter((u: typeof ticketUpdatesTable.$inferSelect) => u.visibility === 'customer');
  }

  const updateAuthorIds = [
    ...new Set(updates.map((u: typeof ticketUpdatesTable.$inferSelect) => u.createdByUserId).filter(Boolean) as string[]),
  ];
  const authors = updateAuthorIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, updateAuthorIds))
    : [];

  const updatesWithAuthors = updates.map((u: typeof ticketUpdatesTable.$inferSelect) => ({
    ...u,
    createdBy: authors.find((a: typeof usersTable.$inferSelect) => a.id === u.createdByUserId) ?? null,
  }));

  const { passwordHash: _1, ...safeCustomer } = customer ?? { passwordHash: undefined };
  const safeAssignedTo = assignedTo ? (({ passwordHash: _, ...rest }) => rest)(assignedTo) : null;

  res.json({
    ...ticket,
    customer: safeCustomer,
    site,
    service,
    assignedTo: safeAssignedTo,
    updates: updatesWithAuthors,
  });
});

router.put('/tickets/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  let { severity } = req.body;
  const {
    title,
    description,
    status,
    outageType,
    vendorTicketId,
    assignedToUserId,
    nextEscalationAt,
    slaTargetMinutes,
    aiSummary,
    aiNormalizedStatus,
    aiCustomerUpdate,
    impactLevel,
    urgencyLevel,
  } = req.body;

  if (impactLevel && urgencyLevel) {
    severity = calculateSeverity(impactLevel as ImpactLevel, urgencyLevel as UrgencyLevel);
  }

  const resolvedAt = status === 'resolved' || status === 'closed' ? new Date() : undefined;

  const [ticket] = await db
    .update(ticketsTable)
    .set({
      title,
      description,
      severity,
      status,
      outageType,
      impactLevel: impactLevel || undefined,
      urgencyLevel: urgencyLevel || undefined,
      vendorTicketId,
      assignedToUserId,
      nextEscalationAt: nextEscalationAt ? new Date(nextEscalationAt) : undefined,
      slaTargetMinutes,
      aiSummary,
      aiNormalizedStatus,
      aiCustomerUpdate,
      ...(resolvedAt ? { resolvedAt } : {}),
      lastUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(ticketsTable.id, id))
    .returning();

  if (!ticket) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json(ticket);
});

router.get('/tickets/:id/updates', requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  let updates = await db
    .select()
    .from(ticketUpdatesTable)
    .where(eq(ticketUpdatesTable.ticketId, id))
    .orderBy(asc(ticketUpdatesTable.createdAt));

  if (req.user?.role === 'customer') {
    updates = updates.filter((u: typeof ticketUpdatesTable.$inferSelect) => u.visibility === 'customer');
  }

  const authorIds = [...new Set(updates.map((u: typeof ticketUpdatesTable.$inferSelect) => u.createdByUserId).filter(Boolean) as string[])];
  const authors = authorIds.length
    ? await db.select().from(usersTable).where(inArray(usersTable.id, authorIds))
    : [];

  const result = updates.map((u: typeof ticketUpdatesTable.$inferSelect) => ({
    ...u,
    createdBy: authors.find((a: typeof usersTable.$inferSelect) => a.id === u.createdByUserId) ?? null,
  }));

  res.json(result);
});

router.post('/tickets/:id/updates', requireAuth, async (req, res): Promise<void> => {
  const ticketId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const { updateType, rawText, normalizedStatus, visibility } = req.body;
  if (!updateType || !rawText || !visibility) {
    res
      .status(400)
      .json({ error: 'Bad Request', message: 'updateType, rawText, and visibility are required' });
    return;
  }

  if (req.user?.role === 'customer' && visibility === 'internal') {
    res
      .status(403)
      .json({ error: 'Forbidden', message: 'Customer users cannot create internal notes' });
    return;
  }

  const [update] = await db
    .insert(ticketUpdatesTable)
    .values({
      ticketId,
      updateType,
      rawText,
      normalizedStatus,
      visibility,
      createdByUserId: req.user?.id ?? null,
    })
    .returning();

  await db
    .update(ticketsTable)
    .set({ lastUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(ticketsTable.id, ticketId));

  const [author] = req.user ? [req.user] : [];
  const safeAuthor = author ? (({ passwordHash: _, ...rest }) => rest)(author) : null;

  res.status(201).json({ ...update, createdBy: safeAuthor });
});

router.post('/tickets/:id/ai/summarize', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
  if (!ticket) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const updates = await db
    .select()
    .from(ticketUpdatesTable)
    .where(eq(ticketUpdatesTable.ticketId, id))
    .orderBy(asc(ticketUpdatesTable.createdAt));

  const service = ticket.serviceId
    ? (
        await db.select().from(servicesTable).where(eq(servicesTable.id, ticket.serviceId)).limit(1)
      )[0]
    : null;

  const now = new Date();
  const result = await summarizeTicket({
    title: ticket.title,
    severity: ticket.severity,
    status: ticket.status,
    outageType: ticket.outageType,
    description: ticket.description,
    vendorTicketId: ticket.vendorTicketId,
    circuitId: service?.circuitId ?? null,
    vendorName: service?.vendorName ?? null,
    updates,
  });

  const [updated] = await db
    .update(ticketsTable)
    .set({
      aiSummary: result.summary,
      aiConfidence: result.confidence,
      aiSummarizedAt: now,
      aiLastGeneratedAt: now,
      updatedAt: now,
    })
    .where(eq(ticketsTable.id, id))
    .returning();

  await db.insert(ticketUpdatesTable).values({
    ticketId: id,
    updateType: 'ai_generated',
    rawText: result.summary,
    aiSourceText: result.sourceText,
    visibility: 'internal',
    createdByUserId: req.user?.id ?? null,
  });

  res.json({
    summary: result.summary,
    confidence: result.confidence,
    keyDetails: result.keyDetails,
    ticket: updated,
  });
});

router.post(
  '/tickets/:id/ai/normalize-latest-update',
  requireAuth,
  async (req, res): Promise<void> => {
    if (req.user?.role === 'customer') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
    if (!ticket) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }

    // Prefer the latest vendor update, then any non-system update, then description
    const [latestVendorUpdate] = await db
      .select()
      .from(ticketUpdatesTable)
      .where(
        and(
          eq(ticketUpdatesTable.ticketId, id),
          eq(ticketUpdatesTable.updateType, 'vendor_update'),
        ),
      )
      .orderBy(desc(ticketUpdatesTable.createdAt))
      .limit(1);

    const [latestAnyUpdate] = await db
      .select()
      .from(ticketUpdatesTable)
      .where(
        and(
          eq(ticketUpdatesTable.ticketId, id),
          eq(ticketUpdatesTable.updateType, 'internal_note'),
        ),
      )
      .orderBy(desc(ticketUpdatesTable.createdAt))
      .limit(1);

    const textToNormalize =
      latestVendorUpdate?.rawText ?? latestAnyUpdate?.rawText ?? ticket.description ?? ticket.title;

    const now = new Date();
    const result = await normalizeStatus({
      text: textToNormalize,
      ticketSeverity: ticket.severity,
      ticketStatus: ticket.status,
    });

    const [updated] = await db
      .update(ticketsTable)
      .set({
        aiNormalizedStatus: result.status,
        aiConfidence: result.confidence,
        aiNormalizedAt: now,
        aiLastGeneratedAt: now,
        updatedAt: now,
      })
      .where(eq(ticketsTable.id, id))
      .returning();

    await db.insert(ticketUpdatesTable).values({
      ticketId: id,
      updateType: 'ai_generated',
      rawText: `Normalized status: ${result.status}${result.reasoning ? ` — ${result.reasoning}` : ''}`,
      aiSourceText: result.sourceText,
      normalizedStatus: result.status,
      visibility: 'internal',
      createdByUserId: req.user?.id ?? null,
    });

    res.json({
      normalizedStatus: result.status,
      confidence: result.confidence,
      reasoning: result.reasoning,
      ticket: updated,
    });
  },
);

router.post(
  '/tickets/:id/ai/generate-customer-update',
  requireAuth,
  async (req, res): Promise<void> => {
    if (req.user?.role === 'customer') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, id));
    if (!ticket) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }

    const updates = await db
      .select()
      .from(ticketUpdatesTable)
      .where(eq(ticketUpdatesTable.ticketId, id))
      .orderBy(desc(ticketUpdatesTable.createdAt))
      .limit(12);

    const now = new Date();
    const result = await generateCustomerUpdate({
      title: ticket.title,
      severity: ticket.severity,
      currentStatus: ticket.status,
      aiNormalizedStatus: ticket.aiNormalizedStatus,
      updates,
    });

    const [updated] = await db
      .update(ticketsTable)
      .set({
        aiCustomerUpdate: result.update,
        aiConfidence: result.confidence,
        aiCustomerUpdateAt: now,
        aiLastGeneratedAt: now,
        updatedAt: now,
      })
      .where(eq(ticketsTable.id, id))
      .returning();

    await db.insert(ticketUpdatesTable).values({
      ticketId: id,
      updateType: 'ai_generated',
      rawText: `Customer update drafted${result.containsETA ? ' (contains ETA)' : ''}: ${result.update}`,
      aiSourceText: result.sourceText,
      visibility: 'internal',
      createdByUserId: req.user?.id ?? null,
    });

    res.json({
      customerUpdate: result.update,
      confidence: result.confidence,
      containsETA: result.containsETA,
      ticket: updated,
    });
  },
);

export default router;
