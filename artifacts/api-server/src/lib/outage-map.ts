import { db, monitoredTargetsTable } from '@workspace/db';
import { and, eq, isNotNull, sql } from 'drizzle-orm';

export type PublicNetworkMapPoint = {
  id: string;
  label: string;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  latitude: number;
  longitude: number;
  provider: string | null;
  region: string | null;
  lastSeenAt: Date | null;
  source: 'manual' | 'nagios' | 'controller' | 'synthetic';
};

export type PublicNetworkMapSummary = {
  totalAssets: number;
  activeOutages: number;
  degradedServices: number;
  unknownServices: number;
  lastUpdatedAt: Date | null;
};

type PublicNetworkMapRow = {
  id: string;
  publicLabel: string | null;
  status: 'up' | 'down' | 'degraded' | 'unknown';
  latitude: number | null;
  longitude: number | null;
  provider: string | null;
  region: string | null;
  lastCheckedAt: Date | null;
  statusSource: 'manual' | 'nagios' | 'controller' | 'synthetic';
};

function getDb(): NonNullable<typeof db> {
  if (!db) {
    throw new Error('Database unavailable. Ensure DATABASE_URL is configured.');
  }
  return db;
}

export async function getPublicNetworkMapData(): Promise<PublicNetworkMapPoint[]> {
  const database = getDb();

  const rows = await database
    .select({
      id: monitoredTargetsTable.id,
      publicLabel: monitoredTargetsTable.publicLabel,
      status: monitoredTargetsTable.status,
      latitude: monitoredTargetsTable.latitude,
      longitude: monitoredTargetsTable.longitude,
      provider: monitoredTargetsTable.provider,
      region: monitoredTargetsTable.region,
      lastCheckedAt: monitoredTargetsTable.lastCheckedAt,
      statusSource: monitoredTargetsTable.statusSource,
    })
    .from(monitoredTargetsTable)
    .where(
      and(
        eq(monitoredTargetsTable.isPublic, true),
        isNotNull(monitoredTargetsTable.publicLabel),
        isNotNull(monitoredTargetsTable.latitude),
        isNotNull(monitoredTargetsTable.longitude),
      ),
    )
    .orderBy(monitoredTargetsTable.publicLabel);

  return (rows as PublicNetworkMapRow[]).map((row: PublicNetworkMapRow) => ({
    id: row.id,
    label: row.publicLabel as string,
    status: row.status,
    latitude: row.latitude as number,
    longitude: row.longitude as number,
    provider: row.provider,
    region: row.region,
    lastSeenAt: row.lastCheckedAt,
    source: row.statusSource,
  }));
}

export async function getPublicNetworkMapSummary(): Promise<PublicNetworkMapSummary> {
  const database = getDb();

  const [summary] = await database
    .select({
      totalAssets: sql<number>`count(*)::int`,
      activeOutages: sql<number>`count(*) filter (where ${monitoredTargetsTable.status} = 'down')::int`,
      degradedServices: sql<number>`count(*) filter (where ${monitoredTargetsTable.status} = 'degraded')::int`,
      unknownServices: sql<number>`count(*) filter (where ${monitoredTargetsTable.status} = 'unknown')::int`,
      lastUpdatedAt: sql<Date | null>`max(${monitoredTargetsTable.lastCheckedAt})`,
    })
    .from(monitoredTargetsTable)
    .where(
      and(
        eq(monitoredTargetsTable.isPublic, true),
        isNotNull(monitoredTargetsTable.publicLabel),
        isNotNull(monitoredTargetsTable.latitude),
        isNotNull(monitoredTargetsTable.longitude),
      ),
    );

  return {
    totalAssets: Number(summary?.totalAssets ?? 0),
    activeOutages: Number(summary?.activeOutages ?? 0),
    degradedServices: Number(summary?.degradedServices ?? 0),
    unknownServices: Number(summary?.unknownServices ?? 0),
    lastUpdatedAt: summary?.lastUpdatedAt ?? null,
  };
}