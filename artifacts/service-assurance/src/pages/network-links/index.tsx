import { AppLayout } from "@/components/layout/app-layout";
import { useGetNetworkLinks } from "@/lib/controller-hooks";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Network, ArrowUp, ArrowDown, AlertTriangle, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function linkStatusBadge(status: string) {
  const map: Record<string, string> = {
    up: "bg-green-100 text-green-800 border-green-200",
    down: "bg-red-100 text-red-800 border-red-200",
    degraded: "bg-yellow-100 text-yellow-800 border-yellow-200",
    unknown: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const icon: Record<string, React.ReactNode> = {
    up: <ArrowUp className="h-3 w-3" />,
    down: <ArrowDown className="h-3 w-3" />,
    degraded: <AlertTriangle className="h-3 w-3" />,
  };
  return (
    <Badge className={`flex items-center gap-1 ${map[status] ?? map.unknown}`}>
      {icon[status]}
      {status}
    </Badge>
  );
}

function roleBadge(role: string) {
  if (role === "primary") return <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Primary</Badge>;
  if (role === "backup") return <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs">Backup</Badge>;
  return <Badge variant="outline" className="text-xs">{role}</Badge>;
}

function failoverBadge() {
  return (
    <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs flex items-center gap-1">
      <Zap className="h-3 w-3" />
      Failover Active
    </Badge>
  );
}

function metricCell(val: number | null | undefined, unit: string, warnThreshold?: number) {
  if (val == null) return <span className="text-muted-foreground text-sm">—</span>;
  const warn = warnThreshold !== undefined && val > warnThreshold;
  return (
    <span className={`text-sm font-mono ${warn ? "text-yellow-600 font-semibold" : ""}`}>
      {val.toFixed(1)}{unit}
    </span>
  );
}

function linkTypeLabel(type: string) {
  const labels: Record<string, string> = {
    internet: "Internet",
    mpls: "MPLS",
    lte: "LTE",
    broadband: "Broadband",
    wan_uplink: "WAN Uplink",
    vpn_tunnel: "VPN Tunnel",
    sdwan_transport: "SD-WAN",
  };
  return <span className="text-xs text-muted-foreground">{labels[type] ?? type}</span>;
}

import React from "react";

export default function NetworkLinksPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [roleFilter, setRoleFilter] = useState("__all__");

  const { data: links, isLoading } = useGetNetworkLinks({
    status: statusFilter !== "__all__" ? statusFilter : undefined,
    role: roleFilter !== "__all__" ? roleFilter : undefined,
    search: search || undefined,
  });

  const stats = {
    up: links?.filter((l) => l.status === "up").length ?? 0,
    down: links?.filter((l) => l.status === "down").length ?? 0,
    degraded: links?.filter((l) => l.status === "degraded").length ?? 0,
    failoverActive: links?.filter((l) => l.failoverActive).length ?? 0,
  };

  return (
    <AppLayout title="Network Links">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Network Links</h2>
          <p className="text-muted-foreground text-sm mt-1">WAN uplinks, VPN tunnels, and transport links from all controllers</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Up</div>
            <div className="text-3xl font-bold mt-1 text-green-600">{stats.up}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Down</div>
            <div className="text-3xl font-bold mt-1 text-red-600">{stats.down}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Degraded</div>
            <div className="text-3xl font-bold mt-1 text-yellow-600">{stats.degraded}</div>
          </Card>
          <Card className={`p-4 ${stats.failoverActive > 0 ? "border-amber-300 bg-amber-50/50" : ""}`}>
            <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-600" />
              Failover Active
            </div>
            <div className={`text-3xl font-bold mt-1 ${stats.failoverActive > 0 ? "text-amber-600" : "text-muted-foreground"}`}>{stats.failoverActive}</div>
          </Card>
        </div>

        {/* Failover alert banner */}
        {stats.failoverActive > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
            <Zap className="h-4 w-4 shrink-0 text-amber-600" />
            <span>
              <strong>{stats.failoverActive} link{stats.failoverActive > 1 ? "s" : ""} carrying failover traffic</strong> — a backup circuit is actively substituting for a failed primary.
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search link name, provider, circuit ID..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="links-search" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Statuses</SelectItem>
              <SelectItem value="up">Up</SelectItem>
              <SelectItem value="down">Down</SelectItem>
              <SelectItem value="degraded">Degraded</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Roles</SelectItem>
              <SelectItem value="primary">Primary</SelectItem>
              <SelectItem value="backup">Backup</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Link Name</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Jitter</TableHead>
                <TableHead>Pkt Loss</TableHead>
                <TableHead>Provider / Circuit</TableHead>
                <TableHead>Last Polled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 11 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : links?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No links found
                  </TableCell>
                </TableRow>
              ) : links?.map((l) => {
                const isFailover = l.failoverActive === true;
                const isPrimaryDown = l.role === "primary" && l.status !== "up";
                const rowCls = isFailover
                  ? "bg-amber-50/60 border-l-2 border-l-amber-400"
                  : isPrimaryDown
                  ? "bg-red-50/50 border-l-2 border-l-red-400"
                  : "";

                return (
                  <TableRow key={l.id} className={rowCls} data-testid="link-row">
                    <TableCell>
                      <div className="font-medium text-sm">{l.linkName}</div>
                      {isFailover && <div className="mt-1">{failoverBadge()}</div>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.device?.hostname ?? "—"}</TableCell>
                    <TableCell>
                      {l.networkName ? (
                        <span className="text-xs text-teal-700 font-medium">{l.networkName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">{l.site?.siteName ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell>{linkTypeLabel(l.linkType)}</TableCell>
                    <TableCell>{roleBadge(l.role)}</TableCell>
                    <TableCell>{linkStatusBadge(l.status)}</TableCell>
                    <TableCell>{metricCell(l.latencyMs, "ms", 80)}</TableCell>
                    <TableCell>{metricCell(l.jitterMs, "ms", 10)}</TableCell>
                    <TableCell>{metricCell(l.packetLossPct, "%", 5)}</TableCell>
                    <TableCell>
                      <div className="text-sm">{l.providerName ?? "—"}</div>
                      {l.circuitId && (
                        <div className="font-mono text-xs text-muted-foreground">{l.circuitId}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.lastPolledAt ? formatDistanceToNow(new Date(l.lastPolledAt), { addSuffix: true }) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
