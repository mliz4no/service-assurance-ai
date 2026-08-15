import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Globe2, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api';
import { cn } from '@/lib/utils';

type TargetStatus = 'up' | 'down' | 'degraded' | 'unknown';

type MonitoredTarget = {
  id: string;
  name: string;
  publicLabel: string | null;
  hostOrIp: string;
  targetType: 'ip' | 'hostname' | 'service' | 'controller';
  provider: string | null;
  region: string | null;
  status: TargetStatus;
  statusSource: 'manual' | 'nagios' | 'controller' | 'synthetic';
  isPublic: boolean;
  lastCheckedAt: string | null;
};

type MonitoringCheck = {
  id: string;
  targetId: string;
  source: string;
  checkType: string;
  status: TargetStatus;
  responseTimeMs: number | null;
  checkedAt: string;
};

type TargetForm = {
  name: string;
  publicLabel: string;
  hostOrIp: string;
  customerId: string;
  siteId: string;
  serviceId: string;
  targetType: MonitoredTarget['targetType'];
  provider: string;
  region: string;
  latitude: string;
  longitude: string;
  isPublic: boolean;
};

type CustomerOption = { id: string; name: string };
type SiteOption = { id: string; customerId: string; siteName: string; latitude: number | null; longitude: number | null };
type ServiceOption = { id: string; customerId: string; siteId: string | null; circuitId: string };

const EMPTY_FORM: TargetForm = {
  name: '',
  publicLabel: '',
  hostOrIp: '',
  customerId: '',
  siteId: '',
  serviceId: '',
  targetType: 'ip',
  provider: '',
  region: '',
  latitude: '',
  longitude: '',
  isPublic: false,
};

