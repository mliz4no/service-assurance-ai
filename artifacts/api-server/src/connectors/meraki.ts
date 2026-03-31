/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CISCO MERAKI CONNECTOR
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cloud-managed networking via the Meraki Dashboard API v1.
 *
 * AUTHENTICATION
 * ──────────────
 * Every request requires:
 *   Header: X-Cisco-Meraki-API-Key: <your-api-key>
 * API keys are generated in the Meraki Dashboard:
 *   My Profile → API access → Generate new API key
 *
 * BASE URL
 * ────────
 *   https://api.meraki.com/api/v1
 *   (Some private deployments use a different base URL — always read from config)
 *
 * ORGANIZATION ID
 * ───────────────
 * Every Meraki environment has one or more "organizations". Each org contains
 * networks, and each network contains devices. The organizationId is the root
 * identifier for all subsequent API calls.
 *
 * To find your organizationId:
 *   GET /organizations
 *   → returns [{ id, name, url, api: { enabled } }]
 * Then pass that id into all /organizations/{organizationId}/... endpoints.
 *
 * SYNC FLOW (production)
 * ──────────────────────
 * 1. testConnection()  → GET /organizations/{orgId}
 * 2. syncNetworks()    → GET /organizations/{orgId}/networks
 * 3. syncDevices()     → GET /organizations/{orgId}/devices/statuses
 * 4. syncLinks()       → GET /organizations/{orgId}/appliance/uplink/statuses
 *                         + GET /organizations/{orgId}/appliance/uplink/usage/byNetwork
 * 5. syncEvents()      → GET /organizations/{orgId}/appliance/security/events
 *                         (or per-network: GET /networks/{networkId}/events?productTypes[]=appliance)
 *
 * In demo/placeholder mode (apiKey === "placeholder") all methods return
 * rich mock data that mirrors the real Meraki API response shapes and covers
 * realistic branch-network scenarios for testing and demos.
 *
 * Meraki API reference: https://developer.cisco.com/meraki/api-v1/
 * ═══════════════════════════════════════════════════════════════════════════
 */

import type {
  BaseConnector,
  NormalizedDevice,
  NormalizedLink,
  NormalizedEvent,
  ConnectorSyncResult,
} from "./base";

// ─────────────────────────────────────────────────────────────────────────────
// Meraki API response shape types
//
// These mirror the actual Meraki Dashboard API response objects.
// Use these types in the mapping functions so the compiler enforces the
// contract between API response shape → normalized internal shape.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /organizations/{orgId}
 */
export interface MerakiOrganization {
  id: string;          // "123456"
  name: string;        // "Nexatek Corp"
  url: string;         // Meraki dashboard URL for this org
  api: {
    enabled: boolean;
  };
}

/**
 * GET /organizations/{orgId}/networks
 * Each network corresponds to a physical site (branch, HQ, DC, etc.)
 */
export interface MerakiNetwork {
  id: string;            // "N_123456789"
  organizationId: string;
  name: string;          // "Nexatek - HQ Chicago"
  productTypes: string[]; // ["appliance", "switch", "wireless"]
  timeZone: string;      // "America/Chicago"
  tags: string[];        // ["branch", "critical"]
  url: string;           // Dashboard URL for this network
}

/**
 * GET /organizations/{orgId}/devices/statuses
 * One record per managed device (MX, MS, MR, etc.)
 *
 * Note: `status` values from Meraki are "online" | "alerting" | "offline" | "dormant"
 * We map these to our own status enum in mapMerakiDeviceStatus().
 */
export interface MerakiDeviceStatus {
  serial: string;            // "Q2TN-XXXX-0001" — unique identifier
  name: string;              // "MX-HQ-01" — device name set in dashboard
  model: string;             // "MX84", "MX67", "MX450", "MS225-48FP", "MR46"
  networkId: string;         // "N_123456789" — which network this device belongs to
  mac: string;               // "00:11:22:33:44:55"
  lanIp: string | null;      // "192.168.1.1" — management/LAN IP
  publicIp: string | null;   // "203.0.113.5" — current public IP (WAN1)
  lastReportedAt: string;    // ISO 8601 timestamp
  status: "online" | "alerting" | "offline" | "dormant";
  productType: "appliance" | "switch" | "wireless" | "camera";
  components?: {
    powerSupplies: Array<{ slot: number; model: string; status: "powering" | "not connected" }>;
  };
}

/**
 * GET /organizations/{orgId}/appliance/uplink/statuses
 * One record per MX appliance. Each uplink is a WAN interface (WAN1, WAN2, Cellular).
 *
 * Note: Meraki `status` for uplinks: "active" | "ready" | "connecting" | "not connected" | "failed"
 * We map these in mapMerakiUplinkStatus().
 */
export interface MerakiUplinkEntry {
  interface: "WAN1" | "WAN2" | "Cellular";  // Physical interface name
  status: "active" | "ready" | "connecting" | "not connected" | "failed";
  ip: string | null;           // IP address assigned to this uplink
  gateway: string | null;      // Default gateway
  publicIp: string | null;     // Public-facing IP (after NAT)
  primaryDns: string | null;
  secondaryDns: string | null;
  ipAssignedBy: "static" | "dhcp" | "pppoe";
  provider: string | null;     // ISP name if detected ("AT&T", "Comcast", etc.)
}

export interface MerakiUplinkStatusRecord {
  networkId: string;
  networkName?: string;          // Populated when merged with network list
  serial: string;                // Device serial — links back to MerakiDeviceStatus
  model: string;                 // "MX84"
  highAvailability?: {
    enabled: boolean;
    role: "primary" | "spare";   // In Meraki warm-spare HA
  };
  uplinks: MerakiUplinkEntry[];
}

/**
 * GET /organizations/{orgId}/appliance/uplink/usage/byNetwork (optional, for metrics)
 * Provides per-uplink bandwidth usage. Not used for status, but useful for enrichment.
 */
export interface MerakiUplinkUsageByNetwork {
  networkId: string;
  byUplink: Array<{
    interface: string;
    sent: number;      // bytes
    received: number;  // bytes
  }>;
}

