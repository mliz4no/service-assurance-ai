import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetSites, useGetCustomers, useGetTickets } from "@workspace/api-client-react";
import { useGetDevices } from "@/lib/controller-hooks";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Server, X, ExternalLink, Radio, AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import type { Site } from "@workspace/api-client-react";
import type { ManagedDeviceRecord } from "@/lib/controller-hooks";

// ─── Status colour palette ────────────────────────────────────────────────────

const STATUS = {
  online:   { fill: "#16a34a", ring: "#14532d", text: "Online",   tw: "bg-green-100 text-green-800 border-green-300" },
  degraded: { fill: "#d97706", ring: "#92400e", text: "Degraded", tw: "bg-amber-100 text-amber-800 border-amber-300" },
  offline:  { fill: "#dc2626", ring: "#7f1d1d", text: "Offline",  tw: "bg-red-100 text-red-800 border-red-300" },
  unknown:  { fill: "#64748b", ring: "#334155", text: "Unknown",  tw: "bg-slate-100 text-slate-600 border-slate-300" },
} as const;

type StatusKey = keyof typeof STATUS;

function statusKey(s: string | undefined | null): StatusKey {
  if (s === "online" || s === "degraded" || s === "offline") return s;
  return "unknown";
}

// ─── Marker icon factories ────────────────────────────────────────────────────

function createSiteIcon(status: StatusKey, hasOpenTickets: boolean): L.DivIcon {
  const p = STATUS[status];
  const alert = hasOpenTickets
    ? `<circle cx="24" cy="6" r="5" fill="#dc2626"/><text x="24" y="9.5" text-anchor="middle" font-size="6" font-weight="bold" fill="white" font-family="system-ui">!</text>`
    : "";
  return L.divIcon({
    className: "",
    iconSize: [30, 38],
    iconAnchor: [15, 38],
    popupAnchor: [0, -40],
    html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.716 0 0 6.716 0 15c0 9.941 15 23 15 23s15-13.059 15-23C30 6.716 23.284 0 15 0z" fill="${p.ring}"/>
      <path d="M15 2C7.82 2 2 7.82 2 15c0 8.8 13 20.2 13 20.2S28 23.8 28 15C28 7.82 22.18 2 15 2z" fill="${p.fill}"/>
      <rect x="9" y="8" width="12" height="9" rx="1" fill="white" opacity="0.9"/>
      <rect x="11" y="10" width="3" height="3" rx="0.5" fill="${p.fill}"/>
      <rect x="16" y="10" width="3" height="3" rx="0.5" fill="${p.fill}"/>
      <rect x="12" y="14" width="6" height="3" rx="0.5" fill="${p.fill}"/>
      ${alert}
    </svg>`,
  });
}

function createDeviceIcon(status: StatusKey): L.DivIcon {
  const p = STATUS[status];
  return L.divIcon({
    className: "",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -13],
    html: `<svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
      <circle cx="11" cy="11" r="11" fill="${p.ring}"/>
      <circle cx="11" cy="11" r="9.5" fill="${p.fill}"/>
      <rect x="6" y="7" width="10" height="8" rx="1" fill="white" opacity="0.9"/>
      <rect x="8" y="9" width="6" height="1.5" rx="0.5" fill="${p.fill}"/>
      <rect x="8" y="11.5" width="4" height="1.5" rx="0.5" fill="${p.fill}"/>
    </svg>`,
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const k = statusKey(status);
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${STATUS[k].tw}`}>
      {k === "online" && <CheckCircle2 className="w-3 h-3" />}
      {k === "degraded" && <AlertTriangle className="w-3 h-3" />}
      {k === "offline" && <Radio className="w-3 h-3" />}
      {k === "unknown" && <Circle className="w-3 h-3" />}
      {STATUS[k].text}
    </span>
  );
}

// ─── Site detail panel ────────────────────────────────────────────────────────

interface SiteDetailProps {
  site: Site;
  devices: ManagedDeviceRecord[];
  openTicketCount: number;
  onClose: () => void;
}

