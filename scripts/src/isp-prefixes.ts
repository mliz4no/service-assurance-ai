import { isIPv4 } from 'node:net';

const DEFAULT_RIPESTAT_BASE_URL = 'https://stat.ripe.net/data';
const DEFAULT_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

export type IspAsn = {
  isp: string;
  asn: string;
  category?: string;
};

export type VerifiedIspAsn = IspAsn & {
  holder: string | null;
  matchesListedIsp: boolean;
  lookupSucceeded: boolean;
};

export type AnnouncedPrefix = IspAsn & {
  prefix: string;
  addressFamily: 'ipv4' | 'ipv6';
  numAddresses: string;
};

export type PingCandidate = IspAsn & {
  prefix: string;
  candidateIp: string;
};

type FetchLike = typeof fetch;

function normalizeAsn(value: string): string {
  const normalized = value.trim().toUpperCase().replace(/^AS/, '');
  if (!/^\d+$/.test(normalized)) throw new Error(`Invalid ASN: ${value}`);
  return `AS${normalized}`;
}

function ispMatchesHolder(isp: string, holder: string): boolean {
  const tokens = isp.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3);
  const compactName = isp.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizedHolder = holder.toLowerCase().replace(/[^a-z0-9]/g, '');
  return tokens.some((token) => normalizedHolder.includes(token))
    || (compactName.length >= 3 && normalizedHolder.includes(compactName));
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function fetchRipeStatData(
  endpoint: string,
  resource: string,
  fetchImpl: FetchLike,
): Promise<Record<string, unknown> | null> {
  const baseUrl = (process.env.RIPESTAT_BASE_URL ?? DEFAULT_RIPESTAT_BASE_URL).replace(/\/$/, '');
  const url = new URL(`${baseUrl}/${endpoint}/data.json`);
  url.searchParams.set('resource', resource);

  for (let attempt = 0; attempt < DEFAULT_RETRIES; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { 'user-agent': 'service-assurance-ai/1.0 (+authorized-network-operations)' },
        signal: AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        const payload = await response.json() as { data?: Record<string, unknown> };
        return payload.data ?? {};
      }
      if (response.status !== 429 && response.status !== 503) return null;
    } catch {
      if (attempt === DEFAULT_RETRIES - 1) return null;
    }
    await delay(DEFAULT_RETRY_DELAY_MS * 2 ** attempt);
  }

  return null;
}

export function normalizeIspAsns(entries: IspAsn[]): IspAsn[] {
  const unique = new Map<string, IspAsn>();
  for (const entry of entries) {
    const isp = entry.isp.trim();
    if (!isp) continue;
    const asn = normalizeAsn(entry.asn);
    unique.set(`${isp.toLowerCase()}:${asn}`, {
      isp,
      asn,
      ...(entry.category?.trim() ? { category: entry.category.trim() } : {}),
    });
  }
  return [...unique.values()];
}

export async function verifyIspAsns(
  entries: IspAsn[],
  options: { fetchImpl?: FetchLike; requestDelayMs?: number } = {},
): Promise<VerifiedIspAsn[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalized = normalizeIspAsns(entries);
  const results: VerifiedIspAsn[] = [];

  for (const [index, entry] of normalized.entries()) {
    const data = await fetchRipeStatData('as-overview', entry.asn, fetchImpl);
    const holder = typeof data?.holder === 'string' ? data.holder : null;
    results.push({
      ...entry,
      holder,
      matchesListedIsp: holder ? ispMatchesHolder(entry.isp, holder) : false,
      lookupSucceeded: data !== null,
    });
    if (index < normalized.length - 1 && (options.requestDelayMs ?? 500) > 0) {
      await delay(options.requestDelayMs ?? 500);
    }
  }

  return results;
}

