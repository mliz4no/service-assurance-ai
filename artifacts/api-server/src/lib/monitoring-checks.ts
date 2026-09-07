import net from 'node:net';
import dns from 'node:dns';
import tls from 'node:tls';
import { isIP } from 'node:net';
import type { MonitoredTarget } from '@workspace/db';

export const MONITORING_CHECK_TYPES_LOCAL = [
  'http',
  'tcp',
  'icmp',
  'dns',
  'tls',
] as const;
export type MonitoringCheckTypeLocal = (typeof MONITORING_CHECK_TYPES_LOCAL)[number];

type CheckStatus = 'up' | 'down' | 'degraded' | 'unknown';
type CheckType = MonitoringCheckTypeLocal;

export type ProbeResult = {
  checkType: CheckType;
  status: CheckStatus;
  responseTimeMs: number | null;
  payload: Record<string, unknown>;
};

export type ProbeSafetyOutcome =
  | { allowed: true }
  | { allowed: false; reason: string };

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_TCP_PORT = 443;
const DEFAULT_DNS_RECORD_TYPE = 'A';
const DEFAULT_DNS_SERVERS: string[] = [];
const DEFAULT_ICMP_TIMEOUT_MS = 3_000;
const DEFAULT_TLS_PORT = 443;
const TLS_EXPIRE_WARN_DAYS = 14;

const PROBE_OWNERSHIP_REQUIRED =
  process.env.PROBE_REQUIRE_OWNERSHIP_VERIFICATION?.toLowerCase() !== 'false';

function envInteger(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getMaxRedirects(): number {
  return envInteger('PROBE_HTTP_MAX_REDIRECTS', 0);
}

function isPrivateOrReservedIp(ip: string): boolean {
  if (!isIP(ip)) return true;
  if (ip === '127.0.0.1' || ip.startsWith('127.')) return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('198.51.100.') || ip.startsWith('203.0.113.') || ip.startsWith('192.0.2.'))
    return true;
  if (ip.startsWith('0.')) return true;
  if (ip.startsWith('169.254.')) return true;
  if (ip === '::1' || ip === '::' || ip.startsWith('fe80:')) return true;
  if (ip.startsWith('fc') || ip.startsWith('fd')) return true;
  return false;
}

function normalizeHostOrIp(raw: string): string {
  return raw.trim().toLowerCase();
}

function stripProtocol(raw: string): string {
  return raw.replace(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, '');
}

function extractHostPort(rawUrl: string, defaultPort?: number): { host: string; port?: number } {
  const withoutProtocol = stripProtocol(rawUrl);
  const withoutPath = withoutProtocol.split('/')[0].split('?')[0];
  const bracket = withoutPath.lastIndexOf(']');
  const lastColon = withoutPath.lastIndexOf(':');
  if (bracket !== -1 && lastColon > bracket) {
    const host = withoutPath.slice(0, bracket + 1);
    const maybePort = withoutPath.slice(lastColon + 1);
    const port = maybePort ? Number(maybePort) : NaN;
    return { host, port: Number.isFinite(port) && port > 0 ? port : defaultPort };
  }
  if (bracket !== -1) {
    return { host: withoutPath, port: defaultPort };
  }
  if (lastColon !== -1) {
    const host = withoutPath.slice(0, lastColon);
    const maybePort = withoutPath.slice(lastColon + 1);
    const port = maybePort ? Number(maybePort) : NaN;
    return { host, port: Number.isFinite(port) && port > 0 ? port : defaultPort };
  }
  return { host: withoutPath, port: defaultPort };
}

function isHttpTarget(hostOrIp: string): boolean {
  return /^https?:\/\//i.test(hostOrIp);
}

function withDefaultHttpProtocol(hostOrIp: string): string {
  if (isHttpTarget(hostOrIp)) return hostOrIp;
  return `https://${hostOrIp}`;
}

