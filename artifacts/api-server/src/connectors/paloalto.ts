import type {
  BaseConnector,
  ConnectorSyncResult,
  NormalizedDevice,
  NormalizedEvent,
  NormalizedLink,
} from './base';
import { fetchWithRetry } from '../lib/http-client';

export type PaloAltoConnectorConfig = {
  apiKey: string;
  baseUrl: string;
  organizationIdOrTenant?: string;
};

type PaloAltoResponse<T> = { result?: { entry?: T[] } };

export class PaloAltoConnector implements BaseConnector {
  readonly vendor = 'palo_alto';

  constructor(private readonly config: PaloAltoConnectorConfig) {}

  private get demoMode(): boolean {
    return !this.config.apiKey || this.config.apiKey === 'placeholder';
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetchWithRetry(`${this.config.baseUrl.replace(/\/+$/, '')}${path}`, {
      headers: { 'X-PAN-KEY': this.config.apiKey, Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Palo Alto API returned ${response.status}`);
    return response.json() as Promise<T>;
  }

  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.baseUrl) return { ok: false, message: 'Palo Alto baseUrl is not configured.' };
    if (this.demoMode) return { ok: true, message: 'Demo mode: Palo Alto connection simulated' };
    try {
      await this.get('/restapi/v11.0/Device/VirtualSystems?limit=1');
      return { ok: true, message: 'Palo Alto connection successful' };
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
  }

  async syncDevices(): Promise<NormalizedDevice[]> {
    if (this.demoMode) {
      return [{
        controllerDeviceId: 'PA-DEMO-01', hostname: 'panorama-edge-01', deviceType: 'firewall',
        vendor: 'Palo Alto Networks', serialNumber: 'PA-DEMO-01', model: 'PA-440', status: 'online',
        haState: 'active', lastSeenAt: new Date(), networkName: this.config.organizationIdOrTenant,
      }];
    }
    const response = await this.get<PaloAltoResponse<Record<string, unknown>>>(
      '/restapi/v11.0/Devices/Firewalls?location=panorama-pushed',
    );
    return (response.result?.entry ?? []).map((device) => ({
      controllerDeviceId: String(device.serial ?? device['@name']),
      hostname: String(device.hostname ?? device['device-name'] ?? device['@name']),
      deviceType: 'firewall',
      vendor: 'Palo Alto Networks',
      serialNumber: String(device.serial ?? device['@name']),
      model: device.model ? String(device.model) : undefined,
      mgmtIp: device['ip-address'] ? String(device['ip-address']) : undefined,
      status: device.connected === false || device.connected === 'no' ? 'offline' : 'online',
      haState: device['ha-state'] === 'passive' ? 'standby' : device['ha-state'] === 'active' ? 'active' : 'unknown',
      lastSeenAt: new Date(),
      networkName: this.config.organizationIdOrTenant,
      metadataJson: device,
    }));
  }

  async syncLinks(): Promise<NormalizedLink[]> {
    if (this.demoMode) return [{
      controllerDeviceId: 'PA-DEMO-01', linkName: 'ethernet1/1', linkType: 'internet',
      providerName: 'Demo carrier', role: 'primary', status: 'up', latencyMs: 18,
    }];
    const response = await this.get<PaloAltoResponse<Record<string, unknown>>>(
      '/restapi/v11.0/Network/EthernetInterfaces?location=panorama-pushed',
    );
    return (response.result?.entry ?? []).map((link) => ({
      controllerDeviceId: String(link.serial ?? link['device-id'] ?? 'panorama'),
      linkName: String(link.name ?? link['@name']),
      linkType: 'wan_uplink',
      role: link.role === 'backup' ? 'backup' : 'primary',
      status: link.status === 'down' ? 'down' : 'up',
      metadataJson: link,
    }));
  }

  async syncEvents(): Promise<NormalizedEvent[]> {
    if (this.demoMode) return [{
      rawEventId: 'PA-DEMO-EVENT-01', eventSource: 'palo_alto', severity: 'high',
      eventType: 'link_down', title: 'WAN interface unavailable', occurredAt: new Date(),
      controllerDeviceId: 'PA-DEMO-01', category: 'network',
    }];
    const response = await this.get<PaloAltoResponse<Record<string, unknown>>>(
      '/restapi/v11.0/Logs/System?limit=100',
    );
    return (response.result?.entry ?? []).map((event) => ({
      rawEventId: String(event.seqno ?? event['@name']),
      eventSource: 'palo_alto',
      severity: event.severity === 'critical' ? 'critical' : event.severity === 'high' ? 'high' : 'informational',
      eventType: String(event.subtype ?? 'system'),
      title: String(event.event ?? event.description ?? 'Palo Alto system event'),
      description: event.description ? String(event.description) : undefined,
      occurredAt: event.time ? new Date(String(event.time)) : new Date(),
      controllerDeviceId: event.serial ? String(event.serial) : undefined,
      category: 'system',
      rawPayloadJson: event,
    }));
  }

  async fullSync(): Promise<ConnectorSyncResult> {
    const [devices, links, events] = await Promise.all([this.syncDevices(), this.syncLinks(), this.syncEvents()]);
    return { devices, links, events, errors: [] };
  }
}