/**
 * GET /networks/{networkId}/events?productTypes[]=appliance
 * OR: GET /organizations/{orgId}/appliance/security/events
 *
 * Meraki event object. The `type` field identifies the event class.
 * See Meraki event type reference:
 * https://developer.cisco.com/meraki/api-v1/get-network-events/
 *
 * Common appliance event types:
 *   wan_status_change      — WAN interface changed state (active/failed/not connected)
 *   vpn_connectivity_change — AutoVPN tunnel state changed
 *   dhcp_lease              — DHCP lease issued/expired
 *   arp_inspection_block    — ARP spoofing blocked
 *   port_forwarding         — Port forwarding rule matched
 *   ids_alert               — Intrusion detection alert
 *   device_checkin          — Scheduled device heartbeat
 *   firmware_upgrade_start  — Firmware upgrade beginning
 *   firmware_upgrade_complete — Firmware upgrade finished
 *   vpn_registry_change     — VPN hub/spoke registration changed
 *   uplink_connectivity_change — Uplink failover/failback
 */
export interface MerakiApplianceEvent {
  occurredAt: string;        // ISO 8601
  networkId: string;         // "N_123456789"
  networkName?: string;      // Populated when merged with network list
  type: string;              // "wan_status_change", "vpn_connectivity_change", etc.
  description: string;       // Human-readable event description from Meraki
  category: string;          // "appliance_connectivity", "vpn", "dhcp", etc.
  clientId?: string;         // Client mac if client-related event
  clientDescription?: string;
  deviceSerial?: string;     // Device serial if device-related
  deviceName?: string;       // Device name if device-related
  ssidNumber?: number;       // For wireless events
  eventData: Record<string, unknown>;  // Event-specific structured data
}

// ─────────────────────────────────────────────────────────────────────────────
// Connector configuration
// ─────────────────────────────────────────────────────────────────────────────

export interface MerakiConnectorConfig {
  /**
   * Meraki Dashboard API key.
   * In production: a real key from My Profile → API access.
   * In demo mode: pass "placeholder" to activate mock data.
   *
   * NEVER log or expose this key. It provides full read/write access
   * to the entire Meraki organization.
   */
  apiKey: string;

  /**
   * Meraki API base URL.
   * Default: "https://api.meraki.com/api/v1"
   * Some customers with China data residency use "https://api.meraki.cn/api/v1"
   */
  baseUrl: string;

