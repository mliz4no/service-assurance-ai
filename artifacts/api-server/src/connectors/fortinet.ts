/**
 * Fortinet Connector (Scaffold)
 *
 * Integration structure: Supports two Fortinet management approaches:
 *  1. FortiManager (centralized management for multiple FortiGate devices)
 *  2. Direct FortiGate REST API (single device management)
 *
 * Authentication: Bearer token (via admin login) or API key.
 * Base URL: https://{fortimanager-hostname}/jsonrpc (FortiManager)
 *           https://{fortigate-ip}/api/v2 (Direct FortiGate)
 *
 * HOW TO ADD REAL FORTINET API CALLS:
 * ─────────────────────────────────────────────────────────────────────────────
 * FortiManager JSONRPC pattern:
 *   POST {baseUrl}/sys/login/user with { user, passwd }
 *   → Returns session token
 *   POST {baseUrl} with { method: "get", params: [{url: "/dvmdb/device"}], session: token }
 *   → Returns device list
 *
 * Direct FortiGate REST API pattern:
 *   GET {baseUrl}/monitor/system/status?access_token={apiKey}
 *   GET {baseUrl}/monitor/router/ipv4?access_token={apiKey}
 *   GET {baseUrl}/monitor/system/ha-statistics?access_token={apiKey}
 *   GET {baseUrl}/log/traffic/local?access_token={apiKey}
 *
 * FortiGate API docs: https://fndn.fortinet.net/index.php?/fortiapi/54-fortigate/
 * FortiManager API docs: https://fndn.fortinet.net/index.php?/fortiapi/5-fortimanager/
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type {
  BaseConnector,
  NormalizedDevice,
  NormalizedLink,
  NormalizedEvent,
  ConnectorSyncResult,
} from './base';

export interface FortinetConnectorConfig {
  apiKey: string;
  baseUrl: string;
  organizationIdOrTenant?: string;
  /** "fortimanager" uses JSON-RPC, "fortigate" uses REST API directly */
  managerType: 'fortimanager' | 'fortigate';
}

export class FortinetConnector implements BaseConnector {
  readonly vendor = 'fortinet';
  private readonly config: FortinetConnectorConfig;

  constructor(config: FortinetConnectorConfig) {
    this.config = config;
  }

  /**
   * Test connection to FortiManager or FortiGate.
   *
   * REAL FORTINET API CALL (FortiManager):
   * POST {baseUrl}/sys/login/user
   * Body: { "id": 1, "method": "exec", "params": [{ "url": "sys/login/user", "data": { "user": "admin", "passwd": "{apiKey}" } }] }
   * Returns: { "result": [{ "status": { "code": 0, "message": "OK" } }], "session": "..." }
   *
   * REAL FORTINET API CALL (FortiGate direct):
   * GET {baseUrl}/api/v2/monitor/system/status?access_token={apiKey}
   * Returns: { "results": { "hostname": "...", "serial": "...", "version": "..." } }
   */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (!this.config.apiKey || this.config.apiKey === 'placeholder') {
      return { ok: true, message: 'Demo mode: Fortinet connection simulated (no real API key)' };
    }

