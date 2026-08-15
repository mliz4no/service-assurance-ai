import { Router, type IRouter } from 'express';
import {
  db,
  customersTable,
  servicesTable,
  ticketsTable,
  ticketUpdatesTable,
  monitoredTargetsTable,
  monitoringChecksTable,
} from '@workspace/db';
import { eq, and, desc, count, inArray, gte, lte } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { normalizeStatus } from '../lib/ai';

const router: IRouter = Router();

type ParsedMonitoringContext = {
  classification: 'shared_outage' | 'isolated_issue' | 'regional_outage' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasonCode: string;
};

type ParsedControllerContext = {
  classification: 'controller_outage' | 'controller_impairment' | 'controller_info';
  confidence: 'high' | 'medium' | 'low';
  reasonCode: string;
};

function parseMonitoringContext(rawText: string): ParsedMonitoringContext | null {
  const matched = rawText.match(
    /Classified as (shared_outage|isolated_issue|regional_outage|unknown); confidence=(high|medium|low); reason=([^;\.]+); siblings=(\d+), healthy=(\d+), impaired=(\d+)\./,
  );
  if (matched) {
    return {
      classification: matched[1] as ParsedMonitoringContext['classification'],
      confidence: matched[2] as ParsedMonitoringContext['confidence'],
      reasonCode: matched[3],
    };
  }

  if (rawText.includes('No sibling context available for classification.')) {
    const confidenceMatch = rawText.match(/confidence=(high|medium|low)/);
    const reasonMatch = rawText.match(/reason=([^;\.]+)/);
    return {
      classification: 'unknown',
      confidence: (confidenceMatch?.[1] ?? 'low') as ParsedMonitoringContext['confidence'],
      reasonCode: reasonMatch?.[1] ?? 'no_context',
    };
  }

  return null;
}

function parseControllerContext(rawText: string): ParsedControllerContext | null {
  const matched = rawText.match(
    /Controller incident classification: (controller_outage|controller_impairment|controller_info); confidence=(high|medium|low); reason=([^\.]+)\./,
  );
  if (!matched) return null;

  return {
    classification: matched[1] as ParsedControllerContext['classification'],
    confidence: matched[2] as ParsedControllerContext['confidence'],
    reasonCode: matched[3],
  };
}

