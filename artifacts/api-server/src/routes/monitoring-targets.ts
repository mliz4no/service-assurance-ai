import { Router, type IRouter, type Request, type Response } from 'express';
import {
  db,
  monitoredTargetsTable,
  monitoringChecksTable,
  insertMonitoredTargetApiSchema,
  MONITORING_CHECK_TYPES,
} from '@workspace/db';
import { and, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { sendBadRequest, sendForbidden } from '../lib/http';
import { getStringParam } from '../lib/params';
import {
  resolveTargetEnrichmentWithProvider,
} from '../lib/target-enrichment';
import { lookupExternalOutageSignal } from '../lib/external-outage-signal';
import { runNagiosMonitoring, runSyntheticMonitoring } from '../lib/monitoring-execution';
import {
  evaluateProbeSafety,
  runProbe,
} from '../lib/monitoring-checks';
import dns from 'node:dns';
import crypto from 'node:crypto';

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

  const execution = await runSyntheticMonitoring(targetIds);
  if (execution.processed === 0) {
    sendBadRequest(res, 'No monitoring targets found for check execution');
    return;
  }

  res.json({
    startedAt: new Date().toISOString(),
    ...execution,
  });
});

router.post('/monitoring/checks/nagios-sync', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;

  const body = (req.body ?? {}) as { targetIds?: string[] };
  const targetIds = Array.isArray(body.targetIds) ? body.targetIds.filter(Boolean) : [];

  const execution = await runNagiosMonitoring(targetIds);
  if (execution.processed === 0) {
    sendBadRequest(res, 'No monitoring targets found for Nagios sync');
    return;
  }

  res.json({
    syncedAt: new Date().toISOString(),
    ...execution,
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

router.post('/monitoring/targets/:id/probe-preview', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const id = getStringParam(req.params.id, 'id');
  const [target] = await db.select().from(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));
  if (!target) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const host = target.hostOrIp.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  let resolvedIps: string[] = [];
  try {
    const [a, aaaa] = await Promise.all([
      dns.promises.resolve4(host).catch(() => []),
      dns.promises.resolve6(host).catch(() => []),
    ]);
    resolvedIps = [...a, ...aaaa];
  } catch {
    resolvedIps = [];
  }
  const safety = evaluateProbeSafety(target, { resolvedIps });
  const probe = await runProbe(target);

  res.json({
    targetId: target.id,
    preferredCheckType: target.preferredCheckType ?? null,
    supportedCheckTypes: MONITORING_CHECK_TYPES,
    host,
    resolvedIps,
    ownership: {
      verifiedAt: target.ownershipVerifiedAt ?? null,
      method: target.ownershipMethod ?? null,
      allowlisted: target.probeAllowlisted,
    },
    safety,
    probe,
  });
});

router.post('/monitoring/targets/:id/ownership/dns-txt-challenge', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const id = getStringParam(req.params.id, 'id');
  const [target] = await db.select().from(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));
  if (!target) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  const host = target.hostOrIp.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  const token = `sa-verify-${crypto.randomBytes(16).toString('hex')}`;

  const [updated] = await db
    .update(monitoredTargetsTable)
    .set({
      ownershipMethod: 'dns_txt',
      ownershipVerificationValue: token,
    })
    .where(eq(monitoredTargetsTable.id, id))
    .returning();

  res.json({
    targetId: id,
    challenge: {
      type: 'dns_txt',
      recordName: `_sa-verify.${host}`,
      recordValue: token,
      instructions: `Create a TXT DNS record at _sa-verify.${host} with value "${token}", then call POST /monitoring/targets/${id}/ownership/verify to confirm.`,
    },
    target: updated,
  });
});

router.post('/monitoring/targets/:id/ownership/verify', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const id = getStringParam(req.params.id, 'id');
  const [target] = await db.select().from(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));
  if (!target) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  if (!target.ownershipVerificationValue) {
    sendBadRequest(res, 'No challenge generated', {
      body: ['Call ownership/dns-txt-challenge or set an HTTP challenge first'],
    });
    return;
  }
  const host = target.hostOrIp.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0];
  const verifyHost = `_sa-verify.${host}`;
  let records: string[][] = [];
  try {
    records = await dns.promises.resolveTxt(verifyHost);
  } catch (error) {
    res.status(200).json({
      verified: false,
      method: 'dns_txt',
      queriedRecord: verifyHost,
      error: error instanceof Error ? error.message : 'DNS lookup failed',
      expectedValue: target.ownershipVerificationValue,
    });
    return;
  }
  const flat = records.flat();
  const matched = flat.includes(target.ownershipVerificationValue);
  if (!matched) {
    res.status(200).json({
      verified: false,
      method: 'dns_txt',
      queriedRecord: verifyHost,
      foundRecords: flat,
      expectedValue: target.ownershipVerificationValue,
    });
    return;
  }

  const [updated] = await db
    .update(monitoredTargetsTable)
    .set({
      ownershipVerifiedAt: new Date(),
      probeAllowlisted: true,
    })
    .where(eq(monitoredTargetsTable.id, id))
    .returning();

  res.json({
    verified: true,
    method: 'dns_txt',
    queriedRecord: verifyHost,
    foundRecords: flat,
    target: updated,
  });
});

router.post('/monitoring/targets/:id/allowlist', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== 'admin') {
    sendForbidden(res, 'Only admin users can toggle probe allowlisting');
    return;
  }
  const id = getStringParam(req.params.id, 'id');
  const body = (req.body ?? {}) as { allowlisted?: boolean; method?: 'explicit_approval' };
  const allowlisted = body.allowlisted ?? true;

  const [existing] = await db.select().from(monitoredTargetsTable).where(eq(monitoredTargetsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  const [updated] = await db
    .update(monitoredTargetsTable)
    .set({
      probeAllowlisted: allowlisted,
      ownershipMethod: allowlisted ? (body.method ?? 'explicit_approval') : existing.ownershipMethod,
      ownershipVerifiedAt: allowlisted ? new Date() : existing.ownershipVerifiedAt,
    })
    .where(eq(monitoredTargetsTable.id, id))
    .returning();

  res.json({ target: updated });
});

export default router;