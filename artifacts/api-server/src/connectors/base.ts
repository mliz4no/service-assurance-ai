/**
 * Base connector interface for all controller integrations.
 * All vendor connectors must implement this interface.
 *
 * NormalizedDevice, NormalizedLink, NormalizedEvent are the common internal
 * data shapes used regardless of which vendor's API is being polled.
 */

export interface NormalizedDevice {
  controllerDeviceId: string;
  hostname: string;
  deviceType: "firewall" | "sdwan_edge" | "appliance" | "switch" | "gateway";
  vendor: string;
  serialNumber?: string;
  model?: string;
  mgmtIp?: string;
  status: "online" | "offline" | "degraded" | "unknown";
  haState?: "active" | "standby" | "standalone" | "unknown";
  lastSeenAt?: Date;
  metadataJson?: Record<string, unknown>;
}

export interface NormalizedLink {
  linkName: string;
  linkType: "internet" | "mpls" | "lte" | "broadband" | "wan_uplink" | "vpn_tunnel" | "sdwan_transport";
  providerName?: string;
  circuitId?: string;
  role: "primary" | "backup" | "unknown";
  status: "up" | "down" | "degraded" | "unknown";
  latencyMs?: number;
  jitterMs?: number;
  packetLossPct?: number;
  // Reference to attach to a device (by controllerDeviceId)
  controllerDeviceId: string;
  metadataJson?: Record<string, unknown>;
}

export interface NormalizedEvent {
  rawEventId: string;
  eventSource: string;
  severity: "informational" | "low" | "medium" | "high" | "critical";
  eventType: string;
  title: string;
  description?: string;
  occurredAt: Date;
  // Optional references for correlation
  controllerDeviceId?: string;
  rawPayloadJson?: Record<string, unknown>;
}

export interface ConnectorSyncResult {
  devices: NormalizedDevice[];
  links: NormalizedLink[];
  events: NormalizedEvent[];
  errors: string[];
}

export interface BaseConnector {
  readonly vendor: string;
  testConnection(): Promise<{ ok: boolean; message: string }>;
  syncDevices(): Promise<NormalizedDevice[]>;
  syncLinks(): Promise<NormalizedLink[]>;
  syncEvents(): Promise<NormalizedEvent[]>;
  fullSync(): Promise<ConnectorSyncResult>;
}
