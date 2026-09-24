import net from 'node:net';
import { getCachedProviderLookup, setCachedProviderLookup } from './provider-lookup-cache';
import { resolveUsStateCentroid } from './geo-centroids';

export type TargetEnrichment = {
  normalizedHostOrIp: string;
  ipType: 'ipv4' | 'ipv6' | 'hostname';
  provider: string | null;
  region: string | null;
  confidence: 'high' | 'medium' | 'low';
  asn?: string | null;
  country?: string | null;
  city?: string | null;
  /** Raw state/province name from the enrichment provider, used for approximate map placement */
  state?: string | null;
  source?: 'heuristic' | 'ipinfo';
  /** City-level coordinate reported by the enrichment provider (e.g. ipinfo's "loc"), not exact */
  approximateLatitude?: number | null;
  approximateLongitude?: number | null;
};

type IpinfoResponse = {
  org?: string;
  country?: string;
  region?: string;
  city?: string;
  loc?: string;
};

function parseIpinfoLoc(loc: string | undefined): { latitude: number; longitude: number } | null {
  if (!loc) return null;
  const [latRaw, lngRaw] = loc.split(',');
  const latitude = Number(latRaw);
  const longitude = Number(lngRaw);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * Resolves a generic, non-exact coordinate for display until a precise location is set.
 * Prefers city-level enrichment data, falling back to a US state centroid.
 */
export function resolveApproximateCoordinates(
  enrichment: Pick<TargetEnrichment, 'approximateLatitude' | 'approximateLongitude' | 'region' | 'state'>,
): { latitude: number; longitude: number } | null {
  if (enrichment.approximateLatitude != null && enrichment.approximateLongitude != null) {
    return { latitude: enrichment.approximateLatitude, longitude: enrichment.approximateLongitude };
  }

  const stateCentroid = resolveUsStateCentroid(enrichment.state) ?? resolveUsStateCentroid(enrichment.region);
  if (stateCentroid) {
    return { latitude: stateCentroid[0], longitude: stateCentroid[1] };
  }

  return null;
}

const HOST_PROVIDER_PATTERNS: Array<{ pattern: RegExp; provider: string }> = [
  { pattern: /(^|\.)att\./i, provider: 'AT&T' },
  { pattern: /(^|\.)verizon\./i, provider: 'Verizon' },
  { pattern: /(^|\.)comcast\./i, provider: 'Comcast Business' },
  { pattern: /(^|\.)lumen\./i, provider: 'Lumen' },
  { pattern: /(^|\.)zayo\./i, provider: 'Zayo' },
  { pattern: /(^|\.)spectrum\./i, provider: 'Spectrum Business' },
];

function normalizeHostOrIp(input: string): string {
  return input.trim().toLowerCase();
}

function classifyRegionByHostname(hostname: string): string | null {
  if (hostname.endsWith('.us')) return 'NA';
  if (hostname.endsWith('.ca')) return 'NA';
  if (hostname.endsWith('.mx')) return 'NA';
  if (hostname.endsWith('.uk') || hostname.endsWith('.de') || hostname.endsWith('.fr')) return 'EMEA';
  if (hostname.endsWith('.jp') || hostname.endsWith('.sg') || hostname.endsWith('.au')) return 'APAC';
  return null;
}

function classifyProviderByHostname(hostname: string): string | null {
  for (const rule of HOST_PROVIDER_PATTERNS) {
    if (rule.pattern.test(hostname)) return rule.provider;
  }
  return null;
}

function classifyProviderByIp(ip: string): { provider: string | null; confidence: 'high' | 'medium' | 'low' } {
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) {
    return { provider: 'Private Network', confidence: 'high' };
  }

  if (ip.startsWith('198.51.100.') || ip.startsWith('203.0.113.') || ip.startsWith('192.0.2.')) {
    return { provider: 'Documentation/Test Network', confidence: 'high' };
  }

  return { provider: null, confidence: 'low' };
}

