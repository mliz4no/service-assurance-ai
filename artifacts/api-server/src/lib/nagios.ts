import type { MonitoredTarget } from '@workspace/db';

type CheckStatus = 'up' | 'down' | 'degraded' | 'unknown';
type CheckType = 'http' | 'tcp';

type NagiosHostStatus = {
  host_name?: string;
  display_name?: string;
  address?: string;
  current_state?: number;
  plugin_output?: string;
  status_text?: string;
};

type NagiosServiceStatus = {
  host_name?: string;
  service_description?: string;
  display_name?: string;
  current_state?: number;
  plugin_output?: string;
  status_text?: string;
};

type NagiosStatusEnvelope<T> = {
  data?: {
    service?: { list?: Record<string, T> };
    host?: { list?: Record<string, T> };
  };
};

export type NagiosNormalizedCheck = {
  targetId: string;
  source: 'nagios';
  checkType: CheckType;
  status: CheckStatus;
  responseTimeMs: number | null;
  payload: Record<string, unknown>;
};

function getNagiosHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  const apiToken = process.env.NAGIOS_API_TOKEN?.trim();
  if (apiToken) {
    headers.Authorization = `Bearer ${apiToken}`;
    return headers;
  }

  const username = process.env.NAGIOS_USERNAME?.trim();
  const password = process.env.NAGIOS_PASSWORD?.trim();
  if (username && password) {
    headers.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  }

  return headers;
}

function getNagiosBaseUrl(): string {
  const baseUrl = process.env.NAGIOS_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error('NAGIOS_BASE_URL is required for Nagios sync');
  }
  return baseUrl.replace(/\/$/, '');
}

function mapNagiosState(state: number | undefined, kind: 'host' | 'service'): CheckStatus {
  if (state === 0) return 'up';
  if (kind === 'service' && state === 1) return 'degraded';
  if (state === 2) return 'down';
  if (state === 1) return 'down';
  return 'unknown';
}

function matchesHost(target: MonitoredTarget, host: NagiosHostStatus): boolean {
  const candidates = [host.host_name, host.display_name, host.address]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const needle = target.hostOrIp.toLowerCase();
  return candidates.includes(needle);
}

function matchesService(target: MonitoredTarget, service: NagiosServiceStatus): boolean {
  const hostCandidates = [service.host_name, service.display_name]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.toLowerCase());
  const targetNeedle = target.hostOrIp.toLowerCase();

  if (hostCandidates.includes(targetNeedle)) return true;

  const serviceDescription = service.service_description?.toLowerCase();
  if (!serviceDescription) return false;
  return serviceDescription.includes(target.name.toLowerCase()) || serviceDescription.includes(targetNeedle);
}

async function fetchNagiosHostStatuses(): Promise<NagiosHostStatus[]> {
  const response = await fetch(`${getNagiosBaseUrl()}/statusjson.cgi?query=hostlist`, {
    headers: getNagiosHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Nagios host status fetch failed with ${response.status}`);
  }

  const json = (await response.json()) as NagiosStatusEnvelope<NagiosHostStatus>;
  return Object.values(json.data?.host?.list ?? {});
}

async function fetchNagiosServiceStatuses(): Promise<NagiosServiceStatus[]> {
  const response = await fetch(`${getNagiosBaseUrl()}/statusjson.cgi?query=servicelist`, {
    headers: getNagiosHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Nagios service status fetch failed with ${response.status}`);
  }

  const json = (await response.json()) as NagiosStatusEnvelope<NagiosServiceStatus>;
  return Object.values(json.data?.service?.list ?? {});
}

export async function syncNagiosChecks(targets: MonitoredTarget[]): Promise<NagiosNormalizedCheck[]> {
  const start = Date.now();
  const [hosts, services] = await Promise.all([fetchNagiosHostStatuses(), fetchNagiosServiceStatuses()]);

  return targets.map((target) => {
    const matchedService = services.find((service) => matchesService(target, service));
    const matchedHost = hosts.find((host) => matchesHost(target, host));
    const elapsed = Date.now() - start;

    if (matchedService) {
      return {
        targetId: target.id,
        source: 'nagios',
        checkType: target.targetType === 'service' ? 'http' : 'tcp',
        status: mapNagiosState(matchedService.current_state, 'service'),
        responseTimeMs: elapsed,
        payload: {
          kind: 'service',
          hostName: matchedService.host_name ?? null,
          serviceDescription: matchedService.service_description ?? null,
          pluginOutput: matchedService.plugin_output ?? matchedService.status_text ?? null,
          rawState: matchedService.current_state ?? null,
        },
      };
    }

    if (matchedHost) {
      return {
        targetId: target.id,
        source: 'nagios',
        checkType: target.targetType === 'service' ? 'http' : 'tcp',
        status: mapNagiosState(matchedHost.current_state, 'host'),
        responseTimeMs: elapsed,
        payload: {
          kind: 'host',
          hostName: matchedHost.host_name ?? matchedHost.display_name ?? null,
          address: matchedHost.address ?? null,
          pluginOutput: matchedHost.plugin_output ?? matchedHost.status_text ?? null,
          rawState: matchedHost.current_state ?? null,
        },
      };
    }

    return {
      targetId: target.id,
      source: 'nagios',
      checkType: target.targetType === 'service' ? 'http' : 'tcp',
      status: 'unknown',
      responseTimeMs: elapsed,
      payload: {
        kind: 'unmatched',
        message: 'No Nagios host or service matched this target',
      },
    };
  });
}