function increment(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

router.get('/dashboard/summary', requireAuth, async (req, res): Promise<void> => {
  const customerCondition =
    req.user?.role === 'customer' && req.user.customerId
      ? eq(customersTable.id, req.user.customerId)
      : undefined;

  const ticketBaseWhere =
    req.user?.role === 'customer' && req.user.customerId
      ? eq(ticketsTable.customerId, req.user.customerId)
      : undefined;

  const [activeCustomers, activeServices, allTickets] = await Promise.all([
    db.select({ cnt: count() }).from(customersTable).where(eq(customersTable.status, 'active')),
    db.select({ cnt: count() }).from(servicesTable).where(eq(servicesTable.status, 'active')),
    db.select().from(ticketsTable).where(ticketBaseWhere),
  ]);

  const openStatuses = [
    'new',
    'investigating',
    'vendor_engaged',
    'dispatch_scheduled',
    'monitoring',
  ];
  const openTickets = allTickets.filter((t: typeof ticketsTable.$inferSelect) => openStatuses.includes(t.status));
  const criticalTickets = allTickets.filter(
    (t: typeof ticketsTable.$inferSelect) => t.severity === 'critical' && openStatuses.includes(t.status),
  );
  const now = new Date();
  const slaBreachingTickets = openTickets.filter(
    (t: typeof ticketsTable.$inferSelect) => t.nextEscalationAt && t.nextEscalationAt < now,
  );

  const ticketsByStatus: Record<string, number> = {};
  const ticketsBySeverity: Record<string, number> = {};
  for (const t of allTickets as Array<typeof ticketsTable.$inferSelect>) {
    ticketsByStatus[t.status] = (ticketsByStatus[t.status] ?? 0) + 1;
    ticketsBySeverity[t.severity] = (ticketsBySeverity[t.severity] ?? 0) + 1;
  }

  res.json({
    totalActiveCustomers: activeCustomers[0]?.cnt ?? 0,
    totalActiveServices: activeServices[0]?.cnt ?? 0,
    openTickets: openTickets.length,
    criticalTickets: criticalTickets.length,
    slaBreachingTickets: slaBreachingTickets.length,
    ticketsByStatus,
    ticketsBySeverity,
  });
});

router.get('/dashboard/recent-tickets', requireAuth, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) ?? '10', 10);
  const openStatuses = [
    'new',
    'investigating',
    'vendor_engaged',
    'dispatch_scheduled',
    'monitoring',
  ];

  const whereConditions = [];
  if (req.user?.role === 'customer' && req.user.customerId) {
    whereConditions.push(eq(ticketsTable.customerId, req.user.customerId));
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(whereConditions.length > 0 ? whereConditions[0] : undefined)
    .orderBy(desc(ticketsTable.openedAt))
    .limit(limit);

  const { inArray } = await import('drizzle-orm');
  const customerIds = [...new Set(tickets.map((t: typeof ticketsTable.$inferSelect) => t.customerId).filter(Boolean) as string[])];
  const customers = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
    : [];

  const siteIds = [...new Set(tickets.map((t: typeof ticketsTable.$inferSelect) => t.siteId).filter(Boolean) as string[])];
  const { sitesTable } = await import('@workspace/db');
  const sites = siteIds.length
    ? await db.select().from(sitesTable).where(inArray(sitesTable.id, siteIds))
    : [];

  const enriched = tickets.map((t: typeof ticketsTable.$inferSelect) => ({
    ...t,
    customer: customers.find((c: typeof customersTable.$inferSelect) => c.id === t.customerId) ?? null,
    site: sites.find((s: typeof sitesTable.$inferSelect) => s.id === t.siteId) ?? null,
    service: null,
    assignedTo: null,
  }));

  res.json(enriched);
});

router.get('/dashboard/escalation-needed', requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const openStatuses = [
    'new',
    'investigating',
    'vendor_engaged',
    'dispatch_scheduled',
    'monitoring',
  ];
  const { inArray, isNotNull, lt: drizzleLt } = await import('drizzle-orm');

  const whereConditions = [];
  if (req.user?.role === 'customer' && req.user.customerId) {
    whereConditions.push(eq(ticketsTable.customerId, req.user.customerId));
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(whereConditions.length > 0 ? whereConditions[0] : undefined)
    .orderBy(ticketsTable.nextEscalationAt);

  const escalationNeeded = tickets.filter(
    (t: typeof ticketsTable.$inferSelect) => openStatuses.includes(t.status) && t.nextEscalationAt && t.nextEscalationAt < now,
  );

  const customerIds = [...new Set(escalationNeeded.map((t: typeof ticketsTable.$inferSelect) => t.customerId).filter(Boolean) as string[])];
  const customers = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
    : [];

  const enriched = escalationNeeded.map((t: typeof ticketsTable.$inferSelect) => ({
    ...t,
    customer: customers.find((c: typeof customersTable.$inferSelect) => c.id === t.customerId) ?? null,
    site: null,
    service: null,
    assignedTo: null,
  }));

  res.json(enriched);
});

