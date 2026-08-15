import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:net', () => ({
  default: {
    createConnection: vi.fn(({ host, port }: { host: string; port: number }) => {
      const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
      const socket = {
        setTimeout: vi.fn(),
        on(event: string, handler: (...args: unknown[]) => void) {
          const current = listeners.get(event) ?? [];
          current.push(handler);
          listeners.set(event, current);
          if (event === 'connect') {
            queueMicrotask(() => {
              for (const cb of listeners.get('connect') ?? []) cb();
            });
          }
          return socket;
        },
        destroy: vi.fn(),
      };
      expect(host).toBe('198.51.100.77');
      expect(port).toBe(443);
      return socket;
    }),
  },
}));

describe('monitoring checks helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  it('uses HTTP probing for service targets and defaults protocol to https', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);

    const { runProbe } = await import('../monitoring-checks');

    const result = await runProbe({
      id: 'target-1',
      name: 'service-target',
      publicLabel: null,
      hostOrIp: 'example.test',
      customerId: null,
      siteId: null,
      serviceId: null,
      targetType: 'service',
      provider: null,
      region: null,
      latitude: null,
      longitude: null,
      status: 'unknown',
      statusSource: 'manual',
      isPublic: false,
      lastCheckedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.test',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(result.checkType).toBe('http');
    expect(result.status).toBe('up');
  });

  it('uses TCP probing for non-service host targets', async () => {
    const { runProbe } = await import('../monitoring-checks');

    const result = await runProbe({
      id: 'target-2',
      name: 'tcp-target',
      publicLabel: null,
      hostOrIp: '198.51.100.77',
      customerId: null,
      siteId: null,
      serviceId: null,
      targetType: 'ip',
      provider: null,
      region: null,
      latitude: null,
      longitude: null,
      status: 'unknown',
      statusSource: 'manual',
      isPublic: false,
      lastCheckedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(result.checkType).toBe('tcp');
    expect(result.status).toBe('up');
  });

  it('rolls status timestamps based on probe status and source', async () => {
    const { toTargetStatusUpdate } = await import('../monitoring-checks');

    const success = toTargetStatusUpdate(
      { checkType: 'http', status: 'up', responseTimeMs: 10, payload: {} },
      'nagios',
    );
    expect(success.statusSource).toBe('nagios');
    expect(success.lastCheckedAt).toBeInstanceOf(Date);
    expect(success.lastSuccessAt).toBeInstanceOf(Date);
    expect(success.lastFailureAt).toBeUndefined();

    const failure = toTargetStatusUpdate(
      { checkType: 'tcp', status: 'down', responseTimeMs: 11, payload: {} },
      'synthetic',
    );
    expect(failure.statusSource).toBe('synthetic');
    expect(failure.lastFailureAt).toBeInstanceOf(Date);
    expect(failure.lastSuccessAt).toBeUndefined();
  });
});