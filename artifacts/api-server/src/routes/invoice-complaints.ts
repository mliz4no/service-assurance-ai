import { Router, type IRouter } from 'express';
import {
  db,
  invoiceComplaintsTable,
  invoiceComplaintEventsTable,
  customersTable,
  sitesTable,
  servicesTable,
  usersTable,
} from '@workspace/db';
import { and, asc, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { sendBadRequest, sendForbidden } from '../lib/http';
import { validateRequiredFields } from '../lib/integration';
import { validateInvoice } from '../connectors/avalara';

const router: IRouter = Router();

async function getNextComplaintNumber(): Promise<string> {
  const rows = await db
    .select({ complaintNumber: invoiceComplaintsTable.complaintNumber })
    .from(invoiceComplaintsTable);

  if (rows.length === 0) return 'IC-1001';

  let max = 1000;
  for (const row of rows) {
    const match = row.complaintNumber.match(/IC-(\d+)/);
    if (!match) continue;
    const n = Number.parseInt(match[1], 10);
    if (n > max) max = n;
  }

  return `IC-${max + 1}`;
}

router.get('/invoice-complaints', requireAuth, async (req, res): Promise<void> => {
  const { search, status, customerId, priority, complaintType } = req.query as Record<
    string,
    string
  >;
  const conditions = [];

  if (req.user?.role === 'customer' && req.user.customerId) {
    conditions.push(eq(invoiceComplaintsTable.customerId, req.user.customerId));
  } else if (req.user?.role === 'telecom_services_partner') {
    const pIds = req.partnerCustomerIds ?? [];
    if (pIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(invoiceComplaintsTable.customerId, pIds));
  } else if (customerId) {
    conditions.push(eq(invoiceComplaintsTable.customerId, customerId));
  }

  if (status) {
    conditions.push(
      eq(
        invoiceComplaintsTable.status,
        status as 'new' | 'triaged' | 'awaiting_customer' | 'resolved' | 'closed',
      ),
    );
  }
  if (priority) {
    conditions.push(eq(invoiceComplaintsTable.priority, priority as 'low' | 'medium' | 'high'));
  }
  if (complaintType) {
    conditions.push(
      eq(
        invoiceComplaintsTable.complaintType,
        complaintType as
          | 'tax_mismatch'
          | 'rate_mismatch'
          | 'duplicate_charge'
          | 'missing_exemption'
          | 'other',
      ),
    );
  }
  if (search) {
    conditions.push(
      or(
        ilike(invoiceComplaintsTable.complaintNumber, `%${search}%`),
        ilike(invoiceComplaintsTable.title, `%${search}%`),
        ilike(invoiceComplaintsTable.invoiceNumber, `%${search}%`),
        ilike(invoiceComplaintsTable.customerAccountNumber, `%${search}%`),
      ),
    );
  }

  const complaints = await db
    .select()
    .from(invoiceComplaintsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invoiceComplaintsTable.createdAt));

  const customerIds = [
    ...new Set(
      complaints
        .map((c: typeof invoiceComplaintsTable.$inferSelect) => c.customerId)
        .filter(Boolean),
    ),
  ] as string[];
  const customers = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
    : [];

  res.json(
    complaints.map((complaint: typeof invoiceComplaintsTable.$inferSelect) => ({
      ...complaint,
      customer:
        customers.find((customer: typeof customersTable.$inferSelect) => customer.id === complaint.customerId) ??
        null,
    })),
  );
});