  /**
   * Meraki Organization ID.
   * Find via: GET /organizations → pick the matching org → use its `id` field.
   * Example: "123456" or "654321"
   *
   * A single Meraki API key may have access to multiple organizations.
   * We always scope calls to one org per controller record.
   */
  organizationId: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status mapping helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map Meraki device status → our internal status enum.
 *
 * Meraki device statuses:
 *   "online"   → device is reporting normally
 *   "alerting" → device is online but has active alerts (high CPU, port down, etc.)
 *   "offline"  → device is not reporting (been unreachable for >5 minutes)
 *   "dormant"  → device has never reported or was manually deactivated
 */
function mapMerakiDeviceStatus(
  merakiStatus: MerakiDeviceStatus["status"]
): NormalizedDevice["status"] {
  switch (merakiStatus) {
    case "online":   return "online";
    case "alerting": return "degraded";   // online but has active alerts
    case "offline":  return "offline";
    case "dormant":  return "unknown";
    default:         return "unknown";
  }
}

/**
 * Map Meraki uplink status → our internal link status enum.
 *
 * Meraki uplink statuses:
 *   "active"         → uplink is carrying traffic (primary or failed-over backup)
 *   "ready"          → uplink is configured and available as standby
 *   "connecting"     → uplink is establishing connection (transitional)
 *   "not connected"  → uplink has no cable/signal
 *   "failed"         → uplink was active but lost connectivity
 */
function mapMerakiUplinkStatus(
  merakiStatus: MerakiUplinkEntry["status"]
): NormalizedLink["status"] {
  switch (merakiStatus) {
    case "active":        return "up";
    case "ready":         return "up";       // standby but healthy
    case "connecting":    return "degraded"; // transitional
    case "not connected": return "down";
    case "failed":        return "down";
    default:              return "unknown";
  }
}

/**
 * Map Meraki WAN interface name → our link role.
 * Convention: WAN1 is always the primary circuit. WAN2/Cellular are backup.
 */
function mapMerakiInterfaceRole(iface: string): NormalizedLink["role"] {
  if (iface === "WAN1") return "primary";
  if (iface === "WAN2" || iface === "Cellular") return "backup";
  return "unknown";
}

/**
 * Map Meraki interface name → our link type.
 * WAN1/WAN2 are generic internet unless the provider suggests otherwise.
 * Cellular is always LTE.
 */
function mapMerakiInterfaceLinkType(
  iface: string,
  providerHint?: string | null
): NormalizedLink["linkType"] {
  if (iface === "Cellular") return "lte";
  if (providerHint?.toLowerCase().includes("mpls")) return "mpls";
  return "internet";
}

/**
 * Map Meraki model prefix → our device type.
 * MX = security appliance (gateway/firewall role)
 * MS = switch
 * MR = wireless access point
 * MV = camera
 * MT = sensor
 */
function mapMerakiModelToDeviceType(model: string): NormalizedDevice["deviceType"] {
  const prefix = model.slice(0, 2).toUpperCase();
  switch (prefix) {
    case "MX": return "appliance";
    case "MS": return "switch";
    default:   return "appliance";
  }
}

/**
 * Map Meraki event type → our severity enum.
 *
 * Meraki events don't have an explicit severity field — we infer it from
 * the event type. This is the same logic an NOC would apply when triaging
 * Meraki webhook payloads.
 */
function inferMerakiEventSeverity(eventType: string): NormalizedEvent["severity"] {
  if (
    eventType === "wan_status_change" ||
    eventType === "uplink_connectivity_change" ||
    eventType === "vpn_registry_change"
  ) return "high";

  if (
    eventType === "vpn_connectivity_change" ||
    eventType === "ids_alert" ||
    eventType === "arp_inspection_block"
  ) return "medium";

  if (
    eventType === "firmware_upgrade_start" ||
    eventType === "firmware_upgrade_complete" ||
    eventType === "dhcp_lease" ||
    eventType === "port_forwarding"
  ) return "low";

  if (
    eventType === "device_checkin" ||
    eventType === "device_connected" ||
    eventType === "splash_auth"
  ) return "informational";

  return "low";
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping functions: Meraki API objects → normalized internal shapes
//
// These are pure functions — no side effects, easily unit testable.
// The sync methods call these after fetching (or returning mock data).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a Meraki device status record → NormalizedDevice.
 *
 * Called on each item from:
 *   GET /organizations/{orgId}/devices/statuses
 */
export function mapMerakiDevice(raw: MerakiDeviceStatus): NormalizedDevice {
  return {
    controllerDeviceId: raw.serial,
    hostname: raw.name,
    deviceType: mapMerakiModelToDeviceType(raw.model),
    vendor: "Meraki",
    serialNumber: raw.serial,
    model: raw.model,
    mgmtIp: raw.lanIp ?? undefined,
    status: mapMerakiDeviceStatus(raw.status),
    // Meraki warm-spare HA: real HA state comes from uplink record's highAvailability field.
    // Without that context here, we leave haState undefined (enriched in syncLinks pass).
    haState: undefined,
    lastSeenAt: new Date(raw.lastReportedAt),
    metadataJson: {
      networkId: raw.networkId,
      productType: raw.productType,
      mac: raw.mac,
      publicIp: raw.publicIp ?? null,
    },
  };
}

/**
 * Map a single uplink entry from a Meraki uplink status record → NormalizedLink.
 *
 * Called for each uplink in each device record from:
 *   GET /organizations/{orgId}/appliance/uplink/statuses
 */
export function mapMerakiUplink(
  raw: MerakiUplinkEntry,
  deviceSerial: string,
  networkName: string,
  circuitIdHint?: string,
  /** Pass true when a backup/cellular uplink is "active" due to primary failure */
  isFailoverActive?: boolean
): NormalizedLink {
  const iface = raw.interface;
  const status = mapMerakiUplinkStatus(raw.status);
  const role = mapMerakiInterfaceRole(iface);
  const linkType = mapMerakiInterfaceLinkType(iface, raw.provider);

  // Build a human-readable link name:
  //   "WAN1 — AT&T Business Fiber" or "Cellular — Verizon LTE (Failover Active)"
  const providerPart = raw.provider ? ` — ${raw.provider}` : "";
  const failoverPart = isFailoverActive ? " [Failover Active]" : "";
  const linkName = `${iface}${providerPart}${failoverPart}`;

  return {
    controllerDeviceId: deviceSerial,
    linkName,
    linkType,
    providerName: raw.provider ?? undefined,
    circuitId: circuitIdHint,   // Meraki doesn't return circuit IDs — must be set manually or from service record
    role,
    status,
    networkName,                // top-level controller-native network name
    failoverActive: isFailoverActive ?? false,
    // Meraki does NOT return real-time latency/jitter/loss from this endpoint.
    // For performance metrics, poll:
    //   GET /organizations/{orgId}/appliance/uplinks/usage/byNetwork
    //   GET /networks/{networkId}/appliance/uplinks/usageHistory
    //   or use Meraki's Loss & Latency Health API (requires Dashboard API Premium add-on)
    latencyMs: undefined,
    jitterMs: undefined,
    packetLossPct: undefined,
    metadataJson: {
      interface: iface,
      merakiStatus: raw.status,          // raw Meraki status string (before normalization)
      ip: raw.ip ?? null,
      publicIp: raw.publicIp ?? null,
      gateway: raw.gateway ?? null,
      ipAssignedBy: raw.ipAssignedBy,
      networkName,
      failoverActive: isFailoverActive ?? false,
    },
  };
}

/**
 * Map a Meraki network event → NormalizedEvent.
 *
 * Called on each item from:
 *   GET /networks/{networkId}/events?productTypes[]=appliance
 *   OR: GET /organizations/{orgId}/appliance/security/events
 *
 * The `eventData` field is event-type-specific. Key fields to extract:
 *   wan_status_change:        { uplink, prevStatus, newStatus }
 *   vpn_connectivity_change:  { peerNetworkId, peerNetworkName, connectivity }
 *   ids_alert:               { signature, priority, destPort, protocol }
 *   uplink_connectivity_change: { uplinkInterface, connectivityBefore, connectivityAfter }
 */
export function mapMerakiEvent(raw: MerakiApplianceEvent): NormalizedEvent {
  const severity = inferMerakiEventSeverity(raw.type);
  const title = buildMerakiEventTitle(raw);

  return {
    rawEventId: `meraki-${raw.networkId}-${raw.type}-${new Date(raw.occurredAt).getTime()}`,
    eventSource: "meraki_dashboard",
    severity,
    eventType: raw.type,
    category: raw.category,    // Meraki event category (appliance_connectivity, vpn, security, device, etc.)
    title,
    description: buildMerakiEventDescription(raw),
    occurredAt: new Date(raw.occurredAt),
    controllerDeviceId: raw.deviceSerial,
    rawPayloadJson: {
      type: raw.type,
      category: raw.category,
      networkId: raw.networkId,
      networkName: raw.networkName,
      deviceSerial: raw.deviceSerial,
      deviceName: raw.deviceName,
      eventData: raw.eventData,
    },
  };
}

function buildMerakiEventTitle(raw: MerakiApplianceEvent): string {
  const net = raw.networkName ?? raw.networkId;
  const dev = raw.deviceName ?? raw.deviceSerial ?? "";
  const devPart = dev ? ` — ${dev}` : "";

  switch (raw.type) {
    case "wan_status_change": {
      const uplink = (raw.eventData.uplink as string) ?? "WAN";
      const prev = raw.eventData.prevStatus ?? raw.eventData.from;
      const next = raw.eventData.newStatus ?? raw.eventData.to;
      if (next === "failed" || next === "not connected") {
        return `${uplink} link down${devPart} (${net})`;
      }
      if (prev === "failed" && (next === "active" || next === "ready")) {
        return `${uplink} link restored${devPart} (${net})`;
      }
      return `${uplink} status changed: ${prev} → ${next}${devPart}`;
    }

    case "uplink_connectivity_change": {
      const iface = raw.eventData.uplinkInterface ?? "uplink";
      const after = raw.eventData.connectivityAfter as string;
      if (after === "lost") return `${iface} connectivity lost${devPart} (${net})`;
      if (after === "restored") return `${iface} connectivity restored${devPart} (${net})`;
      return `${iface} connectivity changed${devPart} (${net})`;
    }

    case "vpn_connectivity_change": {
      const peer = (raw.eventData.peerNetworkName as string) ?? (raw.eventData.peerNetworkId as string) ?? "peer";
      const conn = raw.eventData.connectivity as string;
      return `AutoVPN ${conn === "false" || conn === false ? "tunnel down" : "tunnel restored"} to ${peer} (${net})`;
    }

    case "vpn_registry_change": {
      const mode = raw.eventData.newMode ?? raw.eventData.mode;
      return `VPN registry changed: ${mode}${devPart} (${net})`;
    }

    case "firmware_upgrade_start":
      return `Firmware upgrade started${devPart} (${net})`;

    case "firmware_upgrade_complete":
      return `Firmware upgrade completed${devPart} (${net})`;

    case "device_checkin":
      return `Device check-in${devPart} (${net})`;

    case "ids_alert": {
      const sig = raw.eventData.signature ?? "unknown";
      return `IDS alert: ${sig}${devPart} (${net})`;
    }

    case "arp_inspection_block":
      return `ARP spoofing blocked${devPart} (${net})`;

    default:
      return `${raw.type.replace(/_/g, " ")}${devPart} (${net})`;
  }
}

function buildMerakiEventDescription(raw: MerakiApplianceEvent): string {
  const parts: string[] = [];

  // Start with Meraki's own description if present
  if (raw.description) parts.push(raw.description);

  // Add structured context from eventData
  switch (raw.type) {
    case "wan_status_change":
    case "uplink_connectivity_change": {
      const uplink = raw.eventData.uplink ?? raw.eventData.uplinkInterface;
      const prevStatus = raw.eventData.prevStatus ?? raw.eventData.from ?? raw.eventData.connectivityBefore;
      const newStatus = raw.eventData.newStatus ?? raw.eventData.to ?? raw.eventData.connectivityAfter;
      if (uplink) parts.push(`Interface: ${uplink}`);
      if (prevStatus && newStatus) parts.push(`Status transition: ${prevStatus} → ${newStatus}`);
      break;
    }

    case "vpn_connectivity_change": {
      const peer = raw.eventData.peerNetworkName ?? raw.eventData.peerNetworkId;
      const conn = raw.eventData.connectivity;
      if (peer) parts.push(`VPN peer: ${peer}`);
      if (conn !== undefined) parts.push(`Connectivity: ${conn}`);
      break;
    }

    case "ids_alert": {
      const { signature, message, priority, protocol, destPort } = raw.eventData as any;
      if (signature) parts.push(`Signature: ${signature}`);
      if (message) parts.push(`Message: ${message}`);
      if (priority) parts.push(`Priority: ${priority}`);
      if (protocol && destPort) parts.push(`Protocol/Port: ${protocol}/${destPort}`);
      break;
    }
  }

  return parts.join(" | ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data: realistic Meraki branch-network environment
//
// Represents a managed customer with HQ + 4 branches + a data center.
// Scenarios covered:
//   • Healthy HQ with warm-spare HA (WAN1 primary up, WAN2 standby)
//   • Branch with primary WAN down + LTE failover active (incident in progress)
//   • Branch with WAN up and AutoVPN degraded (packet loss)
//   • Branch recovering from recent firmware upgrade (informational)
//   • DC with 10G fiber primary + MPLS backup (both up, critical circuit)
//
// Each mock device/link/event maps through the same mapMerakiDevice /
// mapMerakiUplink / mapMerakiEvent functions that real API calls would use.
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ORG: MerakiOrganization = {
  id: "NXT-ORG-12345",
  name: "Nexatek Corporation",
  url: "https://n123.meraki.com/o/NXT-ORG-12345/manage/organization/overview",
  api: { enabled: true },
};

const MOCK_NETWORKS: MerakiNetwork[] = [
  {
    id: "N_001",
    organizationId: "NXT-ORG-12345",
    name: "Nexatek — HQ Chicago",
    productTypes: ["appliance", "switch", "wireless"],
    timeZone: "America/Chicago",
    tags: ["hq", "critical"],
    url: "https://n123.meraki.com/o/NXT-ORG-12345/manage/network/N_001",
  },
  {
    id: "N_002",
    organizationId: "NXT-ORG-12345",
    name: "Nexatek — Denver Warehouse",
    productTypes: ["appliance"],
    timeZone: "America/Denver",
    tags: ["branch", "warehouse"],
    url: "https://n123.meraki.com/o/NXT-ORG-12345/manage/network/N_002",
  },
  {
    id: "N_003",
    organizationId: "NXT-ORG-12345",
    name: "Nexatek — Austin Office",
    productTypes: ["appliance", "wireless"],
    timeZone: "America/Chicago",
    tags: ["branch"],
    url: "https://n123.meraki.com/o/NXT-ORG-12345/manage/network/N_003",
  },
  {
    id: "N_004",
    organizationId: "NXT-ORG-12345",
    name: "Nexatek — Phoenix Retail",
    productTypes: ["appliance", "switch"],
    timeZone: "America/Phoenix",
    tags: ["branch", "retail"],
    url: "https://n123.meraki.com/o/NXT-ORG-12345/manage/network/N_004",
  },
  {
    id: "N_005",
    organizationId: "NXT-ORG-12345",
    name: "Nexatek — Dallas DC",
    productTypes: ["appliance"],
    timeZone: "America/Chicago",
    tags: ["datacenter", "critical"],
    url: "https://n123.meraki.com/o/NXT-ORG-12345/manage/network/N_005",
  },
];

// Network lookup for enriching device/link/event records
const NETWORK_MAP: Record<string, MerakiNetwork> = Object.fromEntries(
  MOCK_NETWORKS.map((n) => [n.id, n])
);

const MOCK_DEVICE_STATUSES: MerakiDeviceStatus[] = [
  // HQ — MX85 warm-spare HA pair
  {
    serial: "Q2TN-XXXX-NXT1",
    name: "MX85-NXT-HQ-Active",
    model: "MX85",
    networkId: "N_001",
    mac: "e0:55:3d:10:01:01",
    lanIp: "10.0.1.1",
    publicIp: "203.0.113.5",
    lastReportedAt: new Date(Date.now() - 90 * 1000).toISOString(),
    status: "online",
    productType: "appliance",
  },
  {
    serial: "Q2TN-XXXX-NXT1S",
    name: "MX85-NXT-HQ-Spare",
    model: "MX85",
    networkId: "N_001",
    mac: "e0:55:3d:10:01:02",
    lanIp: "10.0.1.2",
    publicIp: null,
    lastReportedAt: new Date(Date.now() - 95 * 1000).toISOString(),
    status: "online",
    productType: "appliance",
  },
  // Denver Warehouse — MX67 offline (primary WAN down, LTE failover active)
  {
    serial: "Q2TN-XXXX-NXT2",
    name: "MX67-NXT-Denver",
    model: "MX67",
    networkId: "N_002",
    mac: "e0:55:3d:20:02:01",
    lanIp: "10.1.1.1",
    publicIp: "72.14.195.201",   // LTE public IP (not DIA)
    lastReportedAt: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
    status: "alerting",           // Online via LTE but has active alerts
    productType: "appliance",
  },
  // Austin Office — MX68 online, AutoVPN degraded
  {
    serial: "Q2TN-XXXX-NXT3",
    name: "MX68-NXT-Austin",
    model: "MX68",
    networkId: "N_003",
    mac: "e0:55:3d:30:03:01",
    lanIp: "10.2.1.1",
    publicIp: "12.141.99.44",
    lastReportedAt: new Date(Date.now() - 60 * 1000).toISOString(),
    status: "online",
    productType: "appliance",
  },
  // Phoenix Retail — MX67 online, recently upgraded firmware
  {
    serial: "Q2TN-XXXX-NXT4",
    name: "MX67-NXT-Phoenix",
    model: "MX67",
    networkId: "N_004",
    mac: "e0:55:3d:40:04:01",
    lanIp: "10.3.1.1",
    publicIp: "67.199.143.88",
    lastReportedAt: new Date(Date.now() - 45 * 1000).toISOString(),
    status: "online",
    productType: "appliance",
  },
  // Dallas DC — MX450 high-capacity appliance
  {
    serial: "Q2TN-XXXX-NXT5",
    name: "MX450-NXT-DC-Dallas",
    model: "MX450",
    networkId: "N_005",
    mac: "e0:55:3d:50:05:01",
    lanIp: "10.4.1.1",
    publicIp: "208.55.248.12",
    lastReportedAt: new Date(Date.now() - 30 * 1000).toISOString(),
    status: "online",
    productType: "appliance",
  },
];

const MOCK_UPLINK_STATUSES: MerakiUplinkStatusRecord[] = [
  // HQ: Zayo 1G primary + Comcast backup (warm spare HA, both on active unit)
  {
    networkId: "N_001",
    networkName: "Nexatek — HQ Chicago",
    serial: "Q2TN-XXXX-NXT1",
    model: "MX85",
    highAvailability: { enabled: true, role: "primary" },
    uplinks: [
      {
        interface: "WAN1",
        status: "active",
        ip: "203.0.113.5",
        publicIp: "203.0.113.5",
        gateway: "203.0.113.1",
        primaryDns: "8.8.8.8",
        secondaryDns: "8.8.4.4",
        ipAssignedBy: "static",
        provider: "Zayo",
      },
      {
        interface: "WAN2",
        status: "ready",
        ip: "98.27.44.190",
        publicIp: "98.27.44.190",
        gateway: "98.27.44.1",
        primaryDns: "75.75.75.75",
        secondaryDns: "75.75.76.76",
        ipAssignedBy: "dhcp",
        provider: "Comcast Business",
      },
    ],
  },
  // HQ Spare: same links, standby role
  {
    networkId: "N_001",
    networkName: "Nexatek — HQ Chicago",
    serial: "Q2TN-XXXX-NXT1S",
    model: "MX85",
    highAvailability: { enabled: true, role: "spare" },
    uplinks: [
      {
        interface: "WAN1",
        status: "ready",
        ip: null,
        publicIp: null,
        gateway: null,
        primaryDns: null,
        secondaryDns: null,
        ipAssignedBy: "dhcp",
        provider: null,
      },
    ],
  },
  // Denver: primary WAN failed, cellular active (incident in progress)
  {
    networkId: "N_002",
    networkName: "Nexatek — Denver Warehouse",
    serial: "Q2TN-XXXX-NXT2",
    model: "MX67",
    uplinks: [
      {
        interface: "WAN1",
        status: "failed",
        ip: null,
        publicIp: null,
        gateway: null,
        primaryDns: null,
        secondaryDns: null,
        ipAssignedBy: "dhcp",
        provider: "Comcast Business",
      },
      {
        interface: "Cellular",
        status: "active",   // LTE failover is now carrying traffic
        ip: "10.128.0.5",
        publicIp: "72.14.195.201",
        gateway: "10.128.0.1",
        primaryDns: "8.8.8.8",
        secondaryDns: "8.8.4.4",
        ipAssignedBy: "dhcp",
        provider: "AT&T",
      },
    ],
  },
  // Austin: WAN1 up, WAN2 ready standby
  {
    networkId: "N_003",
    networkName: "Nexatek — Austin Office",
    serial: "Q2TN-XXXX-NXT3",
    model: "MX68",
    uplinks: [
      {
        interface: "WAN1",
        status: "active",
        ip: "12.141.99.44",
        publicIp: "12.141.99.44",
        gateway: "12.141.99.1",
        primaryDns: "8.8.8.8",
        secondaryDns: "1.1.1.1",
        ipAssignedBy: "static",
        provider: "AT&T Business Fiber",
      },
      {
        interface: "WAN2",
        status: "ready",
        ip: "76.220.14.88",
        publicIp: "76.220.14.88",
        gateway: "76.220.14.1",
        primaryDns: "75.75.75.75",
        secondaryDns: null,
        ipAssignedBy: "dhcp",
        provider: "Spectrum Business",
      },
    ],
  },
  // Phoenix: WAN1 up, WAN2 ready
  {
    networkId: "N_004",
    networkName: "Nexatek — Phoenix Retail",
    serial: "Q2TN-XXXX-NXT4",
    model: "MX67",
    uplinks: [
      {
        interface: "WAN1",
        status: "active",
        ip: "67.199.143.88",
        publicIp: "67.199.143.88",
        gateway: "67.199.143.1",
        primaryDns: "8.8.8.8",
        secondaryDns: "8.8.4.4",
        ipAssignedBy: "dhcp",
        provider: "Cox Business",
      },
      {
        interface: "WAN2",
        status: "ready",
        ip: "172.58.99.4",
        publicIp: "172.58.99.4",
        gateway: "172.58.99.1",
        primaryDns: "208.67.222.222",
        secondaryDns: null,
        ipAssignedBy: "dhcp",
        provider: "Verizon LTE",
      },
    ],
  },
  // Dallas DC: Zayo 10G primary + Lumen MPLS backup (both active, critical)
  {
    networkId: "N_005",
    networkName: "Nexatek — Dallas DC",
    serial: "Q2TN-XXXX-NXT5",
    model: "MX450",
    uplinks: [
      {
        interface: "WAN1",
        status: "active",
        ip: "208.55.248.12",
        publicIp: "208.55.248.12",
        gateway: "208.55.248.1",
        primaryDns: "8.8.8.8",
        secondaryDns: "8.8.4.4",
        ipAssignedBy: "static",
        provider: "Zayo 10G",
      },
      {
        interface: "WAN2",
        status: "active",    // Both WAN active on DC (dual-homed, not failover)
        ip: "66.28.112.44",
        publicIp: "66.28.112.44",
        gateway: "66.28.112.1",
        primaryDns: "4.2.2.2",
        secondaryDns: "4.2.2.1",
        ipAssignedBy: "static",
        provider: "Lumen MPLS",
      },
    ],
  },
];

const MOCK_EVENTS: MerakiApplianceEvent[] = [
  // Denver branch: WAN1 failure (incident in progress)
  {
    occurredAt: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
    networkId: "N_002",
    networkName: "Nexatek — Denver Warehouse",
    type: "uplink_connectivity_change",
    description: "WAN1 uplink connectivity changed from \"good\" to \"lost\"",
    category: "appliance_connectivity",
    deviceSerial: "Q2TN-XXXX-NXT2",
    deviceName: "MX67-NXT-Denver",
    eventData: {
      uplinkInterface: "WAN1",
      uplinkIp: "10.1.1.254",
      connectivityBefore: "good",
      connectivityAfter: "lost",
      alertType: "uplink_connectivity_change",
    },
  },
  // Denver: LTE failover activated (follows WAN1 failure)
  {
    occurredAt: new Date(Date.now() - 2.5 * 3600 * 1000 + 12000).toISOString(),
    networkId: "N_002",
    networkName: "Nexatek — Denver Warehouse",
    type: "wan_status_change",
    description: "WAN status changed from active to failed on WAN1; Cellular failover activated",
    category: "appliance_connectivity",
    deviceSerial: "Q2TN-XXXX-NXT2",
    deviceName: "MX67-NXT-Denver",
    eventData: {
      uplink: "WAN1",
      prevStatus: "active",
      newStatus: "failed",
      activeFailover: "Cellular",
      provider: "Comcast Business",
      circuitId: "CMC-BIZ-190224-B",
    },
  },
  // Austin: AutoVPN degraded to HQ (packet loss on primary WAN)
  {
    occurredAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    networkId: "N_003",
    networkName: "Nexatek — Austin Office",
    type: "vpn_connectivity_change",
    description: "VPN connectivity to hub changed",
    category: "vpn",
    deviceSerial: "Q2TN-XXXX-NXT3",
    deviceName: "MX68-NXT-Austin",
    eventData: {
      peerNetworkId: "N_001",
      peerNetworkName: "Nexatek — HQ Chicago",
      connectivity: "false",
      reason: "Packet loss on primary uplink exceeded threshold (8.3%)",
    },
  },
  // Phoenix: firmware upgrade completed (informational)
  {
    occurredAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    networkId: "N_004",
    networkName: "Nexatek — Phoenix Retail",
    type: "firmware_upgrade_complete",
    description: "Firmware upgrade to MX 18.211 completed successfully",
    category: "device",
    deviceSerial: "Q2TN-XXXX-NXT4",
    deviceName: "MX67-NXT-Phoenix",
    eventData: {
      fromVersion: "MX 18.107.2",
      toVersion: "MX 18.211",
      durationSeconds: 247,
      restartRequired: true,
    },
  },
  // HQ: ARP inspection block (security event)
  {
    occurredAt: new Date(Date.now() - 22 * 60 * 1000).toISOString(),
    networkId: "N_001",
    networkName: "Nexatek — HQ Chicago",
    type: "arp_inspection_block",
    description: "ARP packet blocked by dynamic ARP inspection",
    category: "security",
    deviceSerial: "Q2TN-XXXX-NXT1",
    deviceName: "MX85-NXT-HQ-Active",
    eventData: {
      senderIp: "10.0.1.155",
      senderMac: "aa:bb:cc:dd:ee:ff",
      targetIp: "10.0.1.1",
      vlanId: 100,
      port: "eth3",
    },
  },
  // HQ: Device check-in (informational)
  {
    occurredAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    networkId: "N_001",
    networkName: "Nexatek — HQ Chicago",
    type: "device_checkin",
    description: "Scheduled device check-in completed",
    category: "device",
    deviceSerial: "Q2TN-XXXX-NXT1",
    deviceName: "MX85-NXT-HQ-Active",
    eventData: {
      checkStatus: "ok",
      firmware: "MX 18.211",
      uptime: 1209600,  // 14 days in seconds
    },
  },
  // Dallas DC: VPN registry change (spoke site came online)
  {
    occurredAt: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
    networkId: "N_005",
    networkName: "Nexatek — Dallas DC",
    type: "vpn_registry_change",
    description: "VPN registry updated: Phoenix Retail registered as spoke",
    category: "vpn",
    deviceSerial: "Q2TN-XXXX-NXT5",
    deviceName: "MX450-NXT-DC-Dallas",
    eventData: {
      newMode: "spoke",
      registeredSpokeNetworkId: "N_004",
      registeredSpokeNetworkName: "Nexatek — Phoenix Retail",
      hubNetworkId: "N_005",
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Circuit ID hints (manually configured in our system, not available from Meraki API)
// In production, operators set these in the service record or controller config.
// ─────────────────────────────────────────────────────────────────────────────
const CIRCUIT_ID_HINTS: Record<string, Record<string, string>> = {
  "Q2TN-XXXX-NXT1": { WAN1: "ZYO-DIA-HQ-001", WAN2: "CMC-BIZ-HQ-002" },
  "Q2TN-XXXX-NXT2": { WAN1: "CMC-BIZ-190224-B" },
  "Q2TN-XXXX-NXT3": { WAN1: "ATT-BIZ-AUS-101" },
  "Q2TN-XXXX-NXT4": { WAN1: "COX-BIZ-PHX-044" },
  "Q2TN-XXXX-NXT5": { WAN1: "ZYO-DIA-DAL-10G-005", WAN2: "LMN-MPLS-DAL-006" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Connector class
// ─────────────────────────────────────────────────────────────────────────────

export class MerakiConnector implements BaseConnector {
  readonly vendor = "meraki";
  private readonly config: MerakiConnectorConfig;

  constructor(config: MerakiConnectorConfig) {
    this.config = config;
  }

  private get isDemoMode(): boolean {
    return !this.config.apiKey || this.config.apiKey === "placeholder";
  }

  /**
   * Standard headers for all Meraki Dashboard API requests.
   *
   * REAL USAGE: Replace config.apiKey with the actual key from the controller record.
   * The key is passed as a custom header — NOT as a Bearer token or query param.
   */
  private headers(): HeadersInit {
    return {
      "X-Cisco-Meraki-API-Key": this.config.apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    };
  }

  /**
   * Helper for authenticated GET requests to the Meraki API.
   * Handles rate limiting (429) with a single retry after the Retry-After delay.
   *
   * REAL USAGE: This method is used by all real API call implementations.
   * In demo mode it is never called — mock methods return directly.
   */
  private async merakiGet<T>(path: string): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const resp = await fetch(url, { headers: this.headers() });

    // Handle Meraki rate limiting (300 req/min per org)
    if (resp.status === 429) {
      const retryAfter = parseInt(resp.headers.get("Retry-After") ?? "1", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      const retried = await fetch(url, { headers: this.headers() });
      if (!retried.ok) throw new Error(`Meraki API error: ${retried.status} ${retried.statusText}`);
      return retried.json() as Promise<T>;
    }

    if (!resp.ok) throw new Error(`Meraki API error: ${resp.status} ${resp.statusText}`);
    return resp.json() as Promise<T>;
  }

  // ── Public sync methods ───────────────────────────────────────────────────

  /**
   * Test connectivity to Meraki Dashboard API.
   *
   * REAL MERAKI API CALL:
   *   GET /organizations/{organizationId}
   *   → Returns MerakiOrganization
   *
   * A successful response proves:
   *   1. The API key is valid
   *   2. The key has access to this organizationId
   *   3. The API is reachable from our server
   */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    if (this.isDemoMode) {
      return {
        ok: true,
        message: `Demo mode: Meraki connection simulated for org "${MOCK_ORG.name}" (${MOCK_ORG.id}) — provide a real API key to enable live polling`,
      };
    }

    try {
      // REAL MERAKI API CALL:
      const org = await this.merakiGet<MerakiOrganization>(
        `/organizations/${this.config.organizationId}`
      );
      return {
        ok: true,
        message: `Connected to Meraki org: "${org.name}" (ID: ${org.id}) — Dashboard API enabled: ${org.api.enabled}`,
      };
    } catch (err: any) {
      return { ok: false, message: `Meraki connection failed: ${err.message}` };
    }
  }

  /**
   * Fetch all networks in this organization.
   * Networks correspond to physical sites — each MX appliance belongs to one network.
   *
   * REAL MERAKI API CALL:
   *   GET /organizations/{organizationId}/networks
   *   → Returns MerakiNetwork[]
   *
   * Use this list to:
   *   1. Enrich device/event records with human-readable network names
   *   2. Enumerate per-network event feeds
   *   3. Map networks to Sites in our system (by name matching or manual mapping)
   */
  async syncNetworks(): Promise<MerakiNetwork[]> {
    if (this.isDemoMode) return MOCK_NETWORKS;

    // REAL MERAKI API CALL:
    return this.merakiGet<MerakiNetwork[]>(
      `/organizations/${this.config.organizationId}/networks`
    );
  }

  /**
   * Sync all MX/MS/MR devices and their statuses.
   *
   * REAL MERAKI API CALL:
   *   GET /organizations/{organizationId}/devices/statuses
   *   → Returns MerakiDeviceStatus[]
   *
   * This endpoint returns ALL device types (MX, MS, MR, MV, MT).
   * We filter to productType "appliance" for MX security appliances,
   * which are the devices that manage WAN uplinks and VPN.
   *
   * For HA (warm spare) pairs, both devices appear as separate entries.
   * HA role (primary/spare) is determined from the uplink statuses endpoint.
   */
  async syncDevices(): Promise<NormalizedDevice[]> {
    if (this.isDemoMode) {
      // Enrich each device with its network name from the mock network registry
      return MOCK_DEVICE_STATUSES.map((d) => ({
        ...mapMerakiDevice(d),
        networkName: NETWORK_MAP[d.networkId]?.name,
      }));
    }

    // REAL MERAKI API CALL:
    const [rawDevices, networks] = await Promise.all([
      this.merakiGet<MerakiDeviceStatus[]>(
        `/organizations/${this.config.organizationId}/devices/statuses`
      ),
      this.syncNetworks(),
    ]);

    const networkNameMap: Record<string, string> = Object.fromEntries(
      networks.map((n) => [n.id, n.name])
    );

    // Filter to appliances only, map, then enrich with network name
    return rawDevices
      .filter((d) => d.productType === "appliance")
      .map((d) => ({
        ...mapMerakiDevice(d),
        networkName: networkNameMap[d.networkId],
      }));
  }

  /**
   * Sync WAN uplink statuses for all MX appliances.
   *
   * REAL MERAKI API CALL:
   *   GET /organizations/{organizationId}/appliance/uplink/statuses
   *   → Returns MerakiUplinkStatusRecord[]
   *
   * Each record has a serial (maps to a device) and an uplinks array.
   * For HA pairs, only the active unit will show WAN IP assignments.
   *
   * NOTE: Real-time latency/jitter/packet loss are NOT available from this
   * endpoint. For performance metrics, poll:
   *   GET /organizations/{orgId}/appliance/uplinks/usage/byNetwork
   *   (requires Dashboard API Advanced or Premium license)
   *
   * We enrich each uplink with:
   *   - Circuit IDs from our own CIRCUIT_ID_HINTS lookup (operator-configured)
   *   - Network names from a networks lookup
   */
  async syncLinks(): Promise<NormalizedLink[]> {
    if (this.isDemoMode) {
      return MOCK_UPLINK_STATUSES.flatMap((record) => {
        // Detect failover: any WAN1 on this device is "failed" or "not connected"
        const primaryFailed = record.uplinks.some(
          (u) => u.interface === "WAN1" && (u.status === "failed" || u.status === "not connected")
        );
        return record.uplinks.map((uplink) => {
          // A backup/cellular uplink is "failover active" when:
          //   1. It's not the primary (WAN2 or Cellular)
          //   2. The primary WAN failed
          //   3. This uplink is "active" (carrying traffic)
          const isFailoverActive =
            uplink.interface !== "WAN1" &&
            primaryFailed &&
            uplink.status === "active";

          return mapMerakiUplink(
            uplink,
            record.serial,
            record.networkName ?? record.networkId,
            CIRCUIT_ID_HINTS[record.serial]?.[uplink.interface],
            isFailoverActive
          );
        });
      });
    }

    // REAL MERAKI API CALL:
    const [uplinkStatuses, networks] = await Promise.all([
      this.merakiGet<MerakiUplinkStatusRecord[]>(
        `/organizations/${this.config.organizationId}/appliance/uplink/statuses`
      ),
      this.syncNetworks(),
    ]);

    const networkNameMap: Record<string, string> = Object.fromEntries(
      networks.map((n) => [n.id, n.name])
    );

    return uplinkStatuses.flatMap((record) =>
      record.uplinks.map((uplink) =>
        mapMerakiUplink(
          uplink,
          record.serial,
          networkNameMap[record.networkId] ?? record.networkId,
          CIRCUIT_ID_HINTS[record.serial]?.[uplink.interface]
        )
      )
    );
  }

  /**
   * Sync recent appliance events.
   *
   * REAL MERAKI API CALL (per-network approach — more complete):
   *   For each networkId from syncNetworks() that includes "appliance":
   *     GET /networks/{networkId}/events?productTypes[]=appliance&perPage=100
   *   → Returns { pageStartAt, pageEndAt, events: MerakiApplianceEvent[] }
   *
   * OR org-level security events only (simpler, less complete):
   *   GET /organizations/{organizationId}/appliance/security/events
   *   → Returns MerakiApplianceEvent[] (only IDS/security events)
   *
   * The per-network approach covers all event types including:
   *   wan_status_change, uplink_connectivity_change, vpn_connectivity_change,
   *   firmware_upgrade_*, device_checkin, arp_inspection_block, ids_alert
   *
   * Pagination: Meraki uses Link header with next/prev URLs.
   * For monitoring, 100 events per network per sync is typically sufficient.
   *
   * De-duplication: rawEventId = "{networkId}-{type}-{timestamp_ms}"
   * This ensures the same physical event is not inserted twice on re-sync.
   */
  async syncEvents(): Promise<NormalizedEvent[]> {
    if (this.isDemoMode) {
      return MOCK_EVENTS.map(mapMerakiEvent);
    }

    // REAL MERAKI API CALL (per-network):
    const networks = await this.syncNetworks();
    const applianceNetworks = networks.filter((n) =>
      n.productTypes.includes("appliance")
    );

    const allEvents: NormalizedEvent[] = [];

    // Fetch events for each network concurrently
    // (Meraki rate limit: 300 calls/min per org — batch if > 5 networks)
    const batchSize = 5;
    for (let i = 0; i < applianceNetworks.length; i += batchSize) {
      const batch = applianceNetworks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(async (network) => {
          try {
            const resp = await this.merakiGet<{ events: MerakiApplianceEvent[] }>(
              `/networks/${network.id}/events?productTypes[]=appliance&perPage=100`
            );
            return (resp.events ?? []).map((evt) => ({
              ...evt,
              networkName: network.name,  // enrich with human-readable name
            }));
          } catch {
            return [];  // Don't fail entire sync if one network errors
          }
        })
      );
      allEvents.push(...batchResults.flat().map(mapMerakiEvent));
    }

    return allEvents;
  }

  /**
   * Full sync: devices + links + events in parallel.
   * Returns all normalized records plus any per-step errors.
   */
  async fullSync(): Promise<ConnectorSyncResult> {
    const errors: string[] = [];

    const [devices, links, events] = await Promise.allSettled([
      this.syncDevices(),
      this.syncLinks(),
      this.syncEvents(),
    ]);

    return {
      devices: devices.status === "fulfilled" ? devices.value : (errors.push(`devices: ${(devices as any).reason}`), []),
      links:   links.status   === "fulfilled" ? links.value   : (errors.push(`links: ${(links as any).reason}`), []),
      events:  events.status  === "fulfilled" ? events.value  : (errors.push(`events: ${(events as any).reason}`), []),
      errors,
    };
  }
}