router.get('/dashboard/outage-context-summary', requireAuth, async (req, res): Promise<void> => {
  const openOnly = (req.query.openOnly as string | undefined) !== 'false';
  const openStatuses = ['new', 'investigating', 'vendor_engaged', 'dispatch_scheduled', 'monitoring'];

  const whereConditions = [];
  if (req.user?.role === 'customer' && req.user.customerId) {
    whereConditions.push(eq(ticketsTable.customerId, req.user.customerId));
  }

  const tickets = await db
    .select({ id: ticketsTable.id, status: ticketsTable.status })
    .from(ticketsTable)
    .where(whereConditions.length > 0 ? whereConditions[0] : undefined);

  const scopedTicketIds = tickets
    .filter((ticket: { id: string; status: string }) => !openOnly || openStatuses.includes(ticket.status))
    .map((ticket: { id: string; status: string }) => ticket.id);

  if (scopedTicketIds.length === 0) {
    res.json({
      openOnly,
      totals: { monitoring: 0, controller: 0 },
      monitoring: { byClassification: {}, byConfidence: {}, byReasonCode: {} },
      controller: { byClassification: {}, byConfidence: {}, byReasonCode: {} },
    });
    return;
  }

  const updates = await db
    .select({ ticketId: ticketUpdatesTable.ticketId, rawText: ticketUpdatesTable.rawText })
    .from(ticketUpdatesTable)
    .where(and(inArray(ticketUpdatesTable.ticketId, scopedTicketIds), eq(ticketUpdatesTable.updateType, 'system_event')));

  const monitoring = {
    byClassification: {} as Record<string, number>,
    byConfidence: {} as Record<string, number>,
    byReasonCode: {} as Record<string, number>,
  };
  const controller = {
    byClassification: {} as Record<string, number>,
    byConfidence: {} as Record<string, number>,
    byReasonCode: {} as Record<string, number>,
  };

  let monitoringTotal = 0;
  let controllerTotal = 0;

  for (const update of updates) {
    const monitoringContext = parseMonitoringContext(update.rawText);
    if (monitoringContext) {
      monitoringTotal += 1;
      increment(monitoring.byClassification, monitoringContext.classification);
      increment(monitoring.byConfidence, monitoringContext.confidence);
      increment(monitoring.byReasonCode, monitoringContext.reasonCode);
    }

    const controllerContext = parseControllerContext(update.rawText);
    if (controllerContext) {
      controllerTotal += 1;
      increment(controller.byClassification, controllerContext.classification);
      increment(controller.byConfidence, controllerContext.confidence);
      increment(controller.byReasonCode, controllerContext.reasonCode);
    }
  }

  res.json({
    openOnly,
    totals: {
      monitoring: monitoringTotal,
      controller: controllerTotal,
    },
    monitoring,
    controller,
  });
});

