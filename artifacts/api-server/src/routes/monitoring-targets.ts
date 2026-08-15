import { Router, type IRouter, type Request, type Response } from 'express';
import {
  db,
  monitoredTargetsTable,
  monitoringChecksTable,
  insertMonitoredTargetApiSchema,
  type MonitoredTarget,
} from '@workspace/db';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { sendBadRequest, sendForbidden } from '../lib/http';
import { getStringParam } from '../lib/params';
import { runProbe, toTargetStatusUpdate } from '../lib/monitoring-checks';
import { syncNagiosChecks } from '../lib/nagios';
import { upsertIncidentTicketForMonitoringTarget } from '../lib/monitoring-incidents';
import { resolveTargetEnrichmentWithProvider } from '../lib/target-enrichment';
import { lookupExternalOutageSignal } from '../lib/external-outage-signal';

const router: IRouter = Router();

function requireInternalUser(req: Request, res: Response): boolean {
  if (!req.user) {
    sendForbidden(res, 'User authentication is required');
    return false;
  }
  if (!['admin', 'ops'].includes(req.user.role)) {
    sendForbidden(res);
    return false;
  }
  return true;
}

router.get('/monitoring/targets', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const { search, status, isPublic } = req.query as Record<string, string>;
  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(monitoredTargetsTable.name, `%${search}%`),
        ilike(monitoredTargetsTable.hostOrIp, `%${search}%`),
        ilike(monitoredTargetsTable.publicLabel, `%${search}%`),
      ),
    );
  }

  if (status) {
    const allowedStatuses = ['up', 'down', 'degraded', 'unknown'] as const;
    if (!allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
      sendBadRequest(res, 'Validation failed', {
        status: `Unsupported value. Allowed: ${allowedStatuses.join(', ')}`,
      });
      return;
    }
    conditions.push(eq(monitoredTargetsTable.status, status as (typeof allowedStatuses)[number]));
  }

  if (isPublic === 'true') {
    conditions.push(eq(monitoredTargetsTable.isPublic, true));
  } else if (isPublic === 'false') {
    conditions.push(eq(monitoredTargetsTable.isPublic, false));
  }

  const rows = await db
    .select()
    .from(monitoredTargetsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(monitoredTargetsTable.name);

  res.json(rows);
});

router.get('/monitoring/targets/:id', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const id = getStringParam(req.params.id, 'id');
  const [target] = await db.select().from(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));

  if (!target) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  res.json(target);
});

router.post('/monitoring/targets', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const parsed = insertMonitoredTargetApiSchema.safeParse(req.body);
  if (!parsed.success) {
    sendBadRequest(res, 'Validation failed', {
      body: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`),
    });
    return;
  }

  const payload = parsed.data;
  const [created] = await db
    .insert(monitoredTargetsTable)
    .values({
      ...payload,
      status: payload.status ?? 'unknown',
      statusSource: payload.statusSource ?? 'manual',
      isPublic: payload.isPublic ?? false,
    })
    .returning();

  res.status(201).json(created);
});

router.put('/monitoring/targets/:id', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const id = getStringParam(req.params.id, 'id');

  const parsed = insertMonitoredTargetApiSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    sendBadRequest(res, 'Validation failed', {
      body: parsed.error.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`),
    });
    return;
  }

  const [existing] = await db.select().from(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const [updated] = await db
    .update(monitoredTargetsTable)
    .set(parsed.data)
    .where(eq(monitoredTargetsTable.id, id))
    .returning();

  res.json(updated);
});

router.delete('/monitoring/targets/:id', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const id = getStringParam(req.params.id, 'id');
  const [existing] = await db.select().from(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  await db.delete(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));
  res.json({ success: true });
});

router.post('/monitoring/checks/run', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const body = (req.body ?? {}) as { targetId?: string; targetIds?: string[] };
  const targetIds = [
    ...(body.targetId ? [body.targetId] : []),
    ...(Array.isArray(body.targetIds) ? body.targetIds : []),
  ].filter((value): value is string => Boolean(value));

  const targets = targetIds.length
    ? await db
        .select()
        .from(monitoredTargetsTable)
        .where(inArray(monitoredTargetsTable.id, targetIds))
    : await db.select().from(monitoredTargetsTable);

  if (targets.length === 0) {
    sendBadRequest(res, 'No monitoring targets found for check execution');
    return;
  }

  const results = [];
  let createdTickets = 0;
  let updatedTickets = 0;
  for (const target of targets) {
    const enrichment = await resolveTargetEnrichmentWithProvider(target.hostOrIp);
    const probe = await runProbe(target);
    const [check] = await db
      .insert(monitoringChecksTable)
      .values({
        targetId: target.id,
        source: 'manual',
        checkType: probe.checkType,
        status: probe.status,
        responseTimeMs: probe.responseTimeMs,
        payloadJson: probe.payload,
      })
      .returning();

    const statusUpdate = toTargetStatusUpdate(probe, 'synthetic');
    await db
      .update(monitoredTargetsTable)
      .set({
        ...statusUpdate,
        provider: target.provider ?? enrichment.provider,
        region: target.region ?? enrichment.region,
      })
      .where(eq(monitoredTargetsTable.id, target.id));

    const incident = await upsertIncidentTicketForMonitoringTarget({
      target,
      status: probe.status,
      source: 'synthetic',
      summary: `Manual monitoring check recorded ${probe.status} for ${target.name}`,
    });
    if (incident.action === 'created') createdTickets += 1;
    if (incident.action === 'updated') updatedTickets += 1;

    results.push({
      targetId: target.id,
      checkId: check.id,
      status: probe.status,
      checkType: probe.checkType,
      responseTimeMs: probe.responseTimeMs,
      outageClassification: incident.classification ?? null,
      enrichment,
    });
  }

  res.json({
    startedAt: new Date().toISOString(),
    processed: results.length,
    createdTickets,
    updatedTickets,
    results,
  });
});