async function resolveHost(host: string): Promise<string[]> {
  if (isIP(host)) return [host];
  try {
    const [a, aaaa] = await Promise.all([
      dns.promises.resolve4(host).then(
        (r) => r,
        () => [] as string[],
      ),
      dns.promises.resolve6(host).then(
        (r) => r,
        () => [] as string[],
      ),
    ]);
    return [...a, ...aaaa];
  } catch {
    const fallback = await dns.promises.lookup(host).then(
      (r) => r,
      () => null,
    );
    if (!fallback) return [];
    return [fallback.address];
  }
}

export function evaluateProbeSafety(
  target: Pick<
    MonitoredTarget,
    'hostOrIp' | 'probeAllowlisted' | 'ownershipVerifiedAt' | 'ownershipMethod'
  >,
  overrides: { resolvedIps?: string[]; checkType?: CheckType } = {},
): ProbeSafetyOutcome {
  if (PROBE_OWNERSHIP_REQUIRED && !target.ownershipVerifiedAt && !target.probeAllowlisted) {
    return {
      allowed: false,
      reason: 'Probe rejected: ownership verification or explicit allowlisting is required',
    };
  }

  const ips = overrides.resolvedIps ?? [];
  for (const ip of ips) {
    if (isPrivateOrReservedIp(ip)) {
      return {
        allowed: false,
        reason: `Probe rejected: destination resolves to private/reserved IP ${ip} (SSRF guard)`,
      };
    }
  }

  return { allowed: true };
}

