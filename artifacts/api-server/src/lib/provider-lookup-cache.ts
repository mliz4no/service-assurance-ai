import { eq } from 'drizzle-orm';

export type CachedProviderLookup = {
  provider: string | null;
  region: string | null;
  asn: string | null;
  country: string | null;
  city: string | null;
  source: string;
};

function cacheEnabled(): boolean {
  return process.env.IP_ENRICHMENT_CACHE_ENABLED === 'true';
}

export async function getCachedProviderLookup(ipAddress: string): Promise<CachedProviderLookup | null> {
  if (!cacheEnabled()) return null;
  const { db, providerLookupsTable } = await import('@workspace/db');

  const ttlMs = Math.max(60_000, Number(process.env.IP_ENRICHMENT_CACHE_TTL_MS ?? 86_400_000));
  const [cached] = await db
    .select()
    .from(providerLookupsTable)
    .where(
      eq(providerLookupsTable.ipAddress, ipAddress),
    );

  if (!cached || cached.cachedAt <= new Date(Date.now() - ttlMs)) return null;
  return cached;
}

export async function setCachedProviderLookup(
  ipAddress: string,
  lookup: CachedProviderLookup,
): Promise<void> {
  if (!cacheEnabled()) return;
  const { db, providerLookupsTable } = await import('@workspace/db');

  await db
    .insert(providerLookupsTable)
    .values({ ipAddress, ...lookup, cachedAt: new Date() })
    .onConflictDoUpdate({
      target: providerLookupsTable.ipAddress,
      set: { ...lookup, cachedAt: new Date() },
    });
}