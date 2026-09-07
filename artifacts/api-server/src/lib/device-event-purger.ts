import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db, deviceEventsTable } from '@workspace/db';
import { acquireDistributedLock } from './distributed-lock';
import { logger } from './logger';

export type RetentionCategory = 'default' | 'incident_evidence' | 'audit' | 'legal';

type RetentionHoursMap = Record<RetentionCategory, number>;

export type PurgePreview = {
  retentionHours: RetentionHoursMap;
  cutoffPerCategory: Record<RetentionCategory, string | null>;
  eligibleCountPerCategory: Record<RetentionCategory, number>;
  heldCount: {
    legalHold: number;
    complianceHold: number;
    totalHolds: number;
  };
  totalEligible: number;
  totalInScope: number;
  categories: RetentionCategory[];
  dryRun: true;
};

export type PurgeRunResult = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  acquiredLock: boolean;
  lockName: string;
  batches: number;
  batchSize: number;
  retentionHours: Record<RetentionCategory, number>;
  deletedPerCategory: Record<RetentionCategory, number>;
  skippedPerCategory: Record<RetentionCategory, number>;
  deletedTotal: number;
  skippedHolds: number;
  errors: string[];
  dryRun: boolean;
};
const LOCK_NAME = 'service-assurance:purge:device-events:daily';
const DEFAULT_BATCH_SIZE = 1000;
const DEFAULT_MAX_BATCHES = 50;

export function getDeviceEventRetentionHours(): Record<RetentionCategory, number> {
  const parseHours = (key: string, fallback: number): number => {
    const raw = process.env[key]?.trim();
    if (!raw) return fallback;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  };
  return {
    default: parseHours('EVENT_PURGE_RETENTION_DEFAULT_HOURS', 24),
    incident_evidence: parseHours('EVENT_PURGE_RETENTION_INCIDENT_EVIDENCE_HOURS', 24 * 90),
    audit: parseHours('EVENT_PURGE_RETENTION_AUDIT_HOURS', 24 * 365),
    legal: parseHours('EVENT_PURGE_RETENTION_LEGAL_HOURS', 24 * 365 * 7),
  };
}

function batchSize(): number {
  const raw = process.env.EVENT_PURGE_BATCH_SIZE?.trim();
  if (!raw) return DEFAULT_BATCH_SIZE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 10_000 ? parsed : DEFAULT_BATCH_SIZE;
}

export function getPurgeBatchOffset(dryRun: boolean, batch: number, size: number): number {
  return dryRun ? batch * size : 0;
}

function maxBatches(): number {
  const raw = process.env.EVENT_PURGE_MAX_BATCHES?.trim();
  if (!raw) return DEFAULT_MAX_BATCHES;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_BATCHES;
}

function isPurgeEnabled(): boolean {
  return process.env.EVENT_PURGE_ENABLED?.toLowerCase() === 'true';
}

const CATEGORY_ORDER: RetentionCategory[] = ['default', 'incident_evidence', 'audit', 'legal'];

function categoryCutoff(hours: Record<RetentionCategory, number>): Record<RetentionCategory, Date | null> {
  const now = Date.now();
  const out = {} as Record<RetentionCategory, Date | null>;
  for (const category of CATEGORY_ORDER) {
    out[category] = hours[category] <= 0 ? null : new Date(now - hours[category] * 60 * 60 * 1000);
  }
  return out;
}

export async function previewDeviceEventPurge(): Promise<PurgePreview> {
  const hours = getDeviceEventRetentionHours();
  const cutoffs = categoryCutoff(hours);
  const eligibleCounts = {} as Record<RetentionCategory, number>;
  for (const category of CATEGORY_ORDER) {
    const cutoff = cutoffs[category];
    if (!cutoff) {
      eligibleCounts[category] = 0;
      continue;
    }
    const [row] = await db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(deviceEventsTable)
      .where(
        and(
          eq(deviceEventsTable.retentionCategory, category),
          lt(deviceEventsTable.occurredAt, cutoff),
          eq(deviceEventsTable.legalHold, false),
          eq(deviceEventsTable.complianceHold, false),
        ),
      );
    eligibleCounts[category] = row?.count ?? 0;
  }

  const [heldRow] = await db
    .select({
      legalHold: sql<number>`sum(case when ${deviceEventsTable.legalHold} = true then 1 else 0 end)`.mapWith(Number),
      complianceHold: sql<number>`sum(case when ${deviceEventsTable.complianceHold} = true then 1 else 0 end)`.mapWith(Number),
      totalHolds: sql<number>`sum(case when ${deviceEventsTable.legalHold} = true or ${deviceEventsTable.complianceHold} = true then 1 else 0 end)`.mapWith(Number),
      total: sql<number>`count(*)`.mapWith(Number),
    })
    .from(deviceEventsTable);

  const cutoffIso = {} as Record<RetentionCategory, string | null>;
  for (const category of CATEGORY_ORDER) {
    cutoffIso[category] = cutoffs[category]?.toISOString() ?? null;
  }

  const totalEligible = CATEGORY_ORDER.reduce((sum, cat) => sum + (eligibleCounts[cat] ?? 0), 0);
  const legalHold = heldRow?.legalHold ?? 0;
  const complianceHold = heldRow?.complianceHold ?? 0;

  return {
    retentionHours: hours,
    cutoffPerCategory: cutoffIso,
    eligibleCountPerCategory: eligibleCounts,
    heldCount: {
      legalHold,
      complianceHold,
      totalHolds: heldRow?.totalHolds ?? 0,
    },
    totalEligible,
    totalInScope: (heldRow?.total ?? 0),
    categories: CATEGORY_ORDER,
    dryRun: true,
  };
}

