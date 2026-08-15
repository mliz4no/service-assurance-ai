import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('nagios adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    process.env.NAGIOS_BASE_URL = 'https://nagios.example.test';
    process.env.NAGIOS_API_TOKEN = 'token-123';
    delete process.env.NAGIOS_USERNAME;
    delete process.env.NAGIOS_PASSWORD;
  });

  afterEach(() => {
    delete process.env.NAGIOS_BASE_URL;
    delete process.env.NAGIOS_API_TOKEN;
    delete process.env.NAGIOS_USERNAME;
    delete process.env.NAGIOS_PASSWORD;
  });

  it('normalizes host and service states for matched targets', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            host: {
              list: {
                h1: {
                  host_name: '198.51.100.77',
                  current_state: 1,
                  plugin_output: 'CRITICAL - host unreachable',
                },
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            service: {
              list: {
                s1: {
                  host_name: 'edge-router-1',
                  service_description: 'service edge-router-1 latency',
                  current_state: 1,
                  plugin_output: 'WARNING - packet loss',
                },
              },
            },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const { syncNagiosChecks } = await import('../nagios');

    const checks = await syncNagiosChecks([
      {
        id: 'target-host',
        name: 'host-a',
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
      },
      {
        id: 'target-service',
        name: 'edge-router-1',
        publicLabel: null,
        hostOrIp: 'edge-router-1',
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
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('query=hostlist');
    expect(fetchMock.mock.calls[1][0]).toContain('query=servicelist');

    expect(checks).toHaveLength(2);
    const hostCheck = checks.find((c) => c.targetId === 'target-host');
    expect(hostCheck?.status).toBe('down');
    expect(hostCheck?.payload.kind).toBe('host');

    const serviceCheck = checks.find((c) => c.targetId === 'target-service');
    expect(serviceCheck?.status).toBe('degraded');
    expect(serviceCheck?.payload.kind).toBe('service');
  });

  it('returns unknown for unmatched targets', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { host: { list: {} } } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { service: { list: {} } } }) });

    vi.stubGlobal('fetch', fetchMock);

    const { syncNagiosChecks } = await import('../nagios');

    const checks = await syncNagiosChecks([
      {
        id: 'target-unmatched',
        name: 'unmatched-target',
        publicLabel: null,
        hostOrIp: 'unmatched.example.test',
        customerId: null,
        siteId: null,
        serviceId: null,
        targetType: 'hostname',
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
      },
    ]);

    expect(checks[0].status).toBe('unknown');
    expect(checks[0].payload.kind).toBe('unmatched');
  });
});
