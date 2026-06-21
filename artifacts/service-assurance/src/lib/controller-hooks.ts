/**
 * Custom React Query hooks for the controller integration endpoints.
 * These are hand-written since the OpenAPI spec is not regenerated.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getToken } from './token';

const BASE_URL = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ControllerRecord {
  id: string;
  name: string;
  vendor: 'meraki' | 'fortinet';
  type: 'sdwan' | 'firewall_manager' | 'network_manager';
  baseUrl: string;
  authType: string;
  apiKeyEncryptedOrPlaceholder: string | null;
  organizationIdOrTenant: string | null;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
  lastPolledAt: string | null;
  lastPollStatus: 'success' | 'failed' | 'running' | null;
  lastPollMessage: string | null;
  createdAt: string;
  updatedAt: string;
  deviceCount?: number;
  eventCount?: number;
}

export interface ControllerSyncLog {
  id: string;
  controllerId: string;
  syncType: string;
  startedAt: string;
  completedAt: string | null;
  status: 'running' | 'success' | 'failed';
  message: string | null;
  recordsProcessed: number | null;
}

export interface ManagedDeviceRecord {
  id: string;
  controllerId: string;
  customerId: string | null;
  siteId: string | null;
  hostname: string;
  deviceType: 'firewall' | 'sdwan_edge' | 'appliance' | 'switch' | 'gateway';
  vendor: string;
  serialNumber: string | null;
  controllerDeviceId: string;
  model: string | null;
  mgmtIp: string | null;
  status: 'online' | 'offline' | 'degraded' | 'unknown';
  haState: 'active' | 'standby' | 'standalone' | 'unknown' | null;
  /** Controller-native network/site name (e.g. Meraki network name, FortiManager ADOM) */
  networkName: string | null;
  /** WGS-84 latitude — null means inherit from site for map display */
  latitude: number | null;
  /** WGS-84 longitude — null means inherit from site for map display */
  longitude: number | null;
  /** Origin of the coordinate */
  geoSource: string | null;
  lastSeenAt: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  controller?: { id: string; name: string; vendor: string } | null;
  customer?: { id: string; name: string } | null;
  site?: { id: string; siteName: string } | null;
  links?: NetworkLinkRecord[];
  recentEvents?: DeviceEventRecord[];
  linkedTickets?: Array<{
    id: string;
    ticketNumber: string;
    title: string;
    status: string;
    severity: string;
  }>;
}

export interface NetworkLinkRecord {
  id: string;
  managedDeviceId: string;
  serviceId: string | null;
  customerId: string | null;
  siteId: string | null;
  linkName: string;
  linkType:
    | 'internet'
    | 'mpls'
    | 'lte'
    | 'broadband'
    | 'wan_uplink'
    | 'vpn_tunnel'
    | 'sdwan_transport';
  providerName: string | null;
  circuitId: string | null;
  role: 'primary' | 'backup' | 'unknown';
  status: 'up' | 'down' | 'degraded' | 'unknown';
  /** True when a backup/cellular link is actively carrying traffic due to primary failure */
  failoverActive: boolean;
  /** Controller-native network name (e.g. Meraki network name) */
  networkName: string | null;
  latencyMs: number | null;
  jitterMs: number | null;
  packetLossPct: number | null;
  lastPolledAt: string | null;
  createdAt: string;
  updatedAt: string;
  device?: { id: string; hostname: string; vendor: string } | null;
  customer?: { id: string; name: string } | null;
  site?: { id: string; siteName: string } | null;
}

export interface DeviceEventRecord {
  id: string;
  controllerId: string;
  managedDeviceId: string | null;
  customerId: string | null;
  siteId: string | null;
  serviceId: string | null;
  rawEventId: string;
  eventSource: string;
  severity: 'informational' | 'low' | 'medium' | 'high' | 'critical';
  eventType: string;
  title: string;
  description: string | null;
  normalizedStatus: string | null;
  aiSummary: string | null;
  aiProbableImpact: string | null;
  aiCustomerUpdate: string | null;
  confidenceScore: number | null;
  /** Vendor event category (e.g. "appliance_connectivity", "vpn", "security", "ha", "firmware") */
  category: string | null;
  occurredAt: string;
  createdAt: string;
  controller?: { id: string; name: string; vendor: string } | null;
  customer?: { id: string; name: string } | null;
  linkedTickets?: Array<{ id: string; ticketNumber: string; title: string; status: string }>;
  correlations?: Array<{ id: string; correlationType: string }>;
}

// ── Controllers ────────────────────────────────────────────────────────────

export const CONTROLLERS_QUERY_KEY = ['controllers'] as const;
export const controllerQueryKey = (id: string) => ['controllers', id] as const;

