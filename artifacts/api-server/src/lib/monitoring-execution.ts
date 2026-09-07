import {
  db,
  monitoredTargetsTable,
  monitoringChecksTable,
  type MonitoredTarget,
} from '@workspace/db';
import { eq, inArray } from 'drizzle-orm';
import { runProbe, toTargetStatusUpdate, type ProbeResult } from './monitoring-checks';
import { syncNagiosChecks } from './nagios';
import { upsertIncidentTicketForMonitoringTarget } from './monitoring-incidents';
import { resolveTargetEnrichmentWithProvider } from './target-enrichment';
import type { MonitoringJobResult } from './monitoring-scheduler';
import { logger } from './logger';

export type MonitoringExecutionResult = MonitoringJobResult & {
  results: Array<{
    targetId: string;
    checkId: string;
    status: 'up' | 'down' | 'degraded' | 'unknown';
    checkType: 'http' | 'tcp' | 'icmp' | 'dns' | 'tls';
    responseTimeMs: number | null;
    ticketAction: 'skipped' | 'created' | 'updated';
    ticketId: string | null;
    outageClassification: string | null;
    enrichment: Awaited<ReturnType<typeof resolveTargetEnrichmentWithProvider>>;
  }>;
};

export function isTargetDue(
  target: Pick<MonitoredTarget, 'lastCheckedAt' | 'probeCadenceSeconds'>,
  nowMs = Date.now(),
): boolean {
  if (!target.lastCheckedAt || !target.probeCadenceSeconds) return true;
  return nowMs - target.lastCheckedAt.getTime() >= target.probeCadenceSeconds * 1_000;
}

export function getProbeMaxTargetsPerRun(): number {
  const configured = Number(process.env.PROBE_MAX_TARGETS_PER_RUN ?? 100);
  return Number.isInteger(configured) && configured > 0 ? configured : 100;
}

export function summarizeProbeResults(results: ProbeResult[]) {
  const statuses: Record<ProbeResult['status'], number> = {
    up: 0,
    down: 0,
    degraded: 0,
    unknown: 0,
  };
  const checkTypes: Record<ProbeResult['checkType'], number> = {
    http: 0,
    tcp: 0,
    icmp: 0,
    dns: 0,
    tls: 0,
  };
  let blocked = 0;

  for (const result of results) {
    statuses[result.status] += 1;
    checkTypes[result.checkType] += 1;
    if (result.payload.blocked === true) blocked += 1;
  }

  return { blocked, statuses, checkTypes };
}

async function loadTargets(targetIds: string[]): Promise<MonitoredTarget[]> {
  const limit = getProbeMaxTargetsPerRun();
  if (targetIds.length > 0) {
    const uniqueTargetIds = [...new Set(targetIds)].slice(0, limit);
    return db.select().from(monitoredTargetsTable).where(inArray(monitoredTargetsTable.id, uniqueTargetIds));
  }

  const targets = await db.select().from(monitoredTargetsTable);
  const nowMs = Date.now();
  return targets
    .filter((target: MonitoredTarget) => isTargetDue(target, nowMs))
    .slice(0, limit);
}

function emptyExecution(): MonitoringExecutionResult {
  return { processed: 0, createdTickets: 0, updatedTickets: 0, results: [] };
}

export async function runSyntheticMonitoring(targetIds: string[] = []): Promise<MonitoringExecutionResult> {
  const startedAt = Date.now();
  const targets = await loadTargets(targetIds);
  if (targets.length === 0) return emptyExecution();

  const execution = emptyExecution();
  const probeResults: ProbeResult[] = [];
  for (const target of targets) {
    const enrichment = await resolveTargetEnrichmentWithProvider(target.hostOrIp);
    const probe = await runProbe(target);
    probeResults.push(probe);
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

    await db
      .update(monitoredTargetsTable)
      .set({
        ...toTargetStatusUpdate(probe, 'synthetic'),
        provider: target.provider ?? enrichment.provider,
        region: target.region ?? enrichment.region,
      })
      .where(eq(monitoredTargetsTable.id, target.id));

    const incident = await upsertIncidentTicketForMonitoringTarget({
      target,
      status: probe.status,
      source: 'synthetic',
      summary: `Synthetic monitoring check recorded ${probe.status} for ${target.name}`,
    });

    if (incident.action === 'created') execution.createdTickets += 1;
    if (incident.action === 'updated') execution.updatedTickets += 1;
    execution.results.push({
      targetId: target.id,
      checkId: check.id,
      status: probe.status,
      checkType: probe.checkType,
      responseTimeMs: probe.responseTimeMs,
      ticketAction: incident.action,
      ticketId: incident.ticketId ?? null,
      outageClassification: incident.classification ?? null,
      enrichment,
    });
  }

  execution.processed = execution.results.length;
  const { blocked, statuses, checkTypes } = summarizeProbeResults(probeResults);
  logger.info(
    {
      category: 'synthetic_monitoring',
      requested: targetIds.length || null,
      selected: targets.length,
      processed: execution.processed,
      blocked,
      statuses,
      checkTypes,
      durationMs: Date.now() - startedAt,
    },
    'Synthetic monitoring run complete',
  );
  return execution;
}

export async function runNagiosMonitoring(targetIds: string[] = []): Promise<MonitoringExecutionResult> {
  const targets = await loadTargets(targetIds);
  if (targets.length === 0) return emptyExecution();

  const checks = await syncNagiosChecks(targets);
  const execution = emptyExecution();

  for (const normalized of checks) {
    const target = targets.find((item) => item.id === normalized.targetId);
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

    await db
      .update(monitoredTargetsTable)
      .set({
        ...toTargetStatusUpdate(normalized, 'nagios'),
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

    if (incident.action === 'created') execution.createdTickets += 1;
    if (incident.action === 'updated') execution.updatedTickets += 1;
    execution.results.push({
      targetId: target.id,
      checkId: check.id,
      status: normalized.status,
      checkType: normalized.checkType,
      responseTimeMs: normalized.responseTimeMs,
      ticketAction: incident.action,
      ticketId: incident.ticketId ?? null,
      outageClassification: incident.classification ?? null,
      enrichment,
    });
  }

  execution.processed = execution.results.length;
  return execution;
}