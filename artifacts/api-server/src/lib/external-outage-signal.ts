export type ExternalOutageSignal = {
  active: boolean;
  source: 'poweroutage';
  incidentId: string | null;
  summary: string | null;
  region: string | null;
  provider: string | null;
};

type ExternalSignalResponse = {
  active?: boolean;
  incidentId?: string;
  summary?: string;
  data?: {
    active?: boolean;
    incidentId?: string;
    summary?: string;
  };
  incidents?: Array<{
    id?: string;
    summary?: string;
    active?: boolean;
    status?: string;
  }>;
};

function getBaseUrl(): string | null {
  const value = process.env.POWER_OUTAGE_API_BASE_URL?.trim();
  if (!value) return null;
  return value.replace(/\/$/, '');
}

function parseSignalPayload(
  payload: ExternalSignalResponse,
  region: string | null,
  provider: string | null,
): ExternalOutageSignal {
  const firstIncident = payload.incidents?.find(
    (incident) => incident.active === true || incident.status?.toLowerCase() === 'active',
  );

  const active =
    payload.active ??
    payload.data?.active ??
    Boolean(firstIncident);

  return {
    active,
    source: 'poweroutage',
    incidentId: payload.incidentId ?? payload.data?.incidentId ?? firstIncident?.id ?? null,
    summary: payload.summary ?? payload.data?.summary ?? firstIncident?.summary ?? null,
    region,
    provider,
  };
}

export async function lookupExternalOutageSignal(input: {
  region?: string | null;
  provider?: string | null;
}): Promise<ExternalOutageSignal | null> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;

  const region = input.region?.trim() ?? null;
  const provider = input.provider?.trim() ?? null;

  if (!region && !provider) return null;

  const url = new URL(`${baseUrl}/signals`);
  if (region) url.searchParams.set('region', region);
  if (provider) url.searchParams.set('provider', provider);

  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = process.env.POWER_OUTAGE_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) return null;

  const payload = (await response.json()) as ExternalSignalResponse;
  return parseSignalPayload(payload, region, provider);
}
