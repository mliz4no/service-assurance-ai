import { AppLayout } from "@/components/layout/app-layout";
import { useGetDevices, useGetControllers, type ManagedDeviceRecord } from "@/lib/controller-hooks";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Server, Search, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function deviceStatusBadge(status: string) {
  const map: Record<string, string> = {
    online: "bg-green-100 text-green-800 border-green-200",
    offline: "bg-red-100 text-red-800 border-red-200",
    degraded: "bg-yellow-100 text-yellow-800 border-yellow-200",
    unknown: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const icons: Record<string, any> = {
    online: <Wifi className="h-3 w-3" />,
    offline: <WifiOff className="h-3 w-3" />,
    degraded: <AlertTriangle className="h-3 w-3" />,
    unknown: null,
  };
  return (
    <Badge className={`flex items-center gap-1 ${map[status] ?? map.unknown}`}>
      {icons[status]}
      {status}
    </Badge>
  );
}

function haStateBadge(state: string | null) {
  if (!state) return null;
  const map: Record<string, string> = {
    active: "bg-blue-100 text-blue-800 border-blue-200",
    standby: "bg-slate-100 text-slate-700 border-slate-200",
    standalone: "bg-purple-100 text-purple-800 border-purple-200",
    unknown: "bg-slate-100 text-slate-700 border-slate-200",
  };
  return <Badge className={`text-xs ${map[state] ?? map.unknown}`}>{state}</Badge>;
}

function vendorBadge(vendor: string) {
  return vendor.toLowerCase() === "meraki"
    ? <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-xs">Meraki</Badge>
    : <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-xs">Fortinet</Badge>;
}

export default function DevicesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [controllerFilter, setControllerFilter] = useState("__all__");
  const [, setLocation] = useLocation();

  const { data: controllers } = useGetControllers();
  const { data: devices, isLoading } = useGetDevices({
    status: statusFilter !== "__all__" ? statusFilter : undefined,
    controllerId: controllerFilter !== "__all__" ? controllerFilter : undefined,
    search: search || undefined,
  });

  const stats = {
    online: devices?.filter((d) => d.status === "online").length ?? 0,
    offline: devices?.filter((d) => d.status === "offline").length ?? 0,
    degraded: devices?.filter((d) => d.status === "degraded").length ?? 0,
  };

  return (
    <AppLayout title="Managed Devices">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Managed Devices</h2>
            <p className="text-muted-foreground text-sm mt-1">All devices registered across controller integrations</p>
          </div>
        </div>

        {/* Status summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Online", value: stats.online, cls: "text-green-600" },
            { label: "Offline", value: stats.offline, cls: "text-red-600" },
            { label: "Degraded", value: stats.degraded, cls: "text-yellow-600" },
          ].map((s) => (
            <Card key={s.label} className="p-4">
              <div className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className={`text-3xl font-bold mt-1 ${s.cls}`}>{s.value}</div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search hostname, model, serial..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              <SelectItem value="online">Online</SelectItem>
              <SelectItem value="offline">Offline</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
          <Select value={controllerFilter} onValueChange={setControllerFilter}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Controllers</SelectItem>
              {controllers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hostname</TableHead>
                <TableHead>Vendor / Model</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HA State</TableHead>
                <TableHead>Customer / Site</TableHead>
                <TableHead>Last Seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 8 }).map((_, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
                ))
              ) : devices?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No devices found
                  </TableCell>
                </TableRow>
              ) : devices?.map((d) => (
                <TableRow key={d.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setLocation(`/devices/${d.id}`)} data-testid="device-row">
                  <TableCell className="font-medium font-mono text-sm">{d.hostname}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {vendorBadge(d.vendor)}
                      <span className="text-sm text-muted-foreground">{d.model ?? "—"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {(d as any).networkName ? (
                      <span className="text-xs text-teal-700 font-medium">{(d as any).networkName}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize">{d.deviceType.replace(/_/g, " ")}</span>
                  </TableCell>
                  <TableCell>{deviceStatusBadge(d.status)}</TableCell>
                  <TableCell>{haStateBadge(d.haState)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{d.customer?.name ?? "Unassigned"}</div>
                      {d.site && <div className="text-xs text-muted-foreground">{d.site.siteName}</div>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {d.lastSeenAt ? formatDistanceToNow(new Date(d.lastSeenAt), { addSuffix: true }) : "Unknown"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
