import net from 'node:net';
import { getCachedProviderLookup, setCachedProviderLookup } from './provider-lookup-cache';

export type TargetEnrichment = {
  normalizedHostOrIp: string;
  ipType: 'ipv4' | 'ipv6' | 'hostname';
  provider: string | null;
  region: string | null;
  confidence: 'high' | 'medium' | 'low';
  asn?: string | null;
  country?: string | null;
  city?: string | null;
  source?: 'heuristic' | 'ipinfo';
};

type IpinfoResponse = {
  org?: string;
  country?: string;
  region?: string;
  city?: string;
};

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
  source: 'ipinfo';
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

  return {
    provider: org.provider,
    region: regionFromCountryCode(json.country) ?? json.region ?? null,
    confidence: org.provider ? 'high' : 'medium',
    asn: org.asn,
    country: json.country ?? null,
    city: json.city ?? null,
    source: 'ipinfo',
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
      source: enriched.source,
    };
  } catch {
    return fallback;
  }
}