router.get('/dashboard/outage-context-report', requireAuth, async (req, res): Promise<void> => {
  const source = (req.query.source as string | undefined) ?? 'monitoring';
  const classification = (req.query.classification as string | undefined) ?? undefined;
  const reasonCode = (req.query.reasonCode as string | undefined) ?? undefined;
  const openOnly = (req.query.openOnly as string | undefined) !== 'false';
  const openStatuses = ['new', 'investigating', 'vendor_engaged', 'dispatch_scheduled', 'monitoring'];

  if (!['monitoring', 'controller'].includes(source)) {
    res.status(400).json({ error: 'Bad Request', message: 'source must be monitoring or controller' });
    return;
  }

  const whereConditions = [];
  if (req.user?.role === 'customer' && req.user.customerId) {
    whereConditions.push(eq(ticketsTable.customerId, req.user.customerId));
  }

  const tickets = await db
    .select({
      id: ticketsTable.id,
      ticketNumber: ticketsTable.ticketNumber,
      customerId: ticketsTable.customerId,
      title: ticketsTable.title,
      status: ticketsTable.status,
      severity: ticketsTable.severity,
      openedAt: ticketsTable.openedAt,
    })
    .from(ticketsTable)
    .where(whereConditions.length > 0 ? whereConditions[0] : undefined)
    .orderBy(desc(ticketsTable.openedAt));

  const scopedTickets = tickets.filter(
    (ticket: { status: string }) => !openOnly || openStatuses.includes(ticket.status),
  );

  if (scopedTickets.length === 0) {
    res.json([]);
    return;
  }

  const ticketIds = scopedTickets.map((ticket: { id: string }) => ticket.id);
  const updates = await db
    .select({
      ticketId: ticketUpdatesTable.ticketId,
      rawText: ticketUpdatesTable.rawText,
      createdAt: ticketUpdatesTable.createdAt,
    })
    .from(ticketUpdatesTable)
    .where(and(inArray(ticketUpdatesTable.ticketId, ticketIds), eq(ticketUpdatesTable.updateType, 'system_event')))
    .orderBy(desc(ticketUpdatesTable.createdAt));

  const latestByTicket = new Map<string, ParsedMonitoringContext | ParsedControllerContext>();
  for (const update of updates) {
    if (latestByTicket.has(update.ticketId)) continue;
    const parsed = source === 'monitoring'
      ? parseMonitoringContext(update.rawText)
      : parseControllerContext(update.rawText);
    if (!parsed) continue;
    latestByTicket.set(update.ticketId, parsed);
  }

  const customerIds = [
    ...new Set(scopedTickets.map((ticket: (typeof scopedTickets)[number]) => ticket.customerId)),
  ];
  const customers = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds as string[]))
    : [];

  const filtered = scopedTickets
    .map((ticket: (typeof scopedTickets)[number]) => ({
      ...ticket,
      customer: customers.find((customer: typeof customersTable.$inferSelect) => customer.id === ticket.customerId) ?? null,
      context: latestByTicket.get(ticket.id) ?? null,
    }))
    .filter(
      (
        ticket: (typeof scopedTickets)[number] & {
          customer: typeof customersTable.$inferSelect | null;
          context: ParsedMonitoringContext | ParsedControllerContext | null;
        },
      ) => ticket.context,
    )
    .filter(
      (
        ticket: (typeof scopedTickets)[number] & {
          customer: typeof customersTable.$inferSelect | null;
          context: ParsedMonitoringContext | ParsedControllerContext | null;
        },
      ) => (classification ? ticket.context?.classification === classification : true),
    )
    .filter(
      (
        ticket: (typeof scopedTickets)[number] & {
          customer: typeof customersTable.$inferSelect | null;
          context: ParsedMonitoringContext | ParsedControllerContext | null;
        },
      ) => (reasonCode ? ticket.context?.reasonCode === reasonCode : true),
    );

  res.json(filtered);
});

