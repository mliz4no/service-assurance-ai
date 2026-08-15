import {
  db,
  monitoredTargetsTable,
  monitoringChecksTable,
  type MonitoredTarget,
} from '@workspace/db';
import { eq, inArray } from 'drizzle-orm';
import { runProbe, toTargetStatusUpdate } from './monitoring-checks';
import { syncNagiosChecks } from './nagios';
import { upsertIncidentTicketForMonitoringTarget } from './monitoring-incidents';
import { resolveTargetEnrichmentWithProvider } from './target-enrichment';
import type { MonitoringJobResult } from './monitoring-scheduler';

export type MonitoringExecutionResult = MonitoringJobResult & {
  results: Array<{
    targetId: string;
    checkId: string;
    status: 'up' | 'down' | 'degraded' | 'unknown';
    checkType: 'http' | 'tcp';
    responseTimeMs: number | null;
    ticketAction: 'skipped' | 'created' | 'updated';
    ticketId: string | null;
    outageClassification: string | null;
    enrichment: Awaited<ReturnType<typeof resolveTargetEnrichmentWithProvider>>;
  }>;
};

async function loadTargets(targetIds: string[]): Promise<MonitoredTarget[]> {
  return targetIds.length > 0
    ? db.select().from(monitoredTargetsTable).where(inArray(monitoredTargetsTable.id, targetIds))
    : db.select().from(monitoredTargetsTable);
}

function emptyExecution(): MonitoringExecutionResult {
  return { processed: 0, createdTickets: 0, updatedTickets: 0, results: [] };
}

export async function runSyntheticMonitoring(targetIds: string[] = []): Promise<MonitoringExecutionResult> {
  const targets = await loadTargets(targetIds);
  if (targets.length === 0) return emptyExecution();

  const execution = emptyExecution();
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