    // TODO: Implement real FortiManager/FortiGate connection test here
    return {
      ok: true,
      message: `Fortinet ${this.config.managerType} API key present — configure live URL to enable real polling`,
    };
  }

  /**
   * Sync devices from FortiManager or FortiGate.
   *
   * REAL FORTINET API CALL (FortiManager):
   * POST {baseUrl}
   * Body: { "method": "get", "params": [{ "url": "/dvmdb/device", "option": ["get all"] }], "session": "{session}" }
   * Returns: { "result": [{ "data": [{ "name", "serial", "ip", "os_ver", "ha_status", "connection_status" }] }] }
   *
   * REAL FORTINET API CALL (FortiGate direct):
   * GET {baseUrl}/api/v2/cmdb/system/interface?access_token={apiKey}  (for interfaces)
   * GET {baseUrl}/api/v2/monitor/system/status?access_token={apiKey}  (for device info)
   *
   * FortiGate HA state:
   * GET {baseUrl}/api/v2/monitor/system/ha-statistics?access_token={apiKey}
   * Returns: { "results": { "members": [{ "hostname", "role": "primary|backup", "overridden": false }] } }
   */
  async syncDevices(): Promise<NormalizedDevice[]> {
    return this.mockDevices();
  }

  /**
   * Sync WAN/interface link status from FortiGate.
   *
   * REAL FORTINET API CALL (FortiGate direct):
   * GET {baseUrl}/api/v2/monitor/system/interface?access_token={apiKey}&include_vdom=true
   * Returns: array of { name, link, ip, type, speed, rx_bytes, tx_bytes, ... }
   *
   * SD-WAN health checks (for latency/jitter/loss):
   * GET {baseUrl}/api/v2/monitor/virtual-wan/health-check?access_token={apiKey}
   * Returns: { "results": { "{health-check-name}": { "members": [{ "interface", "latency", "jitter", "packet_loss", "status" }] } } }
   */
  async syncLinks(): Promise<NormalizedLink[]> {
    return this.mockLinks();
  }

  /**
   * Sync security and system events from FortiGate.
   *
   * REAL FORTINET API CALL (FortiGate direct):
   * GET {baseUrl}/api/v2/log/disk/event?access_token={apiKey}&type=system&rows=100
   * Returns: array of { date, time, devname, type, subtype, level, logid, msg, ... }
   *
   * HA failover events:
   * GET {baseUrl}/api/v2/log/disk/event?access_token={apiKey}&subtype=ha&rows=50
   * Returns HA role change events with timestamps.
   */
  async syncEvents(): Promise<NormalizedEvent[]> {
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

  // ── Mock data helpers (realistic Fortinet-style data for dev/demo mode) ──────

  private mockDevices(): NormalizedDevice[] {
    return [
      {
        controllerDeviceId: 'FGT60F-FAKESERIAL01',
        hostname: 'FGT-HQ-Firewall-01',
        deviceType: 'firewall',
        vendor: 'Fortinet',
        serialNumber: 'FGT60F-FAKESERIAL01',
        model: 'FortiGate 60F',
        mgmtIp: '192.168.1.254',
        status: 'online',
        haState: 'active',
        lastSeenAt: new Date(),
        metadataJson: { osVersion: 'FortiOS 7.4.2', vdom: 'root' },
      },
      {
        controllerDeviceId: 'FGT60F-FAKESERIAL02',
        hostname: 'FGT-HQ-Firewall-02',
        deviceType: 'firewall',
        vendor: 'Fortinet',
        serialNumber: 'FGT60F-FAKESERIAL02',
        model: 'FortiGate 60F',
        mgmtIp: '192.168.1.253',
        status: 'online',
        haState: 'standby',
        lastSeenAt: new Date(),
        metadataJson: { osVersion: 'FortiOS 7.4.2', vdom: 'root', haRole: 'standby' },
      },
      {
        controllerDeviceId: 'FGT40F-FAKESERIAL03',
        hostname: 'FGT-Branch-Chicago',
        deviceType: 'firewall',
        vendor: 'Fortinet',
        serialNumber: 'FGT40F-FAKESERIAL03',
        model: 'FortiGate 40F',
        mgmtIp: '10.5.1.254',
        status: 'degraded',
        haState: 'standalone',
        lastSeenAt: new Date(Date.now() - 600000),
        metadataJson: { osVersion: 'FortiOS 7.2.8', vdom: 'root' },
      },
    ];
  }

  private mockLinks(): NormalizedLink[] {
    return [
      {
        controllerDeviceId: 'FGT60F-FAKESERIAL01',
        linkName: 'WAN1 - Zayo Fiber',
        linkType: 'internet',
        providerName: 'Zayo',
        circuitId: 'ZYO-DIA-882901-Z',
        role: 'primary',
        status: 'up',
        latencyMs: 6.1,
        jitterMs: 0.3,
        packetLossPct: 0.0,
        metadataJson: { interface: 'wan1', sdwanMember: 1 },
      },
      {
        controllerDeviceId: 'FGT60F-FAKESERIAL01',
        linkName: 'WAN2 - Lumen MPLS',
        linkType: 'mpls',
        providerName: 'Lumen',
        circuitId: 'LMN-MPLS-449102-M',
        role: 'backup',
        status: 'up',
        latencyMs: 15.4,
        jitterMs: 1.2,
        packetLossPct: 0.0,
        metadataJson: { interface: 'wan2', sdwanMember: 2 },
      },
      {
        controllerDeviceId: 'FGT40F-FAKESERIAL03',
        linkName: 'WAN1 - Comcast Fiber',
        linkType: 'internet',
        providerName: 'Comcast Business',
        circuitId: 'CMC-BIZ-551033-D',
        role: 'primary',
        status: 'degraded',
        latencyMs: 142.8,
        jitterMs: 38.5,
        packetLossPct: 12.3,
        metadataJson: { interface: 'wan1', sdwanHealthCheck: 'failing' },
      },
    ];
  }

  private mockEvents(): NormalizedEvent[] {
    const now = new Date();
    return [
      {
        rawEventId: 'fgt-evt-001',
        eventSource: 'fortigate_system',
        severity: 'high',
        eventType: 'ha_failover',
        title: 'HA failover detected — FGT-HQ',
        description:
          'FortiGate HA cluster performed a failover event. FGT-HQ-Firewall-02 promoted to active role. Traffic interruption estimated 2-5 seconds.',
        occurredAt: new Date(now.getTime() - 14400000),
        controllerDeviceId: 'FGT60F-FAKESERIAL01',
        rawPayloadJson: {
          logid: '0100032001',
          type: 'event',
          subtype: 'ha',
          level: 'warning',
          msg: 'HA master/slave changed',
          newmaster: 'FGT60F-FAKESERIAL02',
        },
      },
      {
        rawEventId: 'fgt-evt-002',
        eventSource: 'fortigate_sdwan',
        severity: 'medium',
        eventType: 'sdwan_link_quality',
        title: 'SD-WAN link quality degraded — Chicago Branch',
        description:
          'WAN1 health check failing on Chicago FortiGate. Packet loss 12.3%, latency 142ms. SD-WAN policy routing traffic to secondary if available.',
        occurredAt: new Date(now.getTime() - 900000),
        controllerDeviceId: 'FGT40F-FAKESERIAL03',
        rawPayloadJson: {
          logid: '0117044545',
          type: 'event',
          subtype: 'sdwan',
          level: 'warning',
          interface: 'wan1',
          packetloss: 12.3,
          latency: 142.8,
        },
      },
    ];
  }
}
