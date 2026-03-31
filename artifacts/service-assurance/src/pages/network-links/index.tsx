import { AppLayout } from "@/components/layout/app-layout";
import { useGetNetworkLinks, useGetControllers } from "@/lib/controller-hooks";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Network, ArrowUp, ArrowDown, AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function linkStatusBadge(status: string) {
  const map: Record<string, string> = {
    up: "bg-green-100 text-green-800 border-green-200",
    down: "bg-red-100 text-red-800 border-red-200",
    degraded: "bg-yellow-100 text-yellow-800 border-yellow-200",
    unknown: "bg-slate-100 text-slate-700 border-slate-200",
  };
  const icon: Record<string, any> = {
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
  return role === "primary"
    ? <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Primary</Badge>
    : role === "backup"
    ? <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs">Backup</Badge>
    : <Badge variant="outline" className="text-xs">{role}</Badge>;
}

function metricCell(val: number | null, unit: string, warnThreshold?: number) {
  if (val === null) return <span className="text-muted-foreground text-sm">—</span>;
  const warn = warnThreshold !== undefined && val > warnThreshold;
  return <span className={`text-sm font-mono ${warn ? "text-yellow-600 font-medium" : ""}`}>{val.toFixed(1)}{unit}</span>;
}

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
    primaryDown: links?.filter((l) => l.role === "primary" && l.status !== "up").length ?? 0,
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
          {[
            { label: "Up", value: stats.up, cls: "text-green-600" },
            { label: "Down", value: stats.down, cls: "text-red-600" },
            { label: "Degraded", value: stats.degraded, cls: "text-yellow-600" },
            { label: "Primary Down / Impaired", value: stats.primaryDown, cls: "text-orange-600" },
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
            <Input className="pl-9" placeholder="Search link name, provider, circuit ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link Name</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Jitter</TableHead>
                <TableHead>Packet Loss</TableHead>
                <TableHead>Provider / Circuit</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Last Polled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>{Array.from({ length: 11 }).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : links?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-16 text-muted-foreground">
                    <Network className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No links found
                  </TableCell>
                </TableRow>
              ) : links?.map((l) => (
                <TableRow key={l.id} className={l.role === "primary" && l.status !== "up" ? "bg-red-50/50" : ""}>
                  <TableCell className="font-medium text-sm">{l.linkName}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{l.device?.hostname ?? "—"}</TableCell>
                  <TableCell><span className="text-xs uppercase text-muted-foreground">{l.linkType?.replace(/_/g, " ")}</span></TableCell>
                  <TableCell>{roleBadge(l.role)}</TableCell>
                  <TableCell>{linkStatusBadge(l.status)}</TableCell>
                  <TableCell>{metricCell(l.latencyMs, "ms", 80)}</TableCell>
                  <TableCell>{metricCell(l.jitterMs, "ms", 10)}</TableCell>
                  <TableCell>{metricCell(l.packetLossPct, "%", 5)}</TableCell>
                  <TableCell>
                    <div className="text-sm">{l.providerName ?? "—"}</div>
                    {l.circuitId && <div className="font-mono text-xs text-muted-foreground">{l.circuitId}</div>}
                  </TableCell>
                  <TableCell className="text-sm">{l.site?.siteName ?? l.customer?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {l.lastPolledAt ? formatDistanceToNow(new Date(l.lastPolledAt), { addSuffix: true }) : "—"}
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
