export type ArinIspCrawlResult = {
  ispName: string;
  organizationName: string | null;
  handle: string | null;
  domain: string | null;
  homePageUrl: string | null;
  asns: string[];
  ipRanges: ArinIpRange[];
  country: string | null;
  source: 'arin-rdap';
  fetchedAt: string;
};

export type ArinIpRange = {
  handle: string | null;
  name: string | null;
  startAddress: string | null;
  endAddress: string | null;
  cidrs: string[];
};

export const DEFAULT_MAJOR_ISPS = [
  'AT&T',
  'Verizon',
  'Comcast',
  'Charter',
  'Lumen',
  'Cox',
  'Frontier',
  'Zayo',
] as const;

type ArinRdapEntity = {
  handle?: string;
  name?: string;
  roles?: string[];
  port43?: string;
  remarks?: Array<{ description?: string }>;
  events?: Array<{ eventAction?: string; eventDate?: string }>;
  network?: { handle?: string; name?: string; originASes?: string[] };
  entities?: ArinRdapEntity[];
  links?: Array<{ href?: string; value?: string; rel?: string }>;
  publicIds?: Array<{ type?: string; identifier?: string }>;
  vcardArray?: [string, Array<[string, Record<string, unknown>, string, unknown]>];
};

type ArinSearchResponse = {
  handle?: string;
  name?: string;
  entities?: ArinRdapEntity[];
  networks?: Array<{ handle?: string; name?: string; originASes?: string[] }>;
  results?: ArinSearchResponse[];
  entitySearchResults?: ArinSearchResponse[];
  objects?: Record<string, ArinSearchResponse>;
};

type ArinCidr = { v4prefix?: string; v6prefix?: string; length?: number };

const ISP_DOMAIN_HINTS: Record<string, string[]> = {
  'at&t': ['att.com'],
  verizon: ['verizon.com'],
  comcast: ['comcast.com', 'xfinity.com'],
  spectrum: ['spectrum.com'],
  lumen: ['lumen.com'],
  zayo: ['zayo.com'],
  cox: ['cox.com'],
  frontier: ['frontier.com'],
  charter: ['charter.com'],
};

function normalizeDomain(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/$/, '');
  if (!trimmed || trimmed.includes(' ')) return null;
  const hostname = trimmed.replace(/^www\./i, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}(\.[a-z]{2,})?$/i.test(hostname) ? hostname : null;
}

function parseIspName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeList(input: string | string[] | null | undefined): string[] {
  const values = Array.isArray(input) ? input : input ? [input] : [];
  return [...new Set(values.map((value) => parseIspName(value)).filter(Boolean))];
}

function dedupe<T>(values: T[]): T[] {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ''))];
}

function extractAsnsFromValue(value: unknown): string[] {
  if (!value) return [];

  const asns: string[] = [];
  const visit = (node: unknown): void => {
    if (!node) return;

    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    if (typeof node !== 'object') return;

    for (const [key, item] of Object.entries(node as Record<string, unknown>)) {
      const keyLower = key.toLowerCase();

      if (typeof item === 'string') {
        const normalized = item.trim().toUpperCase();
        if (/^AS\d+$/i.test(normalized)) {
          asns.push(normalized);
        }
        if (keyLower === 'identifier' && /^AS\d+$/i.test(normalized)) {
          asns.push(normalized);
        }
      }

      if (keyLower.includes('asn') && typeof item === 'string') {
        asns.push(item.trim().toUpperCase());
      }

      if (keyLower.includes('org') && typeof item === 'string' && /^AS\d+$/i.test(item.trim())) {
        asns.push(item.trim().toUpperCase());
      }

      if (item && typeof item === 'object') {
        visit(item);
      }
    }
  };

  visit(value);
  return dedupe(asns.map((item) => item.trim().toUpperCase()).filter((item) => /^AS\d+$/i.test(item)));
}

function extractCandidateDomains(name: string, rawEntity: ArinRdapEntity | null | undefined): string[] {
  const entries = new Set<string>();
  const source = (name || '').trim().toLowerCase();

  const hintList = ISP_DOMAIN_HINTS[source] ?? [];
  for (const hint of hintList) entries.add(hint);

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (typeof value === 'string') {
        const text = value.trim();
        const normalized = normalizeDomain(text);
        if (normalized) {
          entries.add(normalized);
        }
        if (key === 'href' || key === 'value') {
          try {
            const parsed = new URL(text);
            if (parsed.hostname) {
              const normalizedHostname = normalizeDomain(parsed.hostname);
              if (normalizedHostname) entries.add(normalizedHostname);
            }
          } catch {
            // ignore non-URL strings
          }
        }
      }
      if (value && typeof value === 'object') visit(value);
    }
  };

  visit(rawEntity);

  const configured = (process.env.ARIN_ALLOWED_DOMAINS || '')
    .split(',')
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);
  for (const domain of configured) entries.add(domain);

  return [...entries].filter((domain) => domain && !domain.includes('arin.net')).slice(0, 12);
}

