import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Controller } from '@workspace/db';
import { createConnector, FortinetConnector, PaloAltoConnector, SdWanConnector } from '..';

function response(body: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => body } as Response;
}

function controller(vendor: Controller['vendor']): Controller {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Expanded connector test',
    vendor,
    type: vendor === 'sdwan' ? 'sdwan' : 'firewall_manager',
    baseUrl: 'https://controller.example.test',
    authType: 'api_key',
    apiKeyEncryptedOrPlaceholder: 'placeholder',
    organizationIdOrTenant: 'test-tenant',
    pollingEnabled: false,
    pollingIntervalSeconds: 300,
    lastPolledAt: null,
    lastPollStatus: null,
    lastPollMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('expanded controller connectors', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('creates Palo Alto and SD-WAN connectors through the factory', () => {
    expect(createConnector(controller('palo_alto'))).toBeInstanceOf(PaloAltoConnector);
    expect(createConnector(controller('sdwan'))).toBeInstanceOf(SdWanConnector);
  });

  it('returns normalized demo data for both vendors', async () => {
    const paloAlto = createConnector(controller('palo_alto'))!;
    const sdwan = createConnector(controller('sdwan'))!;

    const [paloResult, sdwanResult] = await Promise.all([paloAlto.fullSync(), sdwan.fullSync()]);
    expect(paloResult.devices[0]).toMatchObject({ deviceType: 'firewall', vendor: 'Palo Alto Networks' });
    expect(paloResult.links[0].status).toBe('up');
    expect(paloResult.events[0].eventSource).toBe('palo_alto');
    expect(sdwanResult.devices[0]).toMatchObject({ deviceType: 'sdwan_edge', status: 'online' });
    expect(sdwanResult.links[0].linkType).toBe('mpls');
    expect(sdwanResult.events[0].category).toBe('transport');
  });

  it('normalizes Panorama JSON responses and sends the API key', async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('/Devices/Firewalls')) return Promise.resolve(response({ result: { entry: [{ serial: 'PA-1', hostname: 'edge-pa', connected: 'yes', 'ha-state': 'active' }] } }));
      if (url.includes('/EthernetInterfaces')) return Promise.resolve(response({ result: { entry: [{ '@name': 'ethernet1/1', serial: 'PA-1', status: 'down' }] } }));
      if (url.includes('/Logs/System')) return Promise.resolve(response({ result: { entry: [{ seqno: 'evt-1', severity: 'critical', event: 'HA peer lost', serial: 'PA-1' }] } }));
      return Promise.resolve(response({ result: { entry: [] } }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const connector = new PaloAltoConnector({ apiKey: 'pan-key', baseUrl: 'https://panorama.test' });

    await expect(connector.testConnection()).resolves.toEqual({ ok: true, message: 'Palo Alto connection successful' });
    const result = await connector.fullSync();
    expect(result.devices[0]).toMatchObject({ controllerDeviceId: 'PA-1', hostname: 'edge-pa', haState: 'active' });
    expect(result.links[0]).toMatchObject({ controllerDeviceId: 'PA-1', status: 'down' });
    expect(result.events[0]).toMatchObject({ rawEventId: 'evt-1', severity: 'critical' });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ 'X-PAN-KEY': 'pan-key' });
  });

  it('normalizes SD-WAN responses and sends bearer authentication', async () => {
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes('/devices')) return Promise.resolve(response({ devices: [{ id: 'edge-1', name: 'branch-1', status: 'degraded', model: 'Edge 500' }] }));
      if (url.includes('/links')) return Promise.resolve(response({ links: [{ id: 'link-1', deviceId: 'edge-1', name: 'Broadband', status: 'up', transport: 'internet', latencyMs: 12 }] }));
      return Promise.resolve(response({ events: [{ id: 'evt-2', deviceId: 'edge-1', severity: 'high', type: 'loss', title: 'Packet loss' }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const connector = new SdWanConnector({ apiKey: 'sdwan-token', baseUrl: 'https://sdwan.test' });

    await expect(connector.testConnection()).resolves.toEqual({ ok: true, message: 'SD-WAN connection successful' });
    const result = await connector.fullSync();
    expect(result.devices[0]).toMatchObject({ controllerDeviceId: 'edge-1', status: 'degraded' });
    expect(result.links[0]).toMatchObject({ linkType: 'sdwan_transport', latencyMs: 12 });
    expect(result.events[0]).toMatchObject({ rawEventId: 'evt-2', severity: 'high' });
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: 'Bearer sdwan-token' });
  });

  it('normalizes live FortiGate devices, WAN health, and system events', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url.includes('/system/status')) return Promise.resolve(response({ results: { hostname: 'FG-LIVE', serial: 'FGT-001', model: 'FortiGate 80F' } }));
      if (url.includes('/ha-statistics')) return Promise.resolve(response({ results: { members: [{ hostname: 'FG-LIVE', role: 'primary' }] } }));
      if (url.includes('/system/interface')) return Promise.resolve(response({ results: { wan1: { alias: 'Primary DIA', role: 'wan', link: true } } }));
      if (url.includes('/health-check')) return Promise.resolve(response({ results: { internet: { members: [{ interface: 'wan1', status: 'degraded', latency: 88, jitter: 12, packet_loss: 4 }] } } }));
      return Promise.resolve(response({ results: [{ logid: 'forti-event-1', level: 'warning', subtype: 'sdwan', msg: 'WAN quality degraded', serial: 'FGT-001', eventtime: '2026-08-15T12:00:00Z' }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const connector = new FortinetConnector({ apiKey: 'fortigate-token', baseUrl: 'https://fortigate.test', managerType: 'fortigate' });

    const result = await connector.fullSync();
    expect(result.errors).toEqual([]);
    expect(result.devices[0]).toMatchObject({ controllerDeviceId: 'FGT-001', hostname: 'FG-LIVE', haState: 'active' });
    expect(result.links[0]).toMatchObject({ controllerDeviceId: 'FGT-001', linkName: 'Primary DIA', status: 'degraded', latencyMs: 88 });
    expect(result.events[0]).toMatchObject({ rawEventId: 'forti-event-1', severity: 'medium', eventType: 'sdwan' });
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes('access_token=fortigate-token'))).toBe(true);
  });

  it('normalizes live FortiManager JSON-RPC inventory, members, and alerts', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: Array<{ url: string }> };
      if (body.method === 'exec') {
        return Promise.resolve(response({ session: 'manager-session', result: [{ status: { code: 0, message: 'OK' } }] }));
      }
      const path = body.params[0].url;
      if (path === '/dvmdb/device') return Promise.resolve(response({ result: [{ status: { code: 0 }, data: [{ name: 'Branch FGT', serial: 'FMG-FGT-1', ip: '10.0.0.1', conn_status: 1, adom: 'customer-a' }] }] }));
      if (path.includes('virtual-wan-link')) return Promise.resolve(response({ result: [{ status: { code: 0 }, data: [{ device: 'FMG-FGT-1', interface: 'wan1', status: 'up', role: 'primary' }] }] }));
      return Promise.resolve(response({ result: [{ status: { code: 0 }, data: [{ id: 'fmg-alert-1', severity: 'high', category: 'connectivity', message: 'Device tunnel down', serial: 'FMG-FGT-1' }] }] }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const connector = new FortinetConnector({ apiKey: 'manager-secret', baseUrl: 'https://fortimanager.test/jsonrpc', managerType: 'fortimanager', organizationIdOrTenant: 'customer-a' });

    const result = await connector.fullSync();
    expect(result.errors).toEqual([]);
    expect(result.devices[0]).toMatchObject({ controllerDeviceId: 'FMG-FGT-1', status: 'online', networkName: 'customer-a' });
    expect(result.links[0]).toMatchObject({ controllerDeviceId: 'FMG-FGT-1', status: 'up' });
    expect(result.events[0]).toMatchObject({ rawEventId: 'fmg-alert-1', severity: 'high', eventSource: 'fortimanager' });
  });
});