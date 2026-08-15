import {
  db,
  monitoredTargetsTable,
  slaPoliciesTable,
  ticketUpdatesTable,
  ticketsTable,
  type MonitoredTarget,
} from '@workspace/db';
import { and, eq, ne } from 'drizzle-orm';
import { lookupExternalOutageSignal } from './external-outage-signal';

type CheckStatus = 'up' | 'down' | 'degraded' | 'unknown';

const OPEN_TICKET_STATUSES = [
  'new',
  'investigating',
  'vendor_engaged',
  'dispatch_scheduled',
  'monitoring',
] as const;

type OutageClassification = 'isolated_issue' | 'shared_outage' | 'regional_outage' | 'unknown';
type OutageConfidence = 'high' | 'medium' | 'low';
type OutageReasonCode =
  | 'external_signal_active'
  | 'sibling_outage'
  | 'localized_failure'
  | 'no_context';

function mapSeverity(status: CheckStatus): 'low' | 'medium' | 'high' | 'critical' {
  if (status === 'down') return 'high';
  if (status === 'degraded') return 'medium';
  return 'low';
}

function mapOutageType(status: CheckStatus): 'outage' | 'impairment' | 'unknown' {
  if (status === 'down') return 'outage';
  if (status === 'degraded') return 'impairment';
  return 'unknown';
}

async function classifyOutageContext(target: MonitoredTarget): Promise<{
  classification: OutageClassification;
  confidence: OutageConfidence;
  reasonCode: OutageReasonCode;
  siblingCount: number;
  healthySiblingCount: number;
  impairedSiblingCount: number;
}> {
  if (!target.customerId) {
    return {
      classification: 'unknown',
      confidence: 'low',
      reasonCode: 'no_context',
      siblingCount: 0,
      healthySiblingCount: 0,
      impairedSiblingCount: 0,
    };
  }

  const siblingsWhere = target.siteId
    ? and(
        eq(monitoredTargetsTable.customerId, target.customerId),
        eq(monitoredTargetsTable.siteId, target.siteId),
        ne(monitoredTargetsTable.id, target.id),
      )
    : and(eq(monitoredTargetsTable.customerId, target.customerId), ne(monitoredTargetsTable.id, target.id));

  const siblings = await db.select().from(monitoredTargetsTable).where(siblingsWhere);

  if (siblings.length === 0) {
    return {
      classification: 'unknown',
      confidence: 'low',
      reasonCode: 'no_context',
      siblingCount: 0,
      healthySiblingCount: 0,
      impairedSiblingCount: 0,
    };
  }

  const healthySiblingCount = siblings.filter((s: MonitoredTarget) => s.status === 'up').length;
  const impairedSiblingCount = siblings.filter(
    (s: MonitoredTarget) => s.status === 'down' || s.status === 'degraded',
  ).length;

  const classification:
    | OutageClassification = impairedSiblingCount > 0 && healthySiblingCount === 0
    ? 'shared_outage'
    : 'isolated_issue';

  return {
    classification,
    confidence: classification === 'shared_outage' ? 'high' : 'medium',
    reasonCode: classification === 'shared_outage' ? 'sibling_outage' : 'localized_failure',
    siblingCount: siblings.length,
    healthySiblingCount,
    impairedSiblingCount,
  };
}

async function getNextTicketNumber(): Promise<string> {
  const rows = await db.select({ ticketNumber: ticketsTable.ticketNumber }).from(ticketsTable);

  if (rows.length === 0) return 'SA-1001';

  let max = 1000;
  for (const row of rows) {
    const match = row.ticketNumber.match(/SA-(\d+)/);
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (parsed > max) max = parsed;
  }

  return `SA-${max + 1}`;
}

export async function upsertIncidentTicketForMonitoringTarget(input: {
  target: MonitoredTarget;
  status: CheckStatus;
  source: 'manual' | 'nagios' | 'synthetic';
  summary: string;
}): Promise<{
  action: 'skipped' | 'created' | 'updated';
  ticketId?: string;
  classification?: OutageClassification;
}> {
  const { target, status, source, summary } = input;

  if (!target.customerId) {
    return { action: 'skipped' };
  }

  if (status !== 'down' && status !== 'degraded') {
    return { action: 'skipped' };
  }

  const vendorTicketId = `monitoring-target:${target.id}`;
  const [context, externalSignal] = await Promise.all([
    classifyOutageContext(target),
    lookupExternalOutageSignal({
      region: target.region,
      provider: target.provider,
    }),
  ]);
  const effectiveClassification: OutageClassification = externalSignal?.active
    ? 'regional_outage'
    : context.classification;
  const confidence: OutageConfidence = externalSignal?.active
    ? 'high'
    : context.confidence;
  const reasonCode: OutageReasonCode = externalSignal?.active
    ? 'external_signal_active'
    : context.reasonCode;

  const externalSignalText = externalSignal
    ? ` External signal ${externalSignal.active ? 'active' : 'inactive'} via ${externalSignal.source}${externalSignal.incidentId ? `; incident=${externalSignal.incidentId}` : ''}${externalSignal.summary ? `; summary=${externalSignal.summary}` : ''}.`
    : '';
  const contextText =
    effectiveClassification === 'unknown'
      ? `No sibling context available for classification; confidence=${confidence}; reason=${reasonCode}.${externalSignalText}`
      : `Classified as ${effectiveClassification}; confidence=${confidence}; reason=${reasonCode}; siblings=${context.siblingCount}, healthy=${context.healthySiblingCount}, impaired=${context.impairedSiblingCount}.${externalSignalText}`;
  const summaryWithContext = `${summary} (${source}) ${contextText}`;

  const [existing] = await db
    .select()
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.customerId, target.customerId),
        eq(ticketsTable.vendorTicketId, vendorTicketId),
      ),
    );

  const severity = mapSeverity(status);
  const outageType = mapOutageType(status);

  if (existing && OPEN_TICKET_STATUSES.includes(existing.status as (typeof OPEN_TICKET_STATUSES)[number])) {
    await db
      .update(ticketsTable)
      .set({
        severity,
        outageType,
        lastUpdatedAt: new Date(),
      })
      .where(eq(ticketsTable.id, existing.id));

    await db.insert(ticketUpdatesTable).values({
      ticketId: existing.id,
      updateType: 'system_event',
      rawText: summaryWithContext,
      visibility: 'internal',
    });

    return {
      action: 'updated',
      ticketId: existing.id,
      classification: effectiveClassification,
    };
  }

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

  const [created] = await db
    .insert(ticketsTable)
    .values({
      ticketNumber: await getNextTicketNumber(),
      customerId: target.customerId,
      siteId: target.siteId ?? null,
      serviceId: target.serviceId ?? null,
      title: `Monitoring alert: ${target.name}`,
      description: summaryWithContext,
      source: 'api',
      severity,
      status: 'new',
      outageType,
      vendorTicketId,
      nextEscalationAt,
      slaTargetMinutes,
    })
    .returning();

  await db.insert(ticketUpdatesTable).values({
    ticketId: created.id,
    updateType: 'system_event',
    rawText: summaryWithContext,
    visibility: 'internal',
  });

  return {
    action: 'created',
    ticketId: created.id,
    classification: effectiveClassification,
  };
}