function SiteDetailPanel({ site, devices, openTicketCount, onClose }: SiteDetailProps) {
  const devicesByStatus = useMemo(() => {
    const counts: Record<string, number> = { online: 0, degraded: 0, offline: 0, unknown: 0 };
    for (const d of devices) counts[statusKey(d.status)] = (counts[statusKey(d.status)] || 0) + 1;
    return counts;
  }, [devices]);

  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-xl border border-border w-72 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold truncate text-sm">{site.siteName}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-slate-300 hover:text-white transition-colors shrink-0"
          aria-label="Close"
          data-testid="map-detail-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {site.siteCode && (
          <p className="text-xs font-mono text-muted-foreground">{site.siteCode}</p>
        )}

        {(site.city || site.state) && (
          <p className="text-sm text-muted-foreground">
            {[site.address1, site.city, site.state].filter(Boolean).join(", ")}
          </p>
        )}

        <div className="flex items-center gap-2">
          {devices.length > 0 && <StatusBadge status={
            devicesByStatus.offline > 0 ? "offline"
              : devicesByStatus.degraded > 0 ? "degraded"
              : devicesByStatus.online > 0 ? "online"
              : "unknown"
          } />}
          {openTicketCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
              <AlertTriangle className="w-3 h-3" />
              {openTicketCount} open ticket{openTicketCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {devices.length > 0 && (
          <div className="grid grid-cols-4 gap-1">
            {(["online", "degraded", "offline", "unknown"] as StatusKey[]).map(s => (
              devicesByStatus[s] > 0 && (
                <div key={s} className={`rounded p-1.5 text-center border ${STATUS[s].tw}`}>
                  <div className="text-base font-bold leading-none">{devicesByStatus[s]}</div>
                  <div className="text-xs mt-0.5 capitalize">{STATUS[s].text}</div>
                </div>
              )
            ))}
          </div>
        )}

        {devices.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No managed devices at this site</p>
        )}

        <div className="pt-1 border-t border-border">
          <Link href={`/sites/${site.id}`}>
            <Button size="sm" className="w-full gap-2" data-testid="map-view-site-btn">
              <ExternalLink className="w-3.5 h-3.5" />
              View Site
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Device detail panel ──────────────────────────────────────────────────────

interface DeviceDetailProps {
  device: ManagedDeviceRecord;
  openTicketCount: number;
  onClose: () => void;
}

function DeviceDetailPanel({ device, openTicketCount, onClose }: DeviceDetailProps) {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] bg-white rounded-lg shadow-xl border border-border w-72 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-700 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <Server className="w-4 h-4 shrink-0" />
          <span className="font-semibold truncate text-sm">{device.hostname}</span>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-slate-300 hover:text-white transition-colors shrink-0"
          aria-label="Close"
          data-testid="map-device-detail-close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={device.status} />
          {device.haState && device.haState !== "standalone" && (
            <Badge variant="outline" className="text-xs capitalize">{device.haState}</Badge>
          )}
        </div>

        <div className="text-sm space-y-1 text-muted-foreground">
          <div><span className="font-medium text-foreground">Vendor:</span> {device.vendor}</div>
          {device.model && <div><span className="font-medium text-foreground">Model:</span> {device.model}</div>}
          {device.site && <div><span className="font-medium text-foreground">Site:</span> {device.site.siteName}</div>}
          {device.customer && <div><span className="font-medium text-foreground">Customer:</span> {device.customer.name}</div>}
          {device.mgmtIp && <div><span className="font-medium text-foreground">Mgmt IP:</span> <span className="font-mono">{device.mgmtIp}</span></div>}
        </div>

        {openTicketCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border bg-red-50 text-red-700 border-red-200">
            <AlertTriangle className="w-3 h-3" />
            {openTicketCount} open ticket{openTicketCount !== 1 ? "s" : ""}
          </span>
        )}

        <div className="pt-1 border-t border-border">
          <Link href={`/devices/${device.id}`}>
            <Button size="sm" className="w-full gap-2" data-testid="map-view-device-btn">
              <ExternalLink className="w-3.5 h-3.5" />
              View Device
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function MapLegend() {
  return (
    <div className="absolute bottom-4 right-4 z-[1000] bg-white rounded-lg shadow-md border border-border px-3 py-2.5 text-xs">
      <p className="font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Legend</p>
      <div className="space-y-1">
        {(Object.keys(STATUS) as StatusKey[]).map(k => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ background: STATUS[k].fill }} />
            <span className="text-foreground">{STATUS[k].text}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
          <Building2 className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Site marker</span>
        </div>
        <div className="flex items-center gap-2">
          <Server className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground">Device marker</span>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type SelectedItem =
  | { type: "site"; item: Site }
  | { type: "device"; item: ManagedDeviceRecord };

export default function MapPage() {
  const { data: sites = [], isLoading: sitesLoading } = useGetSites();
  const { data: devices = [], isLoading: devicesLoading } = useGetDevices();
  const { data: tickets = [] } = useGetTickets({ status: "new,investigating,vendor_engaged,dispatch_scheduled,monitoring" });
  const { data: customers = [] } = useGetCustomers();

  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showSites, setShowSites] = useState(true);
  const [showDevices, setShowDevices] = useState(true);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [fitDone, setFitDone] = useState(false);

  const isLoading = sitesLoading || devicesLoading;

  // ── Derived data ──────────────────────────────────────────────────────────

  const siteStatuses = useMemo<Record<string, StatusKey>>(() => {
    const map: Record<string, StatusKey> = {};
    const priority: Record<StatusKey, number> = { offline: 3, degraded: 2, unknown: 1, online: 0 };
    for (const d of devices) {
      if (!d.siteId) continue;
      const cur = map[d.siteId];
      const dk = statusKey(d.status);
      if (!cur || priority[dk] > priority[cur]) map[d.siteId] = dk;
    }
    return map;
  }, [devices]);

  const openTicketCountBySite = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) {
      if (t.siteId) map[t.siteId] = (map[t.siteId] || 0) + 1;
    }
    return map;
  }, [tickets]);

  const openTicketCountByDevice = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    for (const t of tickets) {
      if ((t as Record<string, unknown>).deviceId) {
        const did = (t as Record<string, unknown>).deviceId as string;
        map[did] = (map[did] || 0) + 1;
      }
    }
    return map;
  }, [tickets]);

  const siteDevices = useMemo<Record<string, ManagedDeviceRecord[]>>(() => {
    const map: Record<string, ManagedDeviceRecord[]> = {};
    for (const d of devices) {
      if (d.siteId) {
        if (!map[d.siteId]) map[d.siteId] = [];
        map[d.siteId].push(d);
      }
    }
    return map;
  }, [devices]);

  // ── Filtered markers ──────────────────────────────────────────────────────

  const filteredSites = useMemo(() => {
    return sites.filter(s => {
      if (!s.latitude || !s.longitude) return false;
      if (customerFilter !== "all" && s.customerId !== customerFilter) return false;
      if (statusFilter !== "all") {
        const st = siteStatuses[s.id] || "unknown";
        if (st !== statusFilter) return false;
      }
      return true;
    });
  }, [sites, customerFilter, statusFilter, siteStatuses]);

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      if (!d.latitude || !d.longitude) return false;
      if (customerFilter !== "all" && d.customerId !== customerFilter) return false;
      if (statusFilter !== "all" && statusKey(d.status) !== statusFilter) return false;
      return true;
    });
  }, [devices, customerFilter, statusFilter]);

  const allMarkerCoords = useMemo<[number, number][]>(() => {
    const coords: [number, number][] = [];
    for (const s of filteredSites) {
      if (s.latitude && s.longitude) coords.push([s.latitude, s.longitude]);
    }
    for (const d of filteredDevices) {
      if (d.latitude && d.longitude) coords.push([d.latitude, d.longitude]);
    }
    return coords;
  }, [filteredSites, filteredDevices]);

  // ── Summary counts ────────────────────────────────────────────────────────

  const summaryCounts = useMemo(() => {
    const counts: Record<StatusKey, number> = { online: 0, degraded: 0, offline: 0, unknown: 0 };
    for (const s of filteredSites) counts[siteStatuses[s.id] || "unknown"]++;
    return counts;
  }, [filteredSites, siteStatuses]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppLayout title="Network Map">
      <div
        className="-m-6 flex overflow-hidden"
        style={{ height: "calc(100vh - 64px)" }}
        data-testid="map-page"
      >
        {/* ── Filter Sidebar ─────────────────────────────────────────────── */}
        <div className="w-60 shrink-0 bg-white border-r border-border flex flex-col overflow-y-auto">
          <div className="px-4 py-4 border-b border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Filters</h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Customer</label>
                <Select value={customerFilter} onValueChange={setCustomerFilter}>
                  <SelectTrigger className="h-8 text-xs" data-testid="map-filter-customer">
                    <SelectValue placeholder="All customers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All customers</SelectItem>
                    {customers.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs" data-testid="map-filter-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-border space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Layers</p>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={showSites}
                onChange={e => setShowSites(e.target.checked)}
                data-testid="map-layer-sites"
              />
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">Sites</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={showDevices}
                onChange={e => setShowDevices(e.target.checked)}
                data-testid="map-layer-devices"
              />
              <Server className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm">Devices</span>
            </label>
          </div>

          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Site Status</p>
            <div className="space-y-1.5">
              {(Object.keys(STATUS) as StatusKey[]).map(k => (
                <div
                  key={k}
                  className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded px-1 py-0.5 transition-colors"
                  onClick={() => setStatusFilter(statusFilter === k ? "all" : k)}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS[k].fill }} />
                    <span className="text-xs">{STATUS[k].text}</span>
                  </div>
                  <span className={`text-xs font-semibold tabular-nums rounded-full px-1.5 py-0.5 ${
                    summaryCounts[k] > 0 ? `${STATUS[k].tw}` : "text-muted-foreground"
                  }`}>
                    {summaryCounts[k]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="px-4 py-3 mt-auto">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div><span className="font-medium">{filteredSites.length}</span> sites shown</div>
              <div><span className="font-medium">{filteredDevices.length}</span> devices with coords</div>
              <div><span className="font-medium">{tickets.length}</span> open tickets</div>
            </div>
            {(customerFilter !== "all" || statusFilter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2 text-xs h-7"
                onClick={() => { setCustomerFilter("all"); setStatusFilter("all"); }}
                data-testid="map-clear-filters"
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* ── Map Area ───────────────────────────────────────────────────── */}
        <div className="flex-1 relative">
          {isLoading && (
            <div className="absolute inset-0 z-[2000] bg-white/80 flex items-center justify-center">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          )}

          <MapContainer
            center={[39.5, -98.35]}
            zoom={4}
            style={{ height: "100%", width: "100%" }}
            zoomControl={true}
            data-testid="map-container"
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {allMarkerCoords.length > 0 && !fitDone && (
              <FitBoundsOnce coords={allMarkerCoords} onDone={() => setFitDone(true)} />
            )}

            {/* Sites layer */}
            {showSites && (
              <MarkerClusterGroup
                chunkedLoading
                spiderfyOnMaxZoom
                showCoverageOnHover={false}
                maxClusterRadius={50}
              >
                {filteredSites.map(site => {
                  const st = siteStatuses[site.id] || "unknown";
                  const hasTickets = (openTicketCountBySite[site.id] || 0) > 0;
                  return (
                    <Marker
                      key={site.id}
                      position={[site.latitude!, site.longitude!]}
                      icon={createSiteIcon(st, hasTickets)}
                      eventHandlers={{
                        click: () => setSelected({ type: "site", item: site }),
                      }}
                      data-testid={`map-site-marker-${site.id}`}
                    >
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{site.siteName}</p>
                          {site.siteCode && <p className="text-xs text-muted-foreground font-mono">{site.siteCode}</p>}
                          {(site.city || site.state) && (
                            <p className="text-xs text-muted-foreground mt-0.5">{[site.city, site.state].filter(Boolean).join(", ")}</p>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MarkerClusterGroup>
            )}

            {/* Devices layer (only those with own coordinates) */}
            {showDevices && (
              <MarkerClusterGroup
                chunkedLoading
                showCoverageOnHover={false}
                maxClusterRadius={40}
              >
                {filteredDevices.map(device => (
                  <Marker
                    key={device.id}
                    position={[device.latitude!, device.longitude!]}
                    icon={createDeviceIcon(statusKey(device.status))}
                    eventHandlers={{
                      click: () => setSelected({ type: "device", item: device }),
                    }}
                    data-testid={`map-device-marker-${device.id}`}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{device.hostname}</p>
                        <p className="text-xs text-muted-foreground">{device.vendor} · {device.model}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            )}
          </MapContainer>

          {/* Detail panel overlay */}
          {selected?.type === "site" && (
            <SiteDetailPanel
              site={selected.item}
              devices={siteDevices[selected.item.id] || []}
              openTicketCount={openTicketCountBySite[selected.item.id] || 0}
              onClose={() => setSelected(null)}
            />
          )}
          {selected?.type === "device" && (
            <DeviceDetailPanel
              device={selected.item}
              openTicketCount={openTicketCountByDevice[selected.item.id] || 0}
              onClose={() => setSelected(null)}
            />
          )}

          {/* Legend */}
          <MapLegend />
        </div>
      </div>
    </AppLayout>
  );
}

// ─── Fit-bounds helper (fires once then calls onDone) ─────────────────────────

interface FitBoundsOnceProps {
  coords: [number, number][];
  onDone: () => void;
}

function FitBoundsOnce({ coords, onDone }: FitBoundsOnceProps) {
  const map = useMap();
  useEffect(() => {
    if (coords.length === 0) return;
    const bounds = L.latLngBounds(coords.map(([lat, lng]) => L.latLng(lat, lng)));
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 9 });
    onDone();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