export async function runDeviceEventPurge(options: {
  dryRun?: boolean } = {}): Promise<PurgeRunResult> {
  const startedAt = new Date();
  const dryRun = options.dryRun ?? false;
  const errors: string[] = [];
  const release = await acquireDistributedLock(LOCK_NAME);
  if (!release) {
    return {
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      acquiredLock: false,
      lockName: LOCK_NAME,
      batches: 0,
      batchSize: batchSize(),
      retentionHours: getDeviceEventRetentionHours(),
      deletedPerCategory: { default: 0, incident_evidence: 0, audit: 0, legal: 0 },
      skippedPerCategory: { default: 0, incident_evidence: 0, audit: 0, legal: 0 },
      deletedTotal: 0,
      skippedHolds: 0,
      errors: ['Could not acquire distributed lock; another purge may be running'],
      dryRun,
    };
  }

  const hours = getDeviceEventRetentionHours();
  const cutoffs = categoryCutoff(hours);
  const size = batchSize();
  const maxB = maxBatches();
  const deleted = { default: 0, incident_evidence: 0, audit: 0, legal: 0 };
  const skipped = { default: 0, incident_evidence: 0, audit: 0, legal: 0 };
  let batches = 0;
  let skippedHolds = 0;

  try {
    outer: for (const category of CATEGORY_ORDER) {
      const cutoff = cutoffs[category];
      if (!cutoff) continue;

      for (let batch = 0; batch < maxB; batch += 1) {
        const eligibleBatch = await db
          .select({
            id: deviceEventsTable.id,
            occurredAt: deviceEventsTable.occurredAt,
            legalHold: deviceEventsTable.legalHold,
            complianceHold: deviceEventsTable.complianceHold,
          })
          .from(deviceEventsTable)
          .where(
            and(
              eq(deviceEventsTable.retentionCategory, category),
              lt(deviceEventsTable.occurredAt, cutoff),
              eq(deviceEventsTable.legalHold, false),
              eq(deviceEventsTable.complianceHold, false),
            ),
          )
          .orderBy(deviceEventsTable.occurredAt)
          .limit(size)
          .offset(getPurgeBatchOffset(dryRun, batch, size));

        if (eligibleBatch.length === 0) continue outer;
        batches += 1;

        const toDelete: string[] = [];
        for (const row of eligibleBatch) {
          if (row.legalHold || row.complianceHold) {
            skipped[category] += 1;
            skippedHolds += 1;
            continue;
          }
          toDelete.push(row.id);
        }
        if (toDelete.length === 0) {
          continue;
        }

        if (!dryRun) {
          const [deletedCount] = await db
            .delete(deviceEventsTable)
            .where(inArraySafe(deviceEventsTable.id, toDelete))
            .returning({ id: deviceEventsTable.id });
          deleted[category] += deletedCount?.length ?? toDelete.length;
        } else {
          deleted[category] += toDelete.length;
        }
        if (eligibleBatch.length < size) continue outer;
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    logger.error({ error, category: 'device_events_purge' }, 'Device event purge encountered an error');
  } finally {
    await release();
  }

  const finishedAt = new Date();
  const result: PurgeRunResult = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    acquiredLock: true,
    lockName: LOCK_NAME,
    batches,
    batchSize: size,
    retentionHours: hours,
    deletedPerCategory: deleted,
    skippedPerCategory: skipped,
    deletedTotal: CATEGORY_ORDER.reduce((sum, c) => sum + (deleted[c] ?? 0), 0),
    skippedHolds,
    errors,
    dryRun,
  };
  logger.info(result, dryRun ? 'Device event purge dry-run complete' : 'Device event purge complete');
  return result;
}

function inArraySafe(column: any, values: string[]) {
  if (values.length === 0) return sql`1 = 0`;
  return inArray(column, values);
}

export function isDeviceEventPurgeEnabled(): boolean {
  return isPurgeEnabled();
}
