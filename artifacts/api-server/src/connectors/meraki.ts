/**
 * Cisco Meraki Connector
 *
 * Integration structure: Meraki uses a cloud-managed dashboard API.
 * Authentication: X-Cisco-Meraki-API-Key header.
 * Base URL: https://api.meraki.com/api/v1
 *
 * HOW TO ADD REAL MERAKI API CALLS:
 * ─────────────────────────────────────────────────────────────────────────────
 * Replace each section marked "// REAL MERAKI API CALL:" with a real fetch
 * to the Meraki Dashboard API. The URL patterns and response shapes are
 * documented in comments alongside each mock.
 *
 * Required API scopes: Dashboard API (read-only is sufficient for monitoring)
 * Meraki API docs: https://developer.cisco.com/meraki/api-v1/
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { BaseConnector, NormalizedDevice, NormalizedLink, NormalizedEvent, ConnectorSyncResult } from "./base";

export interface MerakiConnectorConfig {
  apiKey: string;
  baseUrl: string;
  organizationId: string;
}

export class MerakiConnector implements BaseConnector {
  readonly vendor = "meraki";
  private readonly config: MerakiConnectorConfig;

  constructor(config: MerakiConnectorConfig) {
    this.config = config;
  }

  private headers(): Record<string, string> {
    return {
      "X-Cisco-Meraki-API-Key": this.config.apiKey,
      "Content-Type": "application/json",
    };
  }

  /**
   * Test connectivity to Meraki Dashboard API.
   *
   * REAL MERAKI API CALL:
   * GET {baseUrl}/organizations/{organizationId}
   * Returns: { id, name, url, api: { enabled } }
   */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.apiKey || this.config.apiKey === "placeholder") {
      // DEMO MODE: return mock success for dev/demo environments
      return { ok: true, message: "Demo mode: Meraki connection simulated (no real API key)" };
    }

    try {
      // REAL MERAKI API CALL:
      // const resp = await fetch(`${this.config.baseUrl}/organizations/${this.config.organizationId}`, {
      //   headers: this.headers(),
      // });
      // if (!resp.ok) return { ok: false, message: `Meraki API returned ${resp.status}` };
      // const org = await resp.json();
      // return { ok: true, message: `Connected to org: ${org.name}` };

      return { ok: true, message: "Meraki API key present — configure live URL to enable real polling" };
    } catch (err: any) {
      return { ok: false, message: `Connection failed: ${err.message}` };
    }
  }

  /**
   * Sync all devices from Meraki for this organization.
   *
   * REAL MERAKI API CALL:
   * GET {baseUrl}/organizations/{organizationId}/devices/statuses
   * Returns: array of { serial, name, model, networkId, status, lastReportedAt, lanIp, ... }
   *
   * Then map each device:
   * - serial → serialNumber + controllerDeviceId
   * - name → hostname
   * - model → model (MX = firewall/appliance, MS = switch, MR = AP)
   * - status "online"/"alerting"/"offline" → our status enum
   */
  async syncDevices(): Promise<NormalizedDevice[]> {
    if (!this.config.apiKey || this.config.apiKey === "placeholder") {
      return this.mockDevices();
    }

    // REAL MERAKI API CALL: (replace mock below with actual fetch + mapping)
    // const resp = await fetch(
    //   `${this.config.baseUrl}/organizations/${this.config.organizationId}/devices/statuses`,
    //   { headers: this.headers() }
    // );
    // const devices = await resp.json();
    // return devices.map(this.mapMerakiDevice);

    return this.mockDevices();
  }

  /**
   * Sync WAN uplink statuses (network links) across all networks.
   *
   * REAL MERAKI API CALL:
   * GET {baseUrl}/organizations/{organizationId}/appliance/uplink/statuses
   * Returns: array of { networkId, serial, uplinks: [{ interface, status, ip, provider, publicIp }] }
   *
   * Then for each uplink:
   * - interface → linkName (WAN1/WAN2 → primary/backup role)
   * - status "active"/"failed"/"not connected" → our status enum
   */
  async syncLinks(): Promise<NormalizedLink[]> {
    if (!this.config.apiKey || this.config.apiKey === "placeholder") {
      return this.mockLinks();
    }

    // REAL MERAKI API CALL: (replace mock below with actual fetch + mapping)
    // const resp = await fetch(
    //   `${this.config.baseUrl}/organizations/${this.config.organizationId}/appliance/uplink/statuses`,
    //   { headers: this.headers() }
    // );
    // const statuses = await resp.json();
    // return statuses.flatMap(this.mapMerakiUplinks);

    return this.mockLinks();
  }

  /**
   * Sync organization-level events from Meraki.
   *
   * REAL MERAKI API CALL:
   * GET {baseUrl}/organizations/{organizationId}/appliance/security/events
   * OR: GET {baseUrl}/networks/{networkId}/events?productTypes[]=appliance
   * Returns: array of { occurredAt, networkId, type, description, clientIp, deviceSerial, ... }
   */
  async syncEvents(): Promise<NormalizedEvent[]> {
    if (!this.config.apiKey || this.config.apiKey === "placeholder") {
      return this.mockEvents();
    }

    // REAL MERAKI API CALL: (replace mock below with actual fetch + mapping)
    // const resp = await fetch(
    //   `${this.config.baseUrl}/organizations/${this.config.organizationId}/appliance/security/events`,
    //   { headers: this.headers() }
    // );
    // const events = await resp.json();
    // return events.map(this.mapMerakiEvent);

    return this.mockEvents();
  }

  async fullSync(): Promise<ConnectorSyncResult> {
    const [devices, links, events] = await Promise.all([
      this.syncDevices(),
      this.syncLinks(),
      this.syncEvents(),
    ]);
    return { devices, links, events, errors: [] };
  }

  // ── Mock data helpers (realistic Meraki-style data for dev/demo mode) ──────

  private mockDevices(): NormalizedDevice[] {
    return [
      {
        controllerDeviceId: "Q2TN-XXXX-NXT1",
        hostname: "MX-HQ-Primary",
        deviceType: "appliance",
        vendor: "Meraki",
        serialNumber: "Q2TN-XXXX-NXT1",
        model: "MX84",
        mgmtIp: "10.0.1.1",
        status: "online",
        haState: "active",
        lastSeenAt: new Date(),
        metadataJson: { networkId: "N_001", productType: "appliance" },
      },
      {
        controllerDeviceId: "Q2TN-XXXX-NXT2",
        hostname: "MX-Branch-Denver",
        deviceType: "appliance",
        vendor: "Meraki",
        serialNumber: "Q2TN-XXXX-NXT2",
        model: "MX67",
        mgmtIp: "10.1.1.1",
        status: "offline",
        lastSeenAt: new Date(Date.now() - 3600 * 1000 * 2),
        metadataJson: { networkId: "N_002", productType: "appliance" },
      },
      {
        controllerDeviceId: "Q2TN-XXXX-NXT3",
        hostname: "MX-Branch-Austin",
        deviceType: "appliance",
        vendor: "Meraki",
        serialNumber: "Q2TN-XXXX-NXT3",
        model: "MX67",
        mgmtIp: "10.2.1.1",
        status: "online",
        lastSeenAt: new Date(),
        metadataJson: { networkId: "N_003", productType: "appliance" },
      },
    ];
  }

  private mockLinks(): NormalizedLink[] {
    return [
      {
        controllerDeviceId: "Q2TN-XXXX-NXT1",
        linkName: "WAN1 - AT&T Fiber",
        linkType: "internet",
        providerName: "AT&T Business",
        circuitId: "ATT-DIA-290183-A",
        role: "primary",
        status: "up",
        latencyMs: 8.2,
        jitterMs: 0.4,
        packetLossPct: 0.0,
        metadataJson: { interface: "WAN1", publicIp: "12.34.56.78" },
      },
      {
        controllerDeviceId: "Q2TN-XXXX-NXT1",
        linkName: "WAN2 - Verizon LTE",
        linkType: "lte",
        providerName: "Verizon",
        role: "backup",
        status: "up",
        latencyMs: 42.1,
        jitterMs: 3.8,
        packetLossPct: 0.2,
        metadataJson: { interface: "WAN2", publicIp: "72.12.45.90" },
      },
      {
        controllerDeviceId: "Q2TN-XXXX-NXT2",
        linkName: "WAN1 - Comcast Business",
        linkType: "broadband",
        providerName: "Comcast Business",
        circuitId: "CMC-BIZ-190224-B",
        role: "primary",
        status: "down",
        latencyMs: undefined,
        packetLossPct: 100,
        metadataJson: { interface: "WAN1", lastStatusChange: new Date(Date.now() - 7200000).toISOString() },
      },
      {
        controllerDeviceId: "Q2TN-XXXX-NXT2",
        linkName: "WAN2 - AT&T LTE Failover",
        linkType: "lte",
        providerName: "AT&T",
        role: "backup",
        status: "up",
        latencyMs: 55.3,
        jitterMs: 6.1,
        packetLossPct: 0.8,
        metadataJson: { interface: "WAN2", failoverActive: true },
      },
      {
        controllerDeviceId: "Q2TN-XXXX-NXT3",
        linkName: "WAN1 - Spectrum Business",
        linkType: "internet",
        providerName: "Spectrum Business",
        circuitId: "SPC-BIZ-310991-C",
        role: "primary",
        status: "up",
        latencyMs: 12.5,
        jitterMs: 1.1,
        packetLossPct: 0.0,
        metadataJson: { interface: "WAN1" },
      },
    ];
  }

  private mockEvents(): NormalizedEvent[] {
    const now = new Date();
    return [
      {
        rawEventId: "meraki-evt-001",
        eventSource: "meraki_dashboard",
        severity: "high",
        eventType: "wan_status_change",
        title: "WAN1 link down — Denver Branch",
        description: "Primary WAN interface (Comcast Business) went offline. LTE failover is active on WAN2.",
        occurredAt: new Date(now.getTime() - 7200000),
        controllerDeviceId: "Q2TN-XXXX-NXT2",
        rawPayloadJson: {
          type: "wan_status_change",
          networkId: "N_002",
          deviceSerial: "Q2TN-XXXX-NXT2",
          uplink: "WAN1",
          from: "active",
          to: "failed",
        },
      },
      {
        rawEventId: "meraki-evt-002",
        eventSource: "meraki_dashboard",
        severity: "medium",
        eventType: "vpn_connectivity_change",
        title: "VPN tunnel degraded — Austin Branch to HQ",
        description: "AutoVPN tunnel between Austin branch and HQ is experiencing intermittent packet loss (>5%).",
        occurredAt: new Date(now.getTime() - 1800000),
        controllerDeviceId: "Q2TN-XXXX-NXT3",
        rawPayloadJson: {
          type: "vpn_connectivity_change",
          networkId: "N_003",
          deviceSerial: "Q2TN-XXXX-NXT3",
          vpnPeer: "HQ",
          packetLoss: "6.2%",
        },
      },
      {
        rawEventId: "meraki-evt-003",
        eventSource: "meraki_dashboard",
        severity: "informational",
        eventType: "device_checkin",
        title: "MX84 HQ device check-in",
        description: "MX84 at HQ completed scheduled check-in. All systems nominal.",
        occurredAt: new Date(now.getTime() - 300000),
        controllerDeviceId: "Q2TN-XXXX-NXT1",
        rawPayloadJson: { type: "device_checkin", networkId: "N_001", status: "ok" },
      },
    ];
  }
}