async function abortableAfter<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await factory(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function probeHttp(hostOrIp: string, checkPort?: number): Promise<ProbeResult> {
  const start = Date.now();
  const timeoutMs = envInteger('PROBE_HTTP_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const baseUrl = withDefaultHttpProtocol(hostOrIp);
  const urlObj = new URL(baseUrl);
  if (checkPort && Number.isFinite(checkPort)) {
    urlObj.port = String(checkPort);
  }
  const url = urlObj.toString();
  const hostCandidate = extractHostPort(baseUrl, checkPort).host;
  let resolvedIps: string[] = [];
  try {
    resolvedIps = await resolveHost(hostCandidate);
  } catch {
    resolvedIps = [];
  }
  const safety = evaluateProbeSafety(
    {
      hostOrIp,
      probeAllowlisted: true,
      ownershipVerifiedAt: new Date(),
      ownershipMethod: 'http_challenge',
    },
    { resolvedIps, checkType: 'http' },
  );
  if (!safety.allowed) {
    return {
      checkType: 'http',
      status: 'unknown',
      responseTimeMs: Date.now() - start,
      payload: { url, error: safety.reason, blocked: true },
    };
  }

  try {
    const maxRedirects = getMaxRedirects();
    const response = await abortableAfter((signal) => fetch(url, {
      method: 'GET',
      signal,
      redirect: maxRedirects > 0 ? 'follow' : 'manual',
    }), timeoutMs);

    const elapsed = Date.now() - start;
    const finalIp = response.headers.get('x-resolved-ip') ?? resolvedIps[0] ?? null;
    if (finalIp && isPrivateOrReservedIp(finalIp)) {
      return {
        checkType: 'http',
        status: 'unknown',
        responseTimeMs: elapsed,
        payload: {
          url,
          finalIp,
          error: 'DNS rebinding guard: post-redirect IP is private/reserved',
          blocked: true,
        },
      };
    }
    const status: CheckStatus = response.ok
      ? 'up'
      : response.status >= 500
        ? 'down'
        : 'degraded';

    return {
      checkType: 'http',
      status,
      responseTimeMs: elapsed,
      payload: {
        url,
        httpStatus: response.status,
        ok: response.ok,
        resolvedIps: finalIp ? [finalIp] : resolvedIps,
      },
    };
  } catch (error) {
    const elapsed = Date.now() - start;
    return {
      checkType: 'http',
      status: 'down',
      responseTimeMs: elapsed,
      payload: {
        url,
        resolvedIps,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function probeTcp(hostOrIp: string, portOverride?: number): Promise<ProbeResult> {
  const start = Date.now();
  const timeoutMs = envInteger('PROBE_TCP_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const { host, port } = extractHostPort(hostOrIp, portOverride ?? DEFAULT_TCP_PORT);
  const resolvedIps = await resolveHost(host).catch(() => []);
  const safety = evaluateProbeSafety(
    {
      hostOrIp,
      probeAllowlisted: true,
      ownershipVerifiedAt: new Date(),
      ownershipMethod: 'explicit_approval',
    },
    { resolvedIps, checkType: 'tcp' },
  );
  if (!safety.allowed) {
    return {
      checkType: 'tcp',
      status: 'unknown',
      responseTimeMs: Date.now() - start,
      payload: { host, port, error: safety.reason, blocked: true },
    };
  }

  return new Promise((resolve) => {
    const targetIp = resolvedIps.find((ip) => !isPrivateOrReservedIp(ip)) ?? host;
    const safePort = port ?? DEFAULT_TCP_PORT;
    const socket = net.createConnection({ host: targetIp, port: safePort });
    let settled = false;

    const finish = (status: CheckStatus, payload: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      const elapsed = Date.now() - start;
      socket.destroy();
      resolve({
        checkType: 'tcp',
        status,
        responseTimeMs: elapsed,
        payload,
      });
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () =>
      finish('up', { host, resolvedHost: targetIp, port, resolvedIps }),
    );
    socket.on('timeout', () =>
      finish('down', { host, resolvedHost: targetIp, port, error: 'timeout', resolvedIps }),
    );
    socket.on('error', (error) =>
      finish('down', {
        host,
        resolvedHost: targetIp,
        port,
        error: error.message,
        resolvedIps,
      }),
    );
  });
}

async function probeIcmp(hostOrIp: string): Promise<ProbeResult> {
  const start = Date.now();
  const timeoutMs = envInteger('PROBE_ICMP_TIMEOUT_MS', DEFAULT_ICMP_TIMEOUT_MS);
  const normalized = normalizeHostOrIp(hostOrIp);
  const { host } = extractHostPort(normalized);
  const resolvedIps = await resolveHost(host).catch(() => []);
  const safety = evaluateProbeSafety(
    {
      hostOrIp,
      probeAllowlisted: true,
      ownershipVerifiedAt: new Date(),
      ownershipMethod: 'explicit_approval',
    },
    { resolvedIps, checkType: 'icmp' },
  );
  if (!safety.allowed) {
    return {
      checkType: 'icmp',
      status: 'unknown',
      responseTimeMs: Date.now() - start,
      payload: { host, error: safety.reason, blocked: true },
    };
  }

  const targetIp = resolvedIps.find((ip) => !isPrivateOrReservedIp(ip));
  if (!targetIp) {
    return {
      checkType: 'icmp',
      status: 'unknown',
      responseTimeMs: Date.now() - start,
      payload: {
        host,
        resolvedIps,
        error: 'ICMP probe aborted: no public routable resolved IP available',
      },
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: CheckStatus, payload: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      const elapsed = Date.now() - start;
      resolve({
        checkType: 'icmp',
        status,
        responseTimeMs: elapsed,
        payload: { ...payload, host, targetIp, resolvedIps },
      });
    };

    const icmpPort = 7;
    const socket = net.createConnection({ host: targetIp, port: icmpPort });
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish('up', { probeMethod: 'tcp-echo-fallback' }));
    socket.on('timeout', () =>
      finish('down', { error: 'timeout', probeMethod: 'tcp-echo-fallback' }),
    );
    socket.on('error', (error) => {
      socket.destroy();
      const isRstOrRefused =
        error.message.includes('ECONNREFUSED') || error.message.includes('ECONNRESET');
      if (isRstOrRefused) {
        finish('up', {
          note: 'Remote host responded to transport probe; ICMP echo permission is platform-restricted',
          probeMethod: 'tcp-echo-fallback',
          transportError: error.message,
        });
        return;
      }
      finish('down', {
        error: error.message,
        probeMethod: 'tcp-echo-fallback',
      });
    });
  });
}

async function probeDns(hostOrIp: string, recordTypeOverride?: string, nameservers?: string[]): Promise<ProbeResult> {
  const start = Date.now();
  const timeoutMs = envInteger('PROBE_DNS_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const normalized = normalizeHostOrIp(hostOrIp);
  const { host } = extractHostPort(normalized);
  const recordType = (recordTypeOverride ?? DEFAULT_DNS_RECORD_TYPE).toUpperCase();
  const resolver = new dns.promises.Resolver();
  const servers = (nameservers?.length ? nameservers : DEFAULT_DNS_SERVERS);
  if (servers.length) resolver.setServers(servers);

  let resolvedAnswers: unknown[] = [];
  let status: CheckStatus = 'unknown';
  let errorMsg: string | null = null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const target = host;
    switch (recordType) {
      case 'A':
        resolvedAnswers = await resolver.resolve4(target);
        break;
      case 'AAAA':
        resolvedAnswers = await resolver.resolve6(target);
        break;
      case 'CNAME':
        resolvedAnswers = await resolver.resolveCname(target);
        break;
      case 'MX':
        resolvedAnswers = await resolver.resolveMx(target);
        break;
      case 'TXT':
        resolvedAnswers = await resolver.resolveTxt(target);
        break;
      case 'NS':
        resolvedAnswers = await resolver.resolveNs(target);
        break;
      default:
        resolvedAnswers = await resolver.resolve(target, recordType as any);
    }
    status = resolvedAnswers.length > 0 ? 'up' : 'degraded';
  } catch (error) {
    status = 'down';
    errorMsg = error instanceof Error ? error.message : 'Unknown DNS error';
  } finally {
    clearTimeout(timeout);
  }

  const finalServers = resolver.getServers();
  return {
    checkType: 'dns',
    status,
    responseTimeMs: Date.now() - start,
    payload: {
      host,
      recordType,
      answers: resolvedAnswers,
      answerCount: resolvedAnswers.length,
      servers: finalServers,
      ...(errorMsg ? { error: errorMsg } : null),
    },
  };
}

async function probeTls(hostOrIp: string, portOverride?: number): Promise<ProbeResult> {
  const start = Date.now();
  const timeoutMs = envInteger('PROBE_TLS_TIMEOUT_MS', DEFAULT_TIMEOUT_MS);
  const normalized = normalizeHostOrIp(hostOrIp);
  const { host, port } = extractHostPort(normalized, portOverride ?? DEFAULT_TLS_PORT);
  const resolvedIps = await resolveHost(host).catch(() => []);
  const safety = evaluateProbeSafety(
    {
      hostOrIp,
      probeAllowlisted: true,
      ownershipVerifiedAt: new Date(),
      ownershipMethod: 'explicit_approval',
    },
    { resolvedIps, checkType: 'tls' },
  );
  if (!safety.allowed) {
    return {
      checkType: 'tls',
      status: 'unknown',
      responseTimeMs: Date.now() - start,
      payload: { host, port, error: safety.reason, blocked: true },
    };
  }
  const targetIp = resolvedIps.find((ip) => !isPrivateOrReservedIp(ip)) ?? host;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (status: CheckStatus, payload: Record<string, unknown>) => {
      if (settled) return;
      settled = true;
      const elapsed = Date.now() - start;
      socket.destroy();
      resolve({
        checkType: 'tls',
        status,
        responseTimeMs: elapsed,
        payload,
      });
    };

    const socket = tls.connect(
      {
        host: targetIp,
        port,
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        const validFrom = cert.valid_from ? new Date(cert.valid_from) : null;
        const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
        const now = new Date();
        const expiresInDays = validTo
          ? Math.max(-1, Math.ceil((validTo.getTime() - now.getTime()) / 86_400_000))
          : null;
        let status: CheckStatus = 'up';
        const issues: string[] = [];
        if (!authorized) {
          status = 'degraded';
          issues.push(`unauthorized: ${socket.authorizationError?.message ?? 'unknown'}`);
        }
        if (validFrom && now < validFrom) {
          status = 'down';
          issues.push('certificate not yet valid');
        }
        if (validTo && now > validTo) {
          status = 'down';
          issues.push('certificate expired');
        } else if (expiresInDays !== null && expiresInDays <= TLS_EXPIRE_WARN_DAYS) {
          if (status === 'up') status = 'degraded';
          issues.push(`certificate expires in ${expiresInDays} days`);
        }
        finish(status, {
          host,
          resolvedHost: targetIp,
          port,
          resolvedIps,
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: validFrom?.toISOString() ?? null,
          validTo: validTo?.toISOString() ?? null,
          expiresInDays,
          authorized,
          protocol: socket.getProtocol?.() ?? null,
          cipher: socket.getCipher?.() ?? null,
          issues,
        });
      },
    );
    socket.setTimeout(timeoutMs);
    socket.on('timeout', () =>
      finish('down', {
        host,
        resolvedHost: targetIp,
        port,
        error: 'timeout',
        resolvedIps,
      }),
    );
    socket.on('error', (error) =>
      finish('down', {
        host,
        resolvedHost: targetIp,
        port,
        error: error.message,
        resolvedIps,
      }),
    );
  });
}

function selectCheckType(target: MonitoredTarget): CheckType {
  if (
    target.preferredCheckType &&
    (MONITORING_CHECK_TYPES_LOCAL as readonly string[]).includes(target.preferredCheckType)
  ) {
    return target.preferredCheckType as CheckType;
  }
  if (target.targetType === 'service' || isHttpTarget(target.hostOrIp)) {
    return 'http';
  }
  return 'tcp';
}

export async function runProbe(target: MonitoredTarget): Promise<ProbeResult> {
  const ownershipSafety = evaluateProbeSafety(target);
  if (!ownershipSafety.allowed) {
    return {
      checkType: 'tcp',
      status: 'unknown',
      responseTimeMs: 0,
      payload: { error: ownershipSafety.reason, blocked: true },
    };
  }

  const checkType = selectCheckType(target);
  const portOverride = target.checkPort ?? undefined;
  const dnsRecordType = (target.checkConfig as any)?.dnsRecordType as string | undefined;
  const dnsServers = (target.checkConfig as any)?.dnsServers as string[] | undefined;
  const dnsQueryHost = (target.checkConfig as any)?.dnsQueryHost as string | undefined;
  switch (checkType) {
    case 'http':
      return probeHttp(target.hostOrIp, portOverride);
    case 'tcp':
      return probeTcp(target.hostOrIp, portOverride);
    case 'icmp':
      return probeIcmp(target.hostOrIp);
    case 'dns':
      return probeDns(dnsQueryHost ?? target.hostOrIp, dnsRecordType, dnsServers);
    case 'tls':
      return probeTls(target.hostOrIp, portOverride);
    default:
      return probeTcp(target.hostOrIp, portOverride);
  }
}

export function toTargetStatusUpdate(
  result: ProbeResult,
  statusSource: 'manual' | 'nagios' | 'controller' | 'synthetic' = 'synthetic',
): {
  status: CheckStatus;
  statusSource: 'manual' | 'nagios' | 'controller' | 'synthetic';
  lastCheckedAt: Date;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
} {
  const now = new Date();
  const base = {
    status: result.status,
    statusSource,
    lastCheckedAt: now,
  };

  if (result.status === 'up') {
    return {
      ...base,
      lastSuccessAt: now,
    };
  }

  if (result.status === 'down' || result.status === 'degraded') {
    return {
      ...base,
      lastFailureAt: now,
    };
  }

  return base;
}
