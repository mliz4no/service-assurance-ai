import type { BaseConnector, ConnectorSyncResult, NormalizedDevice, NormalizedEvent, NormalizedLink } from './base';

export type SdWanConnectorConfig = { apiKey: string; baseUrl: string; tenant?: string };

export class SdWanConnector implements BaseConnector {
  readonly vendor = 'sdwan';
  constructor(private readonly config: SdWanConnectorConfig) {}

  private get demoMode(): boolean { return !this.config.apiKey || this.config.apiKey === 'placeholder'; }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.baseUrl.replace(/\/+$/, '')}${path}`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}`, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`SD-WAN API returned ${response.status}`);
    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.baseUrl) return { ok: false, message: 'SD-WAN baseUrl is not configured.' };
    if (this.demoMode) return { ok: true, message: 'Demo mode: SD-WAN connection simulated' };
    try {
      await this.get('/api/v1/devices?limit=1');
      return { ok: true, message: 'SD-WAN connection successful' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async syncDevices(): Promise<NormalizedDevice[]> {
    const devices = this.demoMode ? [{ id: 'SDWAN-DEMO-01', name: 'branch-edge-01', status: 'online', model: 'Edge 1000' }]
      : (await this.get<{ devices: Array<Record<string, unknown>> }>('/api/v1/devices')).devices;
    return devices.map((device) => ({
      controllerDeviceId: String(device.id), hostname: String(device.name ?? device.hostname),
      deviceType: 'sdwan_edge', vendor: 'SD-WAN', model: device.model ? String(device.model) : undefined,
      mgmtIp: device.managementIp ? String(device.managementIp) : undefined,
      status: device.status === 'offline' ? 'offline' : device.status === 'degraded' ? 'degraded' : 'online',
      lastSeenAt: new Date(), networkName: this.config.tenant, metadataJson: device,
    }));
  }

  async syncLinks(): Promise<NormalizedLink[]> {
    const links = this.demoMode ? [{ id: 'demo-link', deviceId: 'SDWAN-DEMO-01', name: 'MPLS Primary', status: 'up', transport: 'mpls', latencyMs: 22 }]
      : (await this.get<{ links: Array<Record<string, unknown>> }>('/api/v1/links')).links;
    return links.map((link) => ({
      controllerDeviceId: String(link.deviceId), linkName: String(link.name ?? link.id),
      linkType: link.transport === 'mpls' ? 'mpls' : 'sdwan_transport',
      providerName: link.provider ? String(link.provider) : undefined,
      role: link.role === 'backup' ? 'backup' : 'primary',
      status: link.status === 'down' ? 'down' : link.status === 'degraded' ? 'degraded' : 'up',
      latencyMs: typeof link.latencyMs === 'number' ? link.latencyMs : undefined,
      jitterMs: typeof link.jitterMs === 'number' ? link.jitterMs : undefined,
      packetLossPct: typeof link.packetLossPct === 'number' ? link.packetLossPct : undefined,
      failoverActive: link.failoverActive === true, metadataJson: link,
    }));
  }

  async syncEvents(): Promise<NormalizedEvent[]> {
    const events = this.demoMode ? [{ id: 'demo-event', deviceId: 'SDWAN-DEMO-01', severity: 'high', type: 'transport_down', title: 'Primary transport down' }]
      : (await this.get<{ events: Array<Record<string, unknown>> }>('/api/v1/events?limit=100')).events;
    return events.map((event) => ({
      rawEventId: String(event.id), eventSource: 'sdwan',
      severity: event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'high' : 'informational',
      eventType: String(event.type ?? 'network'), title: String(event.title ?? event.message ?? 'SD-WAN event'),
      description: event.message ? String(event.message) : undefined,
      occurredAt: event.occurredAt ? new Date(String(event.occurredAt)) : new Date(),
      controllerDeviceId: event.deviceId ? String(event.deviceId) : undefined,
      category: 'transport', rawPayloadJson: event,
    }));
  }

  async fullSync(): Promise<ConnectorSyncResult> {
    const [devices, links, events] = await Promise.all([this.syncDevices(), this.syncLinks(), this.syncEvents()]);
    return { devices, links, events, errors: [] };
  }
}