const STATUS_STYLES: Record<TargetStatus, string> = {
  up: 'bg-green-100 text-green-800 border-green-200',
  down: 'bg-red-100 text-red-800 border-red-200',
  degraded: 'bg-amber-100 text-amber-800 border-amber-200',
  unknown: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TargetForm>(EMPTY_FORM);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);

  const { data: customers = [] } = useQuery({
    queryKey: ['customers', 'monitoring-options'],
    queryFn: () => apiFetch<CustomerOption[]>('/customers'),
  });
  const { data: sites = [] } = useQuery({
    queryKey: ['sites', 'monitoring-options'],
    queryFn: () => apiFetch<SiteOption[]>('/sites'),
  });
  const { data: services = [] } = useQuery({
    queryKey: ['services', 'monitoring-options'],
    queryFn: () => apiFetch<ServiceOption[]>('/services'),
  });

  const { data: targets = [], isLoading } = useQuery({
    queryKey: ['monitoring', 'targets'],
    queryFn: () => apiFetch<MonitoredTarget[]>('/monitoring/targets'),
    refetchInterval: 30_000,
  });

  const { data: checks = [], isLoading: checksLoading } = useQuery({
    queryKey: ['monitoring', 'checks', selectedTargetId],
    queryFn: () =>
      apiFetch<MonitoringCheck[]>(
        `/monitoring/checks?limit=25${selectedTargetId ? `&targetId=${encodeURIComponent(selectedTargetId)}` : ''}`,
      ),
    refetchInterval: 30_000,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'targets'] }),
      queryClient.invalidateQueries({ queryKey: ['monitoring', 'checks'] }),
    ]);
  };

  const createTarget = useMutation({
    mutationFn: () =>
      apiFetch<MonitoredTarget>('/monitoring/targets', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          publicLabel: form.publicLabel || undefined,
          customerId: form.customerId || undefined,
          siteId: form.siteId || undefined,
          serviceId: form.serviceId || undefined,
          provider: form.provider || undefined,
          region: form.region || undefined,
          latitude: form.latitude ? Number(form.latitude) : undefined,
          longitude: form.longitude ? Number(form.longitude) : undefined,
        }),
      }),
    onSuccess: async () => {
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await refresh();
      toast({ title: 'Monitoring target created' });
    },
    onError: (error) => toast({ title: 'Unable to create target', description: error.message, variant: 'destructive' }),
  });

  const runChecks = useMutation({
    mutationFn: (input: { mode: 'synthetic' | 'nagios'; targetId?: string }) =>
      apiFetch<{ processed: number; createdTickets: number; updatedTickets: number }>(
        input.mode === 'nagios' ? '/monitoring/checks/nagios-sync' : '/monitoring/checks/run',
        {
          method: 'POST',
          body: JSON.stringify(input.targetId ? { targetId: input.targetId, targetIds: [input.targetId] } : {}),
        },
      ),
    onSuccess: async (result) => {
      await refresh();
      toast({
        title: `Processed ${result.processed} target${result.processed === 1 ? '' : 's'}`,
        description: `${result.createdTickets} ticket(s) created, ${result.updatedTickets} updated.`,
      });
    },
    onError: (error) => toast({ title: 'Monitoring run failed', description: error.message, variant: 'destructive' }),
  });

  const updateTarget = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      apiFetch<MonitoredTarget>(`/monitoring/targets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isPublic }),
      }),
    onSuccess: refresh,
  });

  const deleteTarget = useMutation({
    mutationFn: (id: string) => apiFetch(`/monitoring/targets/${id}`, { method: 'DELETE' }),
    onSuccess: async () => {
      setSelectedTargetId(null);
      await refresh();
      toast({ title: 'Monitoring target deleted' });
    },
  });

  const statusCounts = targets.reduce<Record<TargetStatus, number>>(
    (counts, target) => ({ ...counts, [target.status]: counts[target.status] + 1 }),
    { up: 0, down: 0, degraded: 0, unknown: 0 },
  );

  return (
    <AppLayout title="Monitoring Operations">
      <div className="max-w-7xl space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(['up', 'down', 'degraded', 'unknown'] as TargetStatus[]).map((status) => (
            <Card key={status} className="border-border/60 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground">{status}</p>
                <p className="mt-1 text-2xl font-bold">{statusCounts[status]}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Monitored targets</h2>
            <p className="text-sm text-muted-foreground">Manage polling and public status visibility.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => runChecks.mutate({ mode: 'synthetic' })} disabled={runChecks.isPending}>
              <Play className="mr-2 h-4 w-4" /> Run all
            </Button>
            <Button variant="outline" onClick={() => runChecks.mutate({ mode: 'nagios' })} disabled={runChecks.isPending}>
              <RefreshCw className={cn('mr-2 h-4 w-4', runChecks.isPending && 'animate-spin')} /> Nagios sync
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add target
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Target</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Provider / Region</TableHead>
                <TableHead>Public</TableHead>
                <TableHead>Last checked</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Activity className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
              ) : targets.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No monitoring targets registered.</TableCell></TableRow>
              ) : targets.map((target) => (
                <TableRow key={target.id} className={cn(selectedTargetId === target.id && 'bg-blue-50/50')}>
                  <TableCell>
                    <button className="text-left font-medium text-primary hover:underline" onClick={() => setSelectedTargetId(target.id)}>{target.name}</button>
                    <p className="text-xs text-muted-foreground">{target.targetType}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{target.hostOrIp}</TableCell>
                  <TableCell><Badge variant="outline" className={STATUS_STYLES[target.status]}>{target.status}</Badge></TableCell>
                  <TableCell className="text-sm">{target.provider ?? 'Unknown'}<p className="text-xs text-muted-foreground">{target.region ?? 'No region'}</p></TableCell>
                  <TableCell><Switch checked={target.isPublic} onCheckedChange={(isPublic) => updateTarget.mutate({ id: target.id, isPublic })} /></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{target.lastCheckedAt ? new Date(target.lastCheckedAt).toLocaleString() : 'Never'}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Run check" onClick={() => runChecks.mutate({ mode: 'synthetic', targetId: target.id })}><Play className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" title="Delete target" onClick={() => deleteTarget.mutate(target.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Recent checks {selectedTargetId ? 'for selected target' : 'across all targets'}</CardTitle>
          </CardHeader>
          <CardContent>
            {checksLoading ? <Activity className="mx-auto h-5 w-5 animate-spin" /> : (
              <div className="divide-y divide-border/60">
                {checks.length === 0 ? <p className="py-6 text-center text-sm text-muted-foreground">No checks recorded.</p> : checks.map((check) => (
                  <div key={check.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{check.targetId}</span>
                    <Badge variant="outline" className={STATUS_STYLES[check.status]}>{check.status}</Badge>
                    <span className="text-xs text-muted-foreground">{check.source} · {check.responseTimeMs ?? '-'} ms · {new Date(check.checkedAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add monitoring target</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label htmlFor="target-name">Name</Label><Input id="target-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></div>
            <div className="grid gap-2"><Label htmlFor="target-host">Host or IP</Label><Input id="target-host" value={form.hostOrIp} onChange={(event) => setForm({ ...form, hostOrIp: event.target.value })} /></div>
            <div className="grid gap-2"><Label>Type</Label><Select value={form.targetType} onValueChange={(targetType: TargetForm['targetType']) => setForm({ ...form, targetType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ip">IP</SelectItem><SelectItem value="hostname">Hostname</SelectItem><SelectItem value="service">Service</SelectItem><SelectItem value="controller">Controller</SelectItem></SelectContent></Select></div>
            <div className="grid gap-2">
              <Label>Customer</Label>
              <Select value={form.customerId || 'none'} onValueChange={(customerId) => setForm({ ...form, customerId: customerId === 'none' ? '' : customerId, siteId: '', serviceId: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Unassigned</SelectItem>{customers.map((customer) => <SelectItem key={customer.id} value={customer.id}>{customer.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Site</Label>
                <Select value={form.siteId || 'none'} onValueChange={(siteId) => {
                  const selected = sites.find((site) => site.id === siteId);
                  setForm({ ...form, siteId: siteId === 'none' ? '' : siteId, serviceId: '', latitude: selected?.latitude?.toString() ?? form.latitude, longitude: selected?.longitude?.toString() ?? form.longitude });
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Unassigned</SelectItem>{sites.filter((site) => !form.customerId || site.customerId === form.customerId).map((site) => <SelectItem key={site.id} value={site.id}>{site.siteName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Service</Label>
                <Select value={form.serviceId || 'none'} onValueChange={(serviceId) => setForm({ ...form, serviceId: serviceId === 'none' ? '' : serviceId })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Unassigned</SelectItem>{services.filter((service) => (!form.customerId || service.customerId === form.customerId) && (!form.siteId || service.siteId === form.siteId)).map((service) => <SelectItem key={service.id} value={service.id}>{service.circuitId}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="target-provider">Provider</Label><Input id="target-provider" value={form.provider} onChange={(event) => setForm({ ...form, provider: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="target-region">Region</Label><Input id="target-region" value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="grid gap-2"><Label htmlFor="target-latitude">Latitude</Label><Input id="target-latitude" type="number" step="any" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /></div><div className="grid gap-2"><Label htmlFor="target-longitude">Longitude</Label><Input id="target-longitude" type="number" step="any" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /></div></div>
            <div className="grid gap-2"><Label htmlFor="target-label">Public label</Label><Input id="target-label" value={form.publicLabel} onChange={(event) => setForm({ ...form, publicLabel: event.target.value })} /></div>
            <div className="flex items-center justify-between rounded-md border p-3"><div><Label>Public map visibility</Label><p className="text-xs text-muted-foreground">Requires a public label and coordinates to appear.</p></div><Switch checked={form.isPublic} onCheckedChange={(isPublic) => setForm({ ...form, isPublic })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button><Button onClick={() => createTarget.mutate()} disabled={!form.name || !form.hostOrIp || createTarget.isPending}><Globe2 className="mr-2 h-4 w-4" /> Create target</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}