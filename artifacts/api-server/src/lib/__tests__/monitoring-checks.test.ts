import { beforeEach, describe, expect, it, vi } from 'vitest';

const execFileMock = vi.hoisted(() => vi.fn());
const reverseMock = vi.hoisted(() => vi.fn());

vi.mock('node:child_process', () => ({
  execFile: execFileMock,
}));

vi.mock('node:util', () => ({
  promisify: () => execFileMock,
}));

vi.mock('node:dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:dns')>();
  return {
    ...actual,
    default: {
      ...actual,
      promises: {
        ...actual.promises,
        reverse: reverseMock,
      },
    },
  };
});

vi.mock('node:net', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:net')>();
  return {
    ...actual,
    default: {
      ...actual,
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
      expect(host).toBe('8.8.8.8');
      expect(port).toBe(443);
      return socket;
      }),
    },
  };
});

describe('monitoring checks helpers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    execFileMock.mockReset();
    reverseMock.mockReset();
  });

  const baseTarget = {
    preferredCheckType: null,
    checkPort: null,
    checkConfig: null,
    ownershipVerifiedAt: null,
    ownershipMethod: null,
    ownershipVerificationValue: null,
    probeAllowlisted: true,
    probeCadenceSeconds: null,
  } as const;

  it('rejects probes without ownership verification by default', async () => {
    const { evaluateProbeSafety } = await import('../monitoring-checks');

    expect(
      evaluateProbeSafety({
        hostOrIp: 'example.test',
        ownershipVerifiedAt: null,
        ownershipMethod: null,
        probeAllowlisted: false,
      }),
    ).toEqual({
      allowed: false,
      reason: 'Probe rejected: ownership verification or explicit allowlisting is required',
    });
  });

  it('allows ownership-verified probes', async () => {
    const { evaluateProbeSafety } = await import('../monitoring-checks');

    expect(
      evaluateProbeSafety({
        hostOrIp: 'example.test',
        ownershipVerifiedAt: new Date(),
        ownershipMethod: 'dns_txt',
        probeAllowlisted: false,
      }),
    ).toEqual({ allowed: true });
  });

  it('uses HTTP probing for service targets and defaults protocol to https', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Map<string, string>(),
    });
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
      ...baseTarget,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOpts] = fetchMock.mock.calls[0];
    expect(callUrl).toContain('example.test');
    expect(callOpts).toMatchObject({ method: 'GET' });
    expect(result.checkType).toBe('http');
    expect(result.status).toBe('up');
  });

  it('uses TCP probing for non-service host targets', async () => {
    const { runProbe } = await import('../monitoring-checks');

    const result = await runProbe({
      id: 'target-2',
      name: 'tcp-target',
      publicLabel: null,
      hostOrIp: '8.8.8.8',
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
      ...baseTarget,
    });

    expect(result.checkType).toBe('tcp');
    expect(result.status).toBe('up');
  });

  it('uses system ping and performs reverse DNS after an ICMP response', async () => {
    execFileMock.mockResolvedValue({ stdout: 'reply', stderr: '' });
    reverseMock.mockResolvedValue(['router.example.net']);
    const { runProbe } = await import('../monitoring-checks');

    const result = await runProbe({
      id: 'target-icmp-up',
      name: 'icmp-target',
      publicLabel: null,
      hostOrIp: '8.8.8.8',
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
      ...baseTarget,
      preferredCheckType: 'icmp',
    });

    expect(result.status).toBe('up');
    expect(result.payload).toMatchObject({
      targetIp: '8.8.8.8',
      reverseDns: ['router.example.net'],
      probeMethod: 'system-ping',
    });
    expect(reverseMock).toHaveBeenCalledWith('8.8.8.8');
  });

  it('keeps a failed ping unknown for 24 hours from the first failure', async () => {
    execFileMock.mockRejectedValue(new Error('timeout'));
    const { runProbe } = await import('../monitoring-checks');

    const result = await runProbe({
      id: 'target-icmp-down',
      name: 'icmp-target',
      publicLabel: null,
      hostOrIp: '8.8.4.4',
      customerId: null,
      siteId: null,
      serviceId: null,
      targetType: 'ip',
      provider: null,
      region: null,
      latitude: null,
      longitude: null,
      status: 'down',
      statusSource: 'synthetic',
      isPublic: false,
      lastCheckedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...baseTarget,
      preferredCheckType: 'icmp',
    });

    expect(result.status).toBe('unknown');
    expect(result.payload).toMatchObject({
      retryEligible: true,
      probeMethod: 'system-ping',
    });
    expect(Date.parse(String(result.payload.retryUntil)) - Date.parse(String(result.payload.retryStartedAt)))
      .toBe(24 * 60 * 60 * 1_000);
    expect(reverseMock).not.toHaveBeenCalled();
  });

  it('marks a failed ping down after its 24-hour grace period expires', async () => {
    execFileMock.mockRejectedValue(new Error('timeout'));
    const { runProbe } = await import('../monitoring-checks');

    const result = await runProbe({
      id: 'target-icmp-expired',
      name: 'icmp-target',
      publicLabel: null,
      hostOrIp: '8.8.4.4',
      customerId: null,
      siteId: null,
      serviceId: null,
      targetType: 'ip',
      provider: null,
      region: null,
      latitude: null,
      longitude: null,
      status: 'unknown',
      statusSource: 'synthetic',
      isPublic: false,
      lastCheckedAt: null,
      lastSuccessAt: null,
      lastFailureAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...baseTarget,
      preferredCheckType: 'icmp',
      checkConfig: { icmpRetryStartedAt: '2020-01-01T00:00:00.000Z' },
    });

    expect(result.status).toBe('down');
    expect(result.payload).toMatchObject({ retryEligible: false });
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