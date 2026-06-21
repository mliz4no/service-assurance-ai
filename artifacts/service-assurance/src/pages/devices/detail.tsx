import { AppLayout } from '@/components/layout/app-layout';
import { useGetDevice } from '@/lib/controller-hooks';
import { useParams, Link } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

function statusBadge(s: string) {
  const map: Record<string, string> = {
    online: 'bg-green-100 text-green-800',
    offline: 'bg-red-100 text-red-800',
    degraded: 'bg-yellow-100 text-yellow-800',
    up: 'bg-green-100 text-green-800',
    down: 'bg-red-100 text-red-800',
    unknown: 'bg-slate-100 text-slate-700',
  };
  return <Badge className={map[s] ?? map.unknown}>{s}</Badge>;
}

function linkRoleBadge(role: string) {
  return role === 'primary' ? (
    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs">Primary</Badge>
  ) : role === 'backup' ? (
    <Badge className="bg-slate-100 text-slate-700 text-xs">Backup</Badge>
  ) : (
    <Badge variant="secondary" className="text-xs">
      {role}
    </Badge>
  );
}

function metricCell(val: number | null, unit: string) {
  if (val === null) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {val.toFixed(1)}
      {unit}
    </span>
  );
}

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: device, isLoading } = useGetDevice(id!);

  if (isLoading) {
    return (
      <AppLayout title="Device Detail">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!device) {
    return (
      <AppLayout title="Not Found">
        <div className="text-center py-20 text-muted-foreground">Device not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={device.hostname}>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/devices" className="hover:underline flex items-center gap-1">
              <ArrowLeft className="h-3 w-3" />
              Devices
            </Link>
          </div>
          <div className="flex items-start gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight font-mono">{device.hostname}</h2>
              <div className="flex items-center gap-3 mt-1">
                {statusBadge(device.status)}
                {device.haState && (
                  <Badge variant="outline" className="text-xs capitalize">
                    {device.haState}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  {device.vendor} {device.model}
                </span>
                <span className="text-sm text-muted-foreground capitalize">
                  {device.deviceType?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Device info */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Device Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-muted-foreground">Serial</div>
                <div className="font-mono text-xs mt-1">{device.serialNumber ?? '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Mgmt IP</div>
                <div className="font-mono text-xs mt-1">{device.mgmtIp ?? '—'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Controller Device ID</div>
                <div className="font-mono text-xs mt-1">{device.controllerDeviceId}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Last Seen</div>
                <div className="mt-1">
                  {device.lastSeenAt
                    ? formatDistanceToNow(new Date(device.lastSeenAt), { addSuffix: true })
                    : 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Customer</div>
                <div className="mt-1">{device.customer?.name ?? 'Unassigned'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Site</div>
                <div className="mt-1">{device.site?.siteName ?? '—'}</div>
              </div>
            </CardContent>
          </Card>

          {/* Linked tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Linked Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              {device.linkedTickets && device.linkedTickets.length > 0 ? (
                <div className="space-y-2">
                  {device.linkedTickets.map((t: any) => (
                    <Link
                      key={t.id}
                      href={`/tickets/${t.id}`}
                      className="flex items-center justify-between p-2 rounded border hover:bg-muted/50"
                    >
                      <div>
                        <div className="text-sm font-medium">{t.ticketNumber}</div>
                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {t.title}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {t.status?.replace(/_/g, ' ')}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">No linked tickets</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Network links */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">WAN / Network Links</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Jitter</TableHead>
                <TableHead>Packet Loss</TableHead>
                <TableHead>Circuit ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {device.links?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No links polled yet
                  </TableCell>
                </TableRow>
              ) : (
                device.links?.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium text-sm">{l.linkName}</TableCell>
                    <TableCell>
                      <span className="text-xs uppercase text-muted-foreground">
                        {l.linkType?.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell>{linkRoleBadge(l.role)}</TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                    <TableCell className="text-sm">{metricCell(l.latencyMs, 'ms')}</TableCell>
                    <TableCell className="text-sm">{metricCell(l.jitterMs, 'ms')}</TableCell>
                    <TableCell className="text-sm">{metricCell(l.packetLossPct, '%')}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {l.circuitId ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Recent events */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Events</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {device.recentEvents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No events recorded
                  </TableCell>
                </TableRow>
              ) : (
                device.recentEvents?.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="text-sm font-medium max-w-xs truncate">
                      {e.title}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{e.eventType}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          e.severity === 'high' || e.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : e.severity === 'medium'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-slate-100 text-slate-700'
                        }
                      >
                        {e.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(e.occurredAt), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppLayout>
  );
}
