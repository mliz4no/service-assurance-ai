import { db, managedDevicesTable, monitoredTargetsTable, sitesTable } from '@workspace/db';
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

export type PublicOutageRegion = {
  region: string;
  classification: 'operational' | 'degraded' | 'localized_outage' | 'widespread_outage' | 'unknown';
  totalAssets: number;
  affectedAssets: number;
  downAssets: number;
  degradedAssets: number;
  unknownAssets: number;
  affectedPercentage: number;
  latitude: number;
  longitude: number;
  providers: string[];
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

  const targetPoints = (rows as PublicNetworkMapRow[]).map((row: PublicNetworkMapRow) => ({
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

  const devices = await database
    .select({
      id: managedDevicesTable.id,
      publicLabel: managedDevicesTable.publicLabel,
      status: managedDevicesTable.status,
      latitude: sql<
        number | null
      >`coalesce(${managedDevicesTable.latitude}, ${sitesTable.latitude})`,
      longitude: sql<
        number | null
      >`coalesce(${managedDevicesTable.longitude}, ${sitesTable.longitude})`,
      provider: managedDevicesTable.vendor,
      region: sitesTable.state,
      lastSeenAt: managedDevicesTable.lastSeenAt,
    })
    .from(managedDevicesTable)
    .leftJoin(sitesTable, eq(managedDevicesTable.siteId, sitesTable.id))
    .where(and(eq(managedDevicesTable.isPublic, true), isNotNull(managedDevicesTable.publicLabel)));

  const devicePoints: PublicNetworkMapPoint[] = devices
    .filter(
      (device: (typeof devices)[number]) => device.latitude !== null && device.longitude !== null,
    )
    .map((device: (typeof devices)[number]) => ({
      id: `device:${device.id}`,
      label: device.publicLabel as string,
      status:
        device.status === 'online' ? 'up' : device.status === 'offline' ? 'down' : device.status,
      latitude: device.latitude as number,
      longitude: device.longitude as number,
      provider: device.provider,
      region: device.region,
      lastSeenAt: device.lastSeenAt,
      source: 'controller',
    }));

  return [...targetPoints, ...devicePoints];
}

export async function getPublicNetworkMapSummary(): Promise<PublicNetworkMapSummary> {
  const points = await getPublicNetworkMapData();
  const timestamps = points
    .map((point) => point.lastSeenAt?.getTime())
    .filter((timestamp): timestamp is number => timestamp !== undefined);

  return {
    totalAssets: points.length,
    activeOutages: points.filter((point) => point.status === 'down').length,
    degradedServices: points.filter((point) => point.status === 'degraded').length,
    unknownServices: points.filter((point) => point.status === 'unknown').length,
    lastUpdatedAt: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
  };
}

function classifyRegion(points: PublicNetworkMapPoint[]): PublicOutageRegion['classification'] {
  const downAssets = points.filter((point) => point.status === 'down').length;
  const degradedAssets = points.filter((point) => point.status === 'degraded').length;
  const knownAssets = points.filter((point) => point.status !== 'unknown').length;
  const affectedAssets = downAssets + degradedAssets;

  if (knownAssets === 0) return 'unknown';
  if (downAssets >= 2 || (points.length >= 3 && affectedAssets / points.length >= 0.5)) {
    return 'widespread_outage';
  }
  if (downAssets > 0) return 'localized_outage';
  if (degradedAssets > 0) return 'degraded';
  return 'operational';
}

export async function getPublicOutageRegions(): Promise<PublicOutageRegion[]> {
  const points = await getPublicNetworkMapData();
  const grouped = new Map<string, PublicNetworkMapPoint[]>();

  for (const point of points) {
    const region = point.region?.trim() || 'Unassigned region';
    grouped.set(region, [...(grouped.get(region) ?? []), point]);
  }

  return [...grouped.entries()]
    .map(([region, regionPoints]) => {
      const downAssets = regionPoints.filter((point) => point.status === 'down').length;
      const degradedAssets = regionPoints.filter((point) => point.status === 'degraded').length;
      const unknownAssets = regionPoints.filter((point) => point.status === 'unknown').length;
      const affectedAssets = downAssets + degradedAssets;
      const timestamps = regionPoints
        .map((point) => point.lastSeenAt?.getTime())
        .filter((timestamp): timestamp is number => timestamp !== undefined);

      return {
        region,
        classification: classifyRegion(regionPoints),
        totalAssets: regionPoints.length,
        affectedAssets,
        downAssets,
        degradedAssets,
        unknownAssets,
        affectedPercentage: Math.round((affectedAssets / regionPoints.length) * 100),
        latitude:
          regionPoints.reduce((sum, point) => sum + point.latitude, 0) / regionPoints.length,
        longitude:
          regionPoints.reduce((sum, point) => sum + point.longitude, 0) / regionPoints.length,
        providers: [
          ...new Set(regionPoints.flatMap((point) => (point.provider ? [point.provider] : []))),
        ].sort(),
        lastUpdatedAt: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null,
      } satisfies PublicOutageRegion;
    })
    .sort((left, right) => {
      const rank: Record<PublicOutageRegion['classification'], number> = {
        widespread_outage: 0,
        localized_outage: 1,
        degraded: 2,
        unknown: 3,
        operational: 4,
      };
      return (
        rank[left.classification] - rank[right.classification] ||
        left.region.localeCompare(right.region)
      );
    });
}