function extractVcardName(entity: ArinRdapEntity | null | undefined): string | null {
  const properties = entity?.vcardArray?.[1];
  if (!Array.isArray(properties)) return null;
  const fn = properties.find((property) => property[0] === 'fn')?.[3];
  const org = properties.find((property) => property[0] === 'org')?.[3];
  const value = [fn, org].find((entry) => typeof entry === 'string' && entry.trim());
  return typeof value === 'string' ? value.trim() : null;
}

function extractOrganizationName(entity: ArinRdapEntity | null | undefined): string | null {
  if (!entity) return null;
  const candidates = [extractVcardName(entity), entity.name, entity.handle, entity.port43];
  for (const candidate of candidates) {
    if (candidate && candidate.trim()) return candidate.trim();
  }
  return null;
}

function flattenArinObjects(node: unknown): ArinRdapEntity[] {
  if (!node || typeof node !== 'object') return [];

  const results: ArinRdapEntity[] = [];
  const seen = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;

    const objectValue = value as Record<string, unknown>;
    const handle = typeof objectValue.handle === 'string' ? objectValue.handle : null;
    const name = typeof objectValue.name === 'string' ? objectValue.name : null;
    if ((handle || name) && !seen.has(`${handle ?? ''}:${name ?? ''}`)) {
      seen.add(`${handle ?? ''}:${name ?? ''}`);
      results.push(objectValue as ArinRdapEntity);
    }

    for (const item of Object.values(objectValue)) {
      if (item && typeof item === 'object') visit(item);
    }
  };

  visit(node);
  return results;
}