function prefixSize(prefix: string): { addressFamily: 'ipv4' | 'ipv6'; numAddresses: string } | null {
  const [address, rawLength] = prefix.split('/');
  const prefixLength = Number(rawLength);
  if (!address || !Number.isInteger(prefixLength)) return null;
  if (isIPv4(address) && prefixLength >= 0 && prefixLength <= 32) {
    return { addressFamily: 'ipv4', numAddresses: (2 ** (32 - prefixLength)).toString() };
  }
  if (address.includes(':') && prefixLength >= 0 && prefixLength <= 128) {
    return { addressFamily: 'ipv6', numAddresses: (2n ** BigInt(128 - prefixLength)).toString() };
  }
  return null;
}

export async function getAnnouncedPrefixes(
  entries: IspAsn[],
  options: { fetchImpl?: FetchLike; ipv4Only?: boolean; requestDelayMs?: number } = {},
): Promise<AnnouncedPrefix[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const normalized = normalizeIspAsns(entries);
  const results: AnnouncedPrefix[] = [];

  for (const [index, entry] of normalized.entries()) {
    const data = await fetchRipeStatData('announced-prefixes', entry.asn, fetchImpl);
    const prefixes = Array.isArray(data?.prefixes) ? data.prefixes : [];
    for (const item of prefixes) {
      const prefix = item && typeof item === 'object' && typeof (item as { prefix?: unknown }).prefix === 'string'
        ? (item as { prefix: string }).prefix
        : null;
      if (!prefix) continue;
      const size = prefixSize(prefix);
      if (!size || (options.ipv4Only !== false && size.addressFamily !== 'ipv4')) continue;
      results.push({ ...entry, prefix, ...size });
    }
    if (index < normalized.length - 1 && (options.requestDelayMs ?? 500) > 0) {
      await delay(options.requestDelayMs ?? 500);
    }
  }

  return results;
}

function ipv4ToNumber(address: string): number {
  return address.split('.').reduce((value, octet) => value * 256 + Number(octet), 0) >>> 0;
}

function numberToIpv4(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

export function selectPingCandidates(
  prefixes: AnnouncedPrefix[],
  options: { perPrefix?: number; minimumPrefixLength?: number; maxCandidates?: number; excludeIps?: string[] } = {},
): PingCandidate[] {
  const boundedInteger = (value: number | undefined, fallback: number, minimum: number, maximum: number) =>
    Number.isInteger(value) ? Math.max(minimum, Math.min(value as number, maximum)) : fallback;
  const perPrefix = boundedInteger(options.perPrefix, 1, 0, 10);
  const minimumPrefixLength = boundedInteger(options.minimumPrefixLength, 20, 8, 30);
  const maxCandidates = boundedInteger(options.maxCandidates, 100, 0, 1000);
  const excludeIps = new Set(options.excludeIps ?? []);
  const candidates: PingCandidate[] = [];

  for (const entry of prefixes) {
    if (candidates.length >= maxCandidates || entry.addressFamily !== 'ipv4') break;
    const [address, rawLength] = entry.prefix.split('/');
    const prefixLength = Number(rawLength);
    if (!address || !isIPv4(address) || prefixLength > minimumPrefixLength) continue;
    const hostCount = 2 ** (32 - prefixLength);
    if (hostCount < 4) continue;
    const network = Math.floor(ipv4ToNumber(address) / hostCount) * hostCount;

    // Sweep extra offsets beyond perPrefix so already-known IPs can be skipped without shrinking output.
    const maxAttempts = Math.min(hostCount - 2, perPrefix * 3 || 1);
    let picked = 0;
    for (let index = 0; index < maxAttempts && picked < perPrefix && candidates.length < maxCandidates; index += 1) {
      let offset = Math.max(1, Math.min(Math.floor(hostCount * (index + 1) / (maxAttempts + 1)), hostCount - 2));
      const lastOctet = (network + offset) % 256;
      if (lastOctet === 0 && offset < hostCount - 2) offset += 1;
      if (lastOctet === 255 && offset > 1) offset -= 1;
      const candidateIp = numberToIpv4((network + offset) >>> 0);
      if (excludeIps.has(candidateIp)) continue;
      candidates.push({
        isp: entry.isp,
        asn: entry.asn,
        ...(entry.category ? { category: entry.category } : {}),
        prefix: entry.prefix,
        candidateIp,
      });
      picked += 1;
    }
  }

  return candidates;
}