router.post('/invoice-complaints', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    sendForbidden(res);
    return;
  }

  const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, [
    'customerId',
    'title',
    'invoiceNumber',
    'customerAccountNumber',
  ]);
  if (Object.keys(fieldErrors).length > 0) {
    sendBadRequest(res, 'Validation failed', fieldErrors);
    return;
  }

  const validTypes = [
    'tax_mismatch',
    'rate_mismatch',
    'duplicate_charge',
    'missing_exemption',
    'other',
  ];
  const validPriorities = ['low', 'medium', 'high'];

  if (req.body.complaintType && !validTypes.includes(req.body.complaintType)) {
    sendBadRequest(res, 'Validation failed', {
      complaintType: `Unsupported value. Allowed: ${validTypes.join(', ')}`,
    });
    return;
  }
  if (req.body.priority && !validPriorities.includes(req.body.priority)) {
    sendBadRequest(res, 'Validation failed', {
      priority: `Unsupported value. Allowed: ${validPriorities.join(', ')}`,
    });
    return;
  }

  const complaintNumber = await getNextComplaintNumber();

  const [created] = await db
    .insert(invoiceComplaintsTable)
    .values({
      complaintNumber,
      customerId: req.body.customerId,
      siteId: req.body.siteId || null,
      serviceId: req.body.serviceId || null,
      assignedToUserId: req.body.assignedToUserId || null,
      title: req.body.title,
      description: req.body.description || null,
      source: req.body.source || 'manual',
      status: req.body.status || 'new',
      priority: req.body.priority || 'medium',
      complaintType: req.body.complaintType || 'other',
      invoiceNumber: req.body.invoiceNumber,
      customerAccountNumber: req.body.customerAccountNumber,
      currencyCode: req.body.currencyCode || 'USD',
      invoiceAmount: req.body.invoiceAmount ? String(req.body.invoiceAmount) : null,
      documentCode: req.body.documentCode || null,
      companyCode: req.body.companyCode || null,
    })
    .returning();

  await db.insert(invoiceComplaintEventsTable).values({
    complaintId: created.id,
    eventType: 'created',
    message: `Complaint ${created.complaintNumber} created`,
    metadata: {
      status: created.status,
      complaintType: created.complaintType,
      priority: created.priority,
    },
    createdByUserId: req.user?.id || null,
  });

  res.status(201).json(created);
});

router.get('/invoice-complaints/:id', requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [complaint] = await db
    .select()
    .from(invoiceComplaintsTable)
    .where(eq(invoiceComplaintsTable.id, id));

  if (!complaint) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  if (req.user?.role === 'customer' && req.user.customerId !== complaint.customerId) {
    sendForbidden(res);
    return;
  }
  if (
    req.user?.role === 'telecom_services_partner' &&
    !(req.partnerCustomerIds ?? []).includes(complaint.customerId)
  ) {
    sendForbidden(res);
    return;
  }

  const [customerRows, siteRows, serviceRows, assignedToRows, events] = await Promise.all([
    db.select().from(customersTable).where(eq(customersTable.id, complaint.customerId)),
    complaint.siteId
      ? db.select().from(sitesTable).where(eq(sitesTable.id, complaint.siteId))
      : Promise.resolve([]),
    complaint.serviceId
      ? db.select().from(servicesTable).where(eq(servicesTable.id, complaint.serviceId))
      : Promise.resolve([]),
    complaint.assignedToUserId
      ? db.select().from(usersTable).where(eq(usersTable.id, complaint.assignedToUserId))
      : Promise.resolve([]),
    db
      .select()
      .from(invoiceComplaintEventsTable)
      .where(eq(invoiceComplaintEventsTable.complaintId, id))
      .orderBy(asc(invoiceComplaintEventsTable.createdAt)),
  ]);

  const customer = customerRows[0] ?? null;
  const site = siteRows[0] ?? null;
  const service = serviceRows[0] ?? null;
  const assignedTo = assignedToRows[0] ?? null;

  res.json({ ...complaint, customer, site, service, assignedTo, events });
});