export function useGetControllers() {
  return useQuery({
    queryKey: CONTROLLERS_QUERY_KEY,
    queryFn: () => apiFetch<ControllerRecord[]>('/controllers'),
  });
}

export function useGetController(id: string) {
  return useQuery({
    queryKey: controllerQueryKey(id),
    queryFn: () =>
      apiFetch<
        ControllerRecord & {
          recentSyncLogs: ControllerSyncLog[];
          recentEvents: DeviceEventRecord[];
        }
      >(`/controllers/${id}`),
    enabled: !!id,
  });
}

export function useCreateController() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<ControllerRecord>) =>
      apiFetch<ControllerRecord>('/controllers', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTROLLERS_QUERY_KEY }),
  });
}

export function useUpdateController() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ControllerRecord> }) =>
      apiFetch<ControllerRecord>(`/controllers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: CONTROLLERS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: controllerQueryKey(id) });
    },
  });
}

export function useDeleteController() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ success: boolean }>(`/controllers/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTROLLERS_QUERY_KEY }),
  });
}

export function useTestControllerConnection() {
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean; message: string }>(`/controllers/${id}/test`, { method: 'POST' }),
  });
}

export function useSyncController() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ syncLogId: string; message: string }>(`/controllers/${id}/sync`, {
        method: 'POST',
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTROLLERS_QUERY_KEY }),
  });
}

export function useSyncAllControllers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ message: string; started: number }>('/controllers/sync/all', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: CONTROLLERS_QUERY_KEY }),
  });
}

// ── Managed Devices ────────────────────────────────────────────────────────

export const DEVICES_QUERY_KEY = ['devices'] as const;
export const deviceQueryKey = (id: string) => ['devices', id] as const;

export function useGetDevices(params?: {
  customerId?: string;
  siteId?: string;
  controllerId?: string;
  status?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.customerId) searchParams.set('customerId', params.customerId);
  if (params?.siteId) searchParams.set('siteId', params.siteId);
  if (params?.controllerId) searchParams.set('controllerId', params.controllerId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: [...DEVICES_QUERY_KEY, params],
    queryFn: () => apiFetch<ManagedDeviceRecord[]>(`/devices${qs ? `?${qs}` : ''}`),
  });
}

export function useGetDevice(id: string) {
  return useQuery({
    queryKey: deviceQueryKey(id),
    queryFn: () => apiFetch<ManagedDeviceRecord>(`/devices/${id}`),
    enabled: !!id,
  });
}

export function useUpdateDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ManagedDeviceRecord> }) =>
      apiFetch<ManagedDeviceRecord>(`/devices/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: DEVICES_QUERY_KEY });
      qc.invalidateQueries({ queryKey: deviceQueryKey(id) });
    },
  });
}

// ── Network Links ──────────────────────────────────────────────────────────

export const LINKS_QUERY_KEY = ['network-links'] as const;

export function useGetNetworkLinks(params?: {
  customerId?: string;
  siteId?: string;
  status?: string;
  role?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.customerId) searchParams.set('customerId', params.customerId);
  if (params?.siteId) searchParams.set('siteId', params.siteId);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.role) searchParams.set('role', params.role);
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: [...LINKS_QUERY_KEY, params],
    queryFn: () => apiFetch<NetworkLinkRecord[]>(`/network-links${qs ? `?${qs}` : ''}`),
  });
}

// ── Device Events ──────────────────────────────────────────────────────────

export const EVENTS_QUERY_KEY = ['device-events'] as const;
export const eventQueryKey = (id: string) => ['device-events', id] as const;

export function useGetDeviceEvents(params?: {
  controllerId?: string;
  customerId?: string;
  siteId?: string;
  severity?: string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params?.controllerId) searchParams.set('controllerId', params.controllerId);
  if (params?.customerId) searchParams.set('customerId', params.customerId);
  if (params?.siteId) searchParams.set('siteId', params.siteId);
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.search) searchParams.set('search', params.search);
  const qs = searchParams.toString();

  return useQuery({
    queryKey: [...EVENTS_QUERY_KEY, params],
    queryFn: () => apiFetch<DeviceEventRecord[]>(`/device-events${qs ? `?${qs}` : ''}`),
  });
}

export function useGetDeviceEvent(id: string) {
  return useQuery({
    queryKey: eventQueryKey(id),
    queryFn: () => apiFetch<DeviceEventRecord>(`/device-events/${id}`),
    enabled: !!id,
  });
}

export function useAiAnalyzeEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{
        aiSummary: string;
        aiProbableImpact: string;
        confidence: number;
        normalizedStatus: string;
      }>(`/device-events/${id}/ai-analyze`, { method: 'POST' }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: EVENTS_QUERY_KEY });
      qc.invalidateQueries({ queryKey: eventQueryKey(id) });
    },
  });
}
