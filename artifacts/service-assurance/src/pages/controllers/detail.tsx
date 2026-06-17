import { AppLayout } from '@/components/layout/app-layout';
import {
  useGetController,
  useSyncController,
  useTestControllerConnection,
} from '@/lib/controller-hooks';
import { useToast } from '@/hooks/use-toast';
import { useParams, Link } from 'wouter';
import { Button } from '@/components/ui/button';
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
import {
  RefreshCw,
  Link2,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  Server,
  Activity,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

function pollStatusBadge(status: string | null) {
  if (status === 'success')
    return <Badge className="bg-green-100 text-green-800 border-green-200">Success</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  if (status === 'running')
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Running</Badge>;
  return <Badge variant="secondary">Unknown</Badge>;
}

function eventSeverityBadge(sev: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200',
    informational: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return <Badge className={map[sev] ?? 'bg-slate-100 text-slate-700'}>{sev}</Badge>;
}

export default function ControllerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: controller, isLoading } = useGetController(id!);
  const { toast } = useToast();
  const syncController = useSyncController();
  const testConnection = useTestControllerConnection();

  function handleSync() {
    syncController.mutate(id!, {
      onSuccess: () =>
        toast({ title: 'Sync started', description: 'Check sync logs for progress.' }),
      onError: (err: any) =>
        toast({ title: 'Sync failed', description: err.message, variant: 'destructive' }),
    });
  }

  function handleTest() {
    testConnection.mutate(id!, {
      onSuccess: (r) =>
        toast({
          title: r.ok ? 'Connection OK' : 'Connection Failed',
          description: r.message,
          variant: r.ok ? 'default' : 'destructive',
        }),
      onError: (err: any) =>
        toast({ title: 'Test failed', description: err.message, variant: 'destructive' }),
    });
  }

  if (isLoading) {
    return (
      <AppLayout title="Controller Detail">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-48 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!controller) {
    return (
      <AppLayout title="Not Found">
        <div className="text-center py-20 text-muted-foreground">Controller not found</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={controller.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link href="/controllers" className="hover:underline flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" />
                Controllers
              </Link>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{controller.name}</h2>
            <div className="flex items-center gap-3">
              <Badge
                className={
                  controller.vendor === 'meraki'
                    ? 'bg-teal-100 text-teal-800 border-teal-200'
                    : 'bg-orange-100 text-orange-800 border-orange-200'
                }
              >
                {controller.vendor === 'meraki' ? 'Cisco Meraki' : 'Fortinet'}
              </Badge>
              <span className="text-sm text-muted-foreground capitalize">
                {controller.type.replace(/_/g, ' ')}
              </span>
              {controller.lastPollStatus === 'success' && (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              {controller.lastPollStatus === 'failed' && (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleTest} disabled={testConnection.isPending}>
              <Link2 className="h-4 w-4 mr-2" />
              Test Connection
            </Button>
            <Button onClick={handleSync} disabled={syncController.isPending}>
              <RefreshCw
                className={`h-4 w-4 mr-2 ${syncController.isPending ? 'animate-spin' : ''}`}
              />
              Sync Now
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Devices', value: controller.deviceCount ?? 0, icon: Server },
            { label: 'Events', value: controller.eventCount ?? 0, icon: Activity },
            { label: 'Interval', value: `${controller.pollingIntervalSeconds}s`, icon: Clock },
            {
              label: 'Last Poll',
              value: controller.lastPolledAt
                ? formatDistanceToNow(new Date(controller.lastPolledAt), { addSuffix: true })
                : 'Never',
              icon: Clock,
            },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <s.icon className="h-3 w-3" />
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connection Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Base URL</div>
              <div className="font-mono text-xs mt-1">{controller.baseUrl}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Organization / Tenant</div>
              <div className="mt-1">{controller.organizationIdOrTenant ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Auth Type</div>
              <div className="mt-1 capitalize">{controller.authType}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Polling</div>
              <div className="mt-1">
                {controller.pollingEnabled
                  ? `Enabled (every ${controller.pollingIntervalSeconds}s)`
                  : 'Disabled'}
              </div>
            </div>
            {controller.lastPollMessage && (
              <div className="col-span-2">
                <div className="text-muted-foreground">Last Poll Message</div>
                <div className="mt-1 text-muted-foreground text-xs">
                  {controller.lastPollMessage}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sync logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Sync Logs</CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(controller as any).recentSyncLogs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No sync logs yet
                  </TableCell>
                </TableRow>
              ) : (
                (controller as any).recentSyncLogs?.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm">
                      {format(new Date(log.startedAt), 'MMM d, HH:mm')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.completedAt
                        ? `${Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 1000)}s`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-sm capitalize">{log.syncType}</TableCell>
                    <TableCell>{pollStatusBadge(log.status)}</TableCell>
                    <TableCell className="text-sm">{log.recordsProcessed ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {log.message ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Recent events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Events</CardTitle>
            <Link
              href={`/events?controllerId=${controller.id}`}
              className="text-xs text-primary hover:underline"
            >
              View all
            </Link>
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
              {(controller as any).recentEvents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No events recorded
                  </TableCell>
                </TableRow>
              ) : (
                (controller as any).recentEvents?.map((evt: any) => (
                  <TableRow key={evt.id}>
                    <TableCell className="font-medium text-sm max-w-xs truncate">
                      {evt.title}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{evt.eventType}</TableCell>
                    <TableCell>{eventSeverityBadge(evt.severity)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(evt.occurredAt), { addSuffix: true })}
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
