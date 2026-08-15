import net from 'node:net';
import type { MonitoredTarget } from '@workspace/db';

type CheckStatus = 'up' | 'down' | 'degraded' | 'unknown';
type CheckType = 'http' | 'tcp';

export type ProbeResult = {
  checkType: CheckType;
  status: CheckStatus;
  responseTimeMs: number | null;
  payload: Record<string, unknown>;
};

function isHttpTarget(hostOrIp: string): boolean {
  return hostOrIp.startsWith('http://') || hostOrIp.startsWith('https://');
}

function withDefaultHttpProtocol(hostOrIp: string): string {
  if (isHttpTarget(hostOrIp)) return hostOrIp;
  return `https://${hostOrIp}`;
}

async function probeHttp(hostOrIp: string): Promise<ProbeResult> {
  const start = Date.now();
  const url = withDefaultHttpProtocol(hostOrIp);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const elapsed = Date.now() - start;
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
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function probeTcp(hostOrIp: string): Promise<ProbeResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    const socket = net.createConnection({ host: hostOrIp, port: 443 });
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

    socket.setTimeout(5000);

    socket.on('connect', () => finish('up', { host: hostOrIp, port: 443 }));
    socket.on('timeout', () => finish('down', { host: hostOrIp, port: 443, error: 'timeout' }));
    socket.on('error', (error) => {
      finish('down', {
        host: hostOrIp,
        port: 443,
        error: error.message,
      });
    });
  });
}

export async function runProbe(target: MonitoredTarget): Promise<ProbeResult> {
  if (target.targetType === 'service' || isHttpTarget(target.hostOrIp)) {
    return probeHttp(target.hostOrIp);
  }
  return probeTcp(target.hostOrIp);
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