function isPublicRoutableIp(ip: string): boolean {
  if (ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return false;
  if (ip.startsWith('198.51.100.') || ip.startsWith('203.0.113.') || ip.startsWith('192.0.2.')) return false;
  if (ip === '127.0.0.1' || ip.startsWith('127.')) return false;
  return true;
}

function regionFromCountryCode(country: string | undefined): string | null {
  if (!country) return null;

  const na = new Set(['US', 'CA', 'MX']);
  const emea = new Set(['GB', 'IE', 'DE', 'FR', 'NL', 'ES', 'IT', 'SE', 'NO', 'FI', 'PL']);
  const apac = new Set(['JP', 'SG', 'AU', 'NZ', 'IN', 'KR', 'HK']);
  const latam = new Set(['BR', 'AR', 'CL', 'CO', 'PE']);

  if (na.has(country)) return 'NA';
  if (emea.has(country)) return 'EMEA';
  if (apac.has(country)) return 'APAC';
  if (latam.has(country)) return 'LATAM';
  return null;
}

function parseOrg(org: string | undefined): { asn: string | null; provider: string | null } {
  if (!org) return { asn: null, provider: null };

  const trimmed = org.trim();
  const match = trimmed.match(/^(AS\d+)\s+(.+)$/i);
  if (!match) {
    return {
      asn: null,
      provider: trimmed || null,
    };
  }

  return {
    asn: match[1].toUpperCase(),
    provider: match[2].trim() || null,
  };
}

async function lookupIpinfo(ip: string): Promise<{
  provider: string | null;
  region: string | null;
  confidence: 'high' | 'medium' | 'low';
  asn: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  source: 'ipinfo';
  approximateLatitude: number | null;
  approximateLongitude: number | null;
} | null> {
  const provider = (process.env.IP_ENRICHMENT_PROVIDER ?? 'ipinfo').toLowerCase();
  if (provider !== 'ipinfo') return null;

  const token = process.env.IPINFO_TOKEN?.trim();
  if (!token) return null;

  const baseUrl = (process.env.IPINFO_BASE_URL?.trim() || 'https://ipinfo.io').replace(/\/$/, '');
  const url = `${baseUrl}/${encodeURIComponent(ip)}/json?token=${encodeURIComponent(token)}`;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) return null;

  const json = (await response.json()) as IpinfoResponse;
  const org = parseOrg(json.org);
  const loc = parseIpinfoLoc(json.loc);

  return {
    provider: org.provider,
    region: regionFromCountryCode(json.country) ?? json.region ?? null,
    confidence: org.provider ? 'high' : 'medium',
    asn: org.asn,
    country: json.country ?? null,
    city: json.city ?? null,
    state: json.region ?? null,
    source: 'ipinfo',
    approximateLatitude: loc?.latitude ?? null,
    approximateLongitude: loc?.longitude ?? null,
  };
}

export function resolveTargetEnrichment(hostOrIp: string): TargetEnrichment {
  const normalizedHostOrIp = normalizeHostOrIp(hostOrIp);
  const ipVersion = net.isIP(normalizedHostOrIp);

  if (ipVersion === 4 || ipVersion === 6) {
    const byIp = classifyProviderByIp(normalizedHostOrIp);
    return {
      normalizedHostOrIp,
      ipType: ipVersion === 4 ? 'ipv4' : 'ipv6',
      provider: byIp.provider,
      region: null,
      confidence: byIp.confidence,
      source: 'heuristic',
    };
  }

  const provider = classifyProviderByHostname(normalizedHostOrIp);
  return {
    normalizedHostOrIp,
    ipType: 'hostname',
    provider,
    region: classifyRegionByHostname(normalizedHostOrIp),
    confidence: provider ? 'medium' : 'low',
    source: 'heuristic',
  };
}

export async function resolveTargetEnrichmentWithProvider(hostOrIp: string): Promise<TargetEnrichment> {
  const fallback = resolveTargetEnrichment(hostOrIp);

  if (fallback.ipType !== 'ipv4' && fallback.ipType !== 'ipv6') {
    return fallback;
  }

  if (!isPublicRoutableIp(fallback.normalizedHostOrIp)) {
    return fallback;
  }

  try {
    const cached = await getCachedProviderLookup(fallback.normalizedHostOrIp);
    if (cached) {
      return {
        ...fallback,
        provider: cached.provider ?? fallback.provider,
        region: cached.region ?? fallback.region,
        confidence: cached.provider ? 'high' : 'medium',
        asn: cached.asn,
        country: cached.country,
        city: cached.city,
        state: cached.state,
        source: cached.source === 'ipinfo' ? 'ipinfo' : 'heuristic',
      };
    }

    const enriched = await lookupIpinfo(fallback.normalizedHostOrIp);
    if (!enriched) return fallback;

    await setCachedProviderLookup(fallback.normalizedHostOrIp, enriched);

    return {
      ...fallback,
      provider: enriched.provider ?? fallback.provider,
      region: enriched.region ?? fallback.region,
      confidence: enriched.confidence,
      asn: enriched.asn,
      country: enriched.country,
      city: enriched.city,
      state: enriched.state,
      source: enriched.source,
      approximateLatitude: enriched.approximateLatitude,
      approximateLongitude: enriched.approximateLongitude,
    };
  } catch {
    return fallback;
  }
}