router.get('/dashboard/network-impact-report', requireAuth, async (req, res): Promise<void> => {
  const defaultFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const from = req.query.from ? new Date(String(req.query.from)) : defaultFrom;
  const to = req.query.to ? new Date(String(req.query.to)) : new Date();

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    res.status(400).json({ error: 'Bad Request', message: 'A valid from/to date range is required' });
    return;
  }

  const conditions = [gte(monitoringChecksTable.checkedAt, from), lte(monitoringChecksTable.checkedAt, to)];
  if (req.user?.role === 'customer' && req.user.customerId) {
    conditions.push(eq(monitoredTargetsTable.customerId, req.user.customerId));
  }

  const checks = await db
    .select({
      targetId: monitoredTargetsTable.id,
      targetName: monitoredTargetsTable.name,
      provider: monitoredTargetsTable.provider,
      region: monitoredTargetsTable.region,
      status: monitoringChecksTable.status,
      responseTimeMs: monitoringChecksTable.responseTimeMs,
      checkedAt: monitoringChecksTable.checkedAt,
    })
    .from(monitoringChecksTable)
    .innerJoin(monitoredTargetsTable, eq(monitoringChecksTable.targetId, monitoredTargetsTable.id))
    .where(and(...conditions))
    .orderBy(desc(monitoringChecksTable.checkedAt));

  type Aggregate = {
    key: string;
    totalChecks: number;
    outages: number;
    degraded: number;
    responseTimeTotal: number;
    responseTimeCount: number;
  };

  const providers = new Map<string, Aggregate>();
  const regions = new Map<string, Aggregate>();
  const devices = new Map<string, Aggregate & {
    name: string;
    provider: string;
    region: string;
    lastStatus: string;
    lastCheckedAt: Date;
  }>();

  const updateAggregate = (map: Map<string, Aggregate>, key: string, row: (typeof checks)[number]) => {
    const current = map.get(key) ?? {
      key,
      totalChecks: 0,
      outages: 0,
      degraded: 0,
      responseTimeTotal: 0,
      responseTimeCount: 0,
    };
    current.totalChecks += 1;
    if (row.status === 'down') current.outages += 1;
    if (row.status === 'degraded') current.degraded += 1;
    if (row.responseTimeMs != null) {
      current.responseTimeTotal += row.responseTimeMs;
      current.responseTimeCount += 1;
    }
    map.set(key, current);
  };

  for (const row of checks) {
    const provider = row.provider ?? 'Unknown provider';
    const region = row.region ?? 'Unknown region';
    updateAggregate(providers, provider, row);
    updateAggregate(regions, region, row);

    const existing = devices.get(row.targetId);
    if (existing) {
      updateAggregate(devices, row.targetId, row);
    } else {
      devices.set(row.targetId, {
        key: row.targetId,
        name: row.targetName,
        provider,
        region,
        lastStatus: row.status,
        lastCheckedAt: row.checkedAt,
        totalChecks: 1,
        outages: row.status === 'down' ? 1 : 0,
        degraded: row.status === 'degraded' ? 1 : 0,
        responseTimeTotal: row.responseTimeMs ?? 0,
        responseTimeCount: row.responseTimeMs == null ? 0 : 1,
      });
    }
  }

  const finalize = (aggregate: Aggregate) => ({
    key: aggregate.key,
    totalChecks: aggregate.totalChecks,
    outages: aggregate.outages,
    degraded: aggregate.degraded,
    availabilityPct: Number(
      (((aggregate.totalChecks - aggregate.outages) / Math.max(aggregate.totalChecks, 1)) * 100).toFixed(2),
    ),
    averageResponseTimeMs: aggregate.responseTimeCount
      ? Math.round(aggregate.responseTimeTotal / aggregate.responseTimeCount)
      : null,
  });

  const byProvider = [...providers.values()].map(finalize).sort((a, b) => b.outages - a.outages);
  const byRegion = [...regions.values()].map(finalize).sort((a, b) => b.outages - a.outages);
  const byDevice = [...devices.values()]
    .map((device) => ({
      ...finalize(device),
      targetId: device.key,
      name: device.name,
      provider: device.provider,
      region: device.region,
      lastStatus: device.lastStatus,
      lastCheckedAt: device.lastCheckedAt,
    }))
    .sort((a, b) => b.outages - a.outages);

  if (req.query.format === 'csv') {
    const header = ['targetId', 'name', 'provider', 'region', 'totalChecks', 'outages', 'degraded', 'availabilityPct', 'averageResponseTimeMs', 'lastStatus', 'lastCheckedAt'];
    const rows = byDevice.map((device) => [
      device.targetId,
      device.name,
      device.provider,
      device.region,
      device.totalChecks,
      device.outages,
      device.degraded,
      device.availabilityPct,
      device.averageResponseTimeMs,
      device.lastStatus,
      device.lastCheckedAt.toISOString(),
    ]);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="network-impact-report.csv"');
    res.send([header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'));
    return;
  }

  res.json({
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      checks: checks.length,
      outages: checks.filter((check: { status: string }) => check.status === 'down').length,
      degraded: checks.filter((check: { status: string }) => check.status === 'degraded').length,
      devices: devices.size,
    },
    byProvider,
    byRegion,
    byDevice,
  });
});

router.get('/admin/config-health', requireAuth, async (_req, res): Promise<void> => {
  let dbHealthy = false;
  try {
    await db.select({ cnt: count() }).from(customersTable);
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  res.json({
    database: dbHealthy,
    openAi: !!process.env.OPENAI_API_KEY,
    sessionSecret: !!process.env.SESSION_SECRET,
    environment: process.env.NODE_ENV ?? 'development',
  });
});

router.post('/admin/ai-test', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: 'Bad Request', message: 'text is required' });
    return;
  }

  const result = await normalizeStatus({ text, ticketSeverity: 'medium', ticketStatus: 'new' });

  res.json({
    normalizedStatus: result.status,
    confidence: result.confidence,
    reasoning: result.reasoning,
  });
});

export default router;