async function fetchArinResults(ispName: string): Promise<ArinSearchResponse[]> {
  const baseUrl = (process.env.ARIN_RDAP_BASE_URL ?? 'https://rdap.arin.net/registry').replace(/\/$/, '');
  // ARIN RDAP has no generic /search route; entity name search lives at /entities?fn=<name>*
  const url = `${baseUrl}/entities?fn=${encodeURIComponent(ispName)}*`;

  const response = await fetch(url, {
    headers: {
      accept: 'application/rdap+json, application/json',
      'user-agent': 'service-assurance-ai/1.0 (+internal-authorized-lookup)',
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as ArinSearchResponse;
  const entitySearchResults = payload.entitySearchResults?.length ? payload.entitySearchResults : [];
  const directResults = payload.results?.length ? payload.results : [];
  const nested = payload.entities?.length ? payload.entities : [];
  const objectValues = payload.objects ? Object.values(payload.objects) : [];

  return [...entitySearchResults, ...directResults, ...nested, ...objectValues];
}

type ArinAutnumSearchResponse = {
  autnumSearchResults?: Array<{ handle?: string; name?: string; startAutnum?: number; endAutnum?: number }>;
};

// Entity search rarely surfaces ASN references, so ASNs are resolved via the dedicated autnum name search.
async function fetchArinAutnumAsns(ispName: string): Promise<string[]> {
  const baseUrl = (process.env.ARIN_RDAP_BASE_URL ?? 'https://rdap.arin.net/registry').replace(/\/$/, '');
  const url = `${baseUrl}/autnums?name=${encodeURIComponent(ispName)}*`;

  const response = await fetch(url, {
    headers: {
      accept: 'application/rdap+json, application/json',
      'user-agent': 'service-assurance-ai/1.0 (+internal-authorized-lookup)',
    },
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as ArinAutnumSearchResponse;
  return dedupe(
    (payload.autnumSearchResults ?? [])
      .map((entry) => entry.handle?.trim().toUpperCase())
      .filter((handle): handle is string => !!handle && /^AS\d+$/.test(handle)),
  );
}

function extractIpRanges(value: unknown): ArinIpRange[] {
  const ranges = new Map<string, ArinIpRange>();

  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }

    const record = node as Record<string, unknown>;
    const cidrEntries = Array.isArray(record.cidr0_cidrs)
      ? (record.cidr0_cidrs as ArinCidr[])
      : [];
    const cidrs = cidrEntries.flatMap((entry) => {
      const prefix = entry.v4prefix ?? entry.v6prefix;
      return prefix && Number.isInteger(entry.length) ? [`${prefix}/${entry.length}`] : [];
    });
    const startAddress = typeof record.startAddress === 'string' ? record.startAddress : null;
    const endAddress = typeof record.endAddress === 'string' ? record.endAddress : null;

    if (cidrs.length > 0 || startAddress || endAddress) {
      const range = {
        handle: typeof record.handle === 'string' ? record.handle : null,
        name: typeof record.name === 'string' ? record.name : null,
        startAddress,
        endAddress,
        cidrs,
      };
      const key = `${range.handle ?? ''}:${startAddress ?? ''}:${endAddress ?? ''}:${cidrs.join(',')}`;
      ranges.set(key, range);
    }

    for (const item of Object.values(record)) visit(item);
  };

  visit(value);
  return [...ranges.values()];
}

async function fetchArinNetworks(asns: string[]): Promise<ArinIpRange[]> {
  const baseUrl = (process.env.ARIN_WHOIS_BASE_URL ?? 'https://whois.arin.net/rest').replace(/\/$/, '');
  const ranges: ArinIpRange[] = [];

  for (const asn of asns.slice(0, 25)) {
    try {
      const response = await fetch(`${baseUrl}/nets;q=${encodeURIComponent(asn)}?showDetails=true`, {
        headers: {
          accept: 'application/json',
          'user-agent': 'service-assurance-ai/1.0 (+internal-authorized-lookup)',
        },
      });
      if (response.ok) ranges.push(...extractIpRanges(await response.json()));
    } catch {
      // Preserve ISP/ASN discovery when network range enrichment is unavailable.
    }
  }

  return ranges.filter((range, index, all) =>
    all.findIndex((candidate) => JSON.stringify(candidate) === JSON.stringify(range)) === index,
  );
}

export async function crawlArinIspList(input: string | string[] | null | undefined): Promise<ArinIspCrawlResult[]> {
  const ispNames = normalizeList(input);
  if (ispNames.length === 0) {
    return [];
  }

  const results: ArinIspCrawlResult[] = [];

  for (const ispName of ispNames) {
    const [matches, autnumAsns] = await Promise.all([
      fetchArinResults(ispName),
      fetchArinAutnumAsns(ispName),
    ]);
    const bestMatch =
      matches.find((match) => extractVcardName(match)) ?? matches.find((match) => match.name) ?? matches[0] ?? null;
    const entityAsns = matches.flatMap((match) => extractAsnsFromValue(match));
    const asns = dedupe([...autnumAsns, ...entityAsns]);

    if (!bestMatch && asns.length === 0) {
      const fallbackDomain = ISP_DOMAIN_HINTS[ispName.toLowerCase()]?.[0] ?? null;
      if (fallbackDomain) {
        results.push({
          ispName,
          organizationName: ispName,
          handle: null,
          domain: fallbackDomain,
          homePageUrl: `https://${fallbackDomain}`,
          asns: [],
          ipRanges: [],
          country: null,
          source: 'arin-rdap',
          fetchedAt: new Date().toISOString(),
        });
      }
      continue;
    }

    const organizationName = extractOrganizationName(bestMatch) ?? ispName;
    const domains = dedupe(extractCandidateDomains(organizationName, bestMatch));
    const ipRanges = await fetchArinNetworks(asns);
    const homePage = domains[0] ? `https://${domains[0]}` : null;

    results.push({
      ispName,
      organizationName,
      handle: bestMatch?.handle ?? null,
      domain: domains[0] ?? null,
      homePageUrl: homePage,
      asns,
      ipRanges,
      country: null,
      source: 'arin-rdap',
      fetchedAt: new Date().toISOString(),
    });
  }

  for (const result of results) {
    if (!result.homePageUrl || !result.domain) continue;

    try {
      const response = await fetch(result.homePageUrl, {
        method: 'GET',
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'service-assurance-ai/1.0 (+internal-authorized-lookup)',
        },
      });

      if (response.ok) {
        result.homePageUrl = result.homePageUrl;
      }
    } catch {
      // Ignore individual crawl failures and preserve the ARIN-derived destination metadata.
    }
  }

  return results;
}

export function parseArinIspCrawlTargets(raw: unknown): string[] {
  if (typeof raw === 'string') return normalizeList(raw);
  if (Array.isArray(raw)) return normalizeList(raw);
  if (raw && typeof raw === 'object') {
    const entries = Array.isArray((raw as Record<string, unknown>).isps)
      ? ((raw as Record<string, unknown>).isps as unknown[])
      : Object.values(raw as Record<string, unknown>);
    return normalizeList(entries.map((entry) => String(entry)).filter(Boolean));
  }
  return [];
}

export function getArinCrawlBaseUrl(): string {
  return (process.env.ARIN_RDAP_BASE_URL ?? 'https://rdap.arin.net/registry').replace(/\/$/, '');
}