router.post('/monitoring/checks/nagios-sync', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const body = (req.body ?? {}) as { targetIds?: string[] };
  const targetIds = Array.isArray(body.targetIds) ? body.targetIds.filter(Boolean) : [];

  const targets = targetIds.length
    ? await db
        .select()
        .from(monitoredTargetsTable)
        .where(inArray(monitoredTargetsTable.id, targetIds))
    : await db.select().from(monitoredTargetsTable);

  if (targets.length === 0) {
    sendBadRequest(res, 'No monitoring targets found for Nagios sync');
    return;
  }

  const nagiosChecks = await syncNagiosChecks(targets);

  const results = [];
  let createdTickets = 0;
  let updatedTickets = 0;

  for (const normalized of nagiosChecks) {
    const target = targets.find((item: MonitoredTarget) => item.id === normalized.targetId);
    if (!target) continue;
    const enrichment = await resolveTargetEnrichmentWithProvider(target.hostOrIp);

    const [check] = await db
      .insert(monitoringChecksTable)
      .values({
        targetId: target.id,
        source: 'nagios',
        checkType: normalized.checkType,
        status: normalized.status,
        responseTimeMs: normalized.responseTimeMs,
        payloadJson: normalized.payload,
      })
      .returning();

    const statusUpdate = toTargetStatusUpdate(
      {
        checkType: normalized.checkType,
        status: normalized.status,
        responseTimeMs: normalized.responseTimeMs,
        payload: normalized.payload,
      },
      'nagios',
    );
    await db
      .update(monitoredTargetsTable)
      .set({
        ...statusUpdate,
        provider: target.provider ?? enrichment.provider,
        region: target.region ?? enrichment.region,
      })
      .where(eq(monitoredTargetsTable.id, target.id));

    const incident = await upsertIncidentTicketForMonitoringTarget({
      target,
      status: normalized.status,
      source: 'nagios',
      summary: `Nagios reported ${normalized.status} for ${target.name}`,
    });
    if (incident.action === 'created') createdTickets += 1;
    if (incident.action === 'updated') updatedTickets += 1;

    results.push({
      targetId: target.id,
      checkId: check.id,
      status: normalized.status,
      checkType: normalized.checkType,
      ticketAction: incident.action,
      ticketId: incident.ticketId ?? null,
      outageClassification: incident.classification ?? null,
      enrichment,
    });
  }

  res.json({
    syncedAt: new Date().toISOString(),
    processed: results.length,
    createdTickets,
    updatedTickets,
    results,
  });
});

router.get('/monitoring/checks', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const { targetId } = req.query as Record<string, string>;
  const rawLimit = Number((req.query.limit as string) ?? '50');
  const limit = Number.isNaN(rawLimit) ? 50 : Math.max(1, Math.min(500, rawLimit));

  const checks = await db
    .select()
    .from(monitoringChecksTable)
    .where(targetId ? eq(monitoringChecksTable.targetId, targetId) : undefined)
    .orderBy(desc(monitoringChecksTable.checkedAt))
    .limit(limit);

  res.json(checks);
});

router.post('/monitoring/enrichment/lookup', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const body = (req.body ?? {}) as { targetId?: string; hostOrIp?: string };
  const hostOrIp = body.hostOrIp?.trim();

  if (hostOrIp) {
    res.json({ enrichment: await resolveTargetEnrichmentWithProvider(hostOrIp) });
    return;
  }

  if (!body.targetId) {
    sendBadRequest(res, 'Validation failed', {
      body: ['Either targetId or hostOrIp is required'],
    });
    return;
  }

  const [target] = await db
    .select()
    .from(monitoredTargetsTable)
    .where(eq(monitoredTargetsTable.id, body.targetId));

  if (!target) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const enrichment = await resolveTargetEnrichmentWithProvider(target.hostOrIp);
  res.json({ targetId: target.id, hostOrIp: target.hostOrIp, enrichment });
});

router.get('/monitoring/external-outage-signal/preview', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const { region, provider } = req.query as Record<string, string>;
  const signal = await lookupExternalOutageSignal({
    region: region ?? null,
    provider: provider ?? null,
  });

  res.json({
    configured: Boolean(process.env.POWER_OUTAGE_API_BASE_URL?.trim()),
    query: {
      region: region ?? null,
      provider: provider ?? null,
    },
    signal,
  });
});

export default router;