router.patch('/invoice-complaints/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    sendForbidden(res);
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [existing] = await db
    .select()
    .from(invoiceComplaintsTable)
    .where(eq(invoiceComplaintsTable.id, id));

  if (!existing) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const patch: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  const allowed = [
    'status',
    'priority',
    'assignedToUserId',
    'description',
    'title',
    'complaintType',
    'siteId',
    'serviceId',
  ];

  for (const key of allowed) {
    if (key in req.body) {
      patch[key] = req.body[key] || null;
    }
  }

  const [updated] = await db
    .update(invoiceComplaintsTable)
    .set(patch)
    .where(eq(invoiceComplaintsTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const eventsToInsert: Array<typeof invoiceComplaintEventsTable.$inferInsert> = [];

  if (req.body.status && req.body.status !== existing.status) {
    eventsToInsert.push({
      complaintId: id,
      eventType: 'status_changed',
      message: `Status changed from ${existing.status} to ${req.body.status}`,
      metadata: { from: existing.status, to: req.body.status },
      createdByUserId: req.user?.id || null,
    });
  }

  if (
    'assignedToUserId' in req.body &&
    (req.body.assignedToUserId || null) !== (existing.assignedToUserId || null)
  ) {
    eventsToInsert.push({
      complaintId: id,
      eventType: 'assignment_changed',
      message: 'Assignee updated',
      metadata: {
        from: existing.assignedToUserId,
        to: req.body.assignedToUserId || null,
      },
      createdByUserId: req.user?.id || null,
    });
  }

  if (eventsToInsert.length > 0) {
    await db.insert(invoiceComplaintEventsTable).values(eventsToInsert);
  }

  res.json(updated);
});

router.post('/invoice-complaints/:id/events', requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [complaint] = await db
    .select({ id: invoiceComplaintsTable.id, customerId: invoiceComplaintsTable.customerId })
    .from(invoiceComplaintsTable)
    .where(eq(invoiceComplaintsTable.id, id));

  if (!complaint) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  if (req.user?.role === 'customer' && req.user.customerId !== complaint.customerId) {
    sendForbidden(res);
    return;
  }

  if (!req.body.message) {
    sendBadRequest(res, 'Validation failed', { message: 'This field is required' });
    return;
  }

  const [event] = await db
    .insert(invoiceComplaintEventsTable)
    .values({
      complaintId: id,
      eventType: 'note',
      message: String(req.body.message),
      metadata: req.body.metadata ?? null,
      createdByUserId: req.user?.id || null,
    })
    .returning();

  res.status(201).json(event);
});

router.post('/invoice-complaints/:id/validate', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    sendForbidden(res);
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [complaint] = await db
    .select()
    .from(invoiceComplaintsTable)
    .where(eq(invoiceComplaintsTable.id, id));

  if (!complaint) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  await db.insert(invoiceComplaintEventsTable).values({
    complaintId: id,
    eventType: 'validation_requested',
    message: 'Avalara validation requested',
    createdByUserId: req.user?.id || null,
  });

  try {
    const result = await validateInvoice({
      invoiceNumber: complaint.invoiceNumber,
      customerAccountNumber: complaint.customerAccountNumber,
      companyCode: complaint.companyCode,
      documentCode: complaint.documentCode,
    });

    const summary = [
      `AvaTax lookup OK for ${result.companyCode}/${result.documentCode}.`,
      `Invoice match: ${result.matchesInvoiceNumber ? 'yes' : 'no'}.`,
      `Account match: ${result.matchesCustomerAccountNumber ? 'yes' : 'no'}.`,
      typeof result.totalTax === 'number' ? `Tax: ${result.totalTax}.` : null,
      typeof result.totalAmount === 'number' ? `Total: ${result.totalAmount}.` : null,
    ]
      .filter(Boolean)
      .join(' ');

    const [updated] = await db
      .update(invoiceComplaintsTable)
      .set({
        avalaraValidationStatus: 'validated',
        avalaraValidatedAt: new Date(),
        avalaraSummary: summary,
        updatedAt: new Date(),
      })
      .where(eq(invoiceComplaintsTable.id, id))
      .returning();

    await db.insert(invoiceComplaintEventsTable).values({
      complaintId: id,
      eventType: 'validation_succeeded',
      message: 'Avalara validation succeeded',
      metadata: result,
      createdByUserId: req.user?.id || null,
    });

    res.json({ complaint: updated, validation: result });
  } catch (error: any) {
    const message = error?.message ?? 'Avalara validation failed';

    const [updated] = await db
      .update(invoiceComplaintsTable)
      .set({
        avalaraValidationStatus: 'failed',
        avalaraValidatedAt: new Date(),
        avalaraSummary: message,
        updatedAt: new Date(),
      })
      .where(eq(invoiceComplaintsTable.id, id))
      .returning();

    await db.insert(invoiceComplaintEventsTable).values({
      complaintId: id,
      eventType: 'validation_failed',
      message,
      createdByUserId: req.user?.id || null,
    });

    res.status(502).json({
      message,
      complaint: updated,
    });
  }
});

export default router;
