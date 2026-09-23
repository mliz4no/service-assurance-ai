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
import { useAuth } from '@/lib/auth';

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

type DnsCandidate = {
  id: string;
  providerName: string;
  address: string;
  transport: string;
  status: 'pending' | 'validated' | 'rejected' | 'promoted';
  validationMessage: string | null;
  lastValidatedAt: string | null;
};

type ArinCrawlResult = {
  resultCount: number;
  queriedAsnCount: number;
  candidateCount: number;
  results: Array<{
    ispName: string;
    routing?: {
      candidates?: IspCandidate[];
    };
  }>;
};

type IspCandidate = {
  isp: string;
  asn: string;
  category?: string;
  prefix: string;
  candidateIp: string;
  latitude: number | null;
  longitude: number | null;
  country: string | null;
  city: string | null;
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
  const { user } = useAuth();
  const canCrawlArin = user?.role === 'admin' || user?.role === 'ops';
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<TargetForm>(EMPTY_FORM);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [ispNames, setIspNames] = useState('AT&T, Verizon, Comcast, Charter, Lumen, Cox, Frontier, Zayo');
  const [candidatesPerPrefix, setCandidatesPerPrefix] = useState('2');
  const [minimumPrefixLength, setMinimumPrefixLength] = useState('20');
  const [maxCandidates, setMaxCandidates] = useState('500');
  const [maxAsns, setMaxAsns] = useState('25');
  const [crawlResult, setCrawlResult] = useState<ArinCrawlResult | null>(null);
  const [selectedIspCandidates, setSelectedIspCandidates] = useState<string[]>([]);
  const [createdIspTargetIds, setCreatedIspTargetIds] = useState<string[]>([]);
  const [promotedIspCandidateIps, setPromotedIspCandidateIps] = useState<string[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);

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

  const { data: dnsCandidates = [], isLoading: dnsCandidatesLoading } = useQuery({
    queryKey: ['monitoring', 'dns-candidates'],
    queryFn: () => apiFetch<DnsCandidate[]>('/monitoring/dns-candidates'),
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

  const importDnsCandidates = useMutation({
    mutationFn: () => apiFetch('/monitoring/dns-candidates/import-curated', { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['monitoring', 'dns-candidates'] });
      toast({ title: 'Curated DNS candidates imported' });
    },
    onError: (error) => toast({ title: 'Unable to import DNS candidates', description: error.message, variant: 'destructive' }),
  });

  const crawlArinIsps = useMutation({
    mutationFn: () => apiFetch<ArinCrawlResult>('/monitoring/arin/isps/crawl', {
      method: 'POST',
      body: JSON.stringify({
        isps: ispNames.split(',').map((name) => name.trim()).filter(Boolean),
        candidatesPerPrefix: Number(candidatesPerPrefix),
        minimumPrefixLength: Number(minimumPrefixLength),
        maxCandidates: Number(maxCandidates),
        maxAsns: Number(maxAsns),
      }),
    }),
    onSuccess: (result) => {
      setCrawlResult(result);
      setSelectedIspCandidates([]);
      setCreatedIspTargetIds([]);
      setPromotedIspCandidateIps([]);
      toast({
        title: 'ARIN ISP crawl complete',
        description: `${result.resultCount} ISP(s), ${result.queriedAsnCount} ASN(s), and ${result.candidateCount} candidate IP(s) found.`,
      });
    },
    onError: (error) => toast({ title: 'ARIN ISP crawl failed', description: error.message, variant: 'destructive' }),
  });

  const createTargetsFromIspCandidates = async (candidateIps: string[]): Promise<MonitoredTarget[]> => {
    const candidates = crawlResult?.results.flatMap((result) => result.routing?.candidates ?? []) ?? [];
    const selected = candidates.filter((candidate) => candidateIps.includes(candidate.candidateIp));
    const created: MonitoredTarget[] = [];
    for (const candidate of selected) {
      created.push(await apiFetch<MonitoredTarget>('/monitoring/targets', {
        method: 'POST',
        body: JSON.stringify({
          name: `${candidate.isp} ${candidate.candidateIp}`,
          hostOrIp: candidate.candidateIp,
          targetType: 'ip',
          preferredCheckType: 'icmp',
          probeAllowlisted: true,
          ownershipMethod: 'explicit_approval',
          provider: candidate.isp,
          region: candidate.country ?? undefined,
          latitude: candidate.latitude ?? undefined,
          longitude: candidate.longitude ?? undefined,
        }),
      }));
    }
    return created;
  };

  const createIspTargets = useMutation({
    mutationFn: () => createTargetsFromIspCandidates(selectedIspCandidates),
    onSuccess: async (created) => {
      setCreatedIspTargetIds((current) => [...current, ...created.map((target) => target.id)]);
      setPromotedIspCandidateIps((current) => [...current, ...selectedIspCandidates]);
      setSelectedIspCandidates([]);
      await refresh();
      toast({ title: `${created.length} ISP target(s) promoted`, description: 'They are approved for ICMP checks.' });
    },
    onError: (error) => toast({ title: 'Unable to promote ISP targets', description: error.message, variant: 'destructive' }),
  });

  const promoteIspCandidate = useMutation({
    mutationFn: (candidateIp: string) => createTargetsFromIspCandidates([candidateIp]),
    onSuccess: async (created, candidateIp) => {
      setCreatedIspTargetIds((current) => [...current, ...created.map((target) => target.id)]);
      setPromotedIspCandidateIps((current) => [...current, candidateIp]);
      setSelectedIspCandidates((current) => current.filter((ip) => ip !== candidateIp));
      await refresh();
      toast({ title: 'ISP candidate promoted to monitoring target' });
    },
    onError: (error) => toast({ title: 'Unable to promote ISP candidate', description: error.message, variant: 'destructive' }),
  });

  const startIspPings = useMutation({
    mutationFn: () => apiFetch<{ processed: number }>('/monitoring/checks/run', {
      method: 'POST',
      body: JSON.stringify({ targetIds: createdIspTargetIds }),
    }),
    onSuccess: async (result) => {
      await refresh();
      toast({ title: `Started ${result.processed} ISP ping(s)` });
    },
    onError: (error) => toast({ title: 'Unable to start ISP pings', description: error.message, variant: 'destructive' }),
  });

  const ispCandidates = Array.from(
    new Map(
      (crawlResult?.results.flatMap((result) => result.routing?.candidates ?? []) ?? [])
        .map((candidate) => [candidate.candidateIp, candidate] as const),
    ).values(),
  ).filter(
    (candidate) =>
      !promotedIspCandidateIps.includes(candidate.candidateIp) &&
      !targets.some((target) => target.hostOrIp === candidate.candidateIp),
  );

  const validateDnsCandidate = useMutation({
    mutationFn: (id: string) => apiFetch<DnsCandidate>(`/monitoring/dns-candidates/${id}/validate`, { method: 'POST' }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['monitoring', 'dns-candidates'] });
      toast({ title: 'DNS candidate validation complete' });
    },
    onError: (error) => toast({ title: 'DNS validation failed', description: error.message, variant: 'destructive' }),
  });

  const promoteDnsCandidate = useMutation({
    mutationFn: (id: string) => apiFetch<{ targetId: string }>(`/monitoring/dns-candidates/${id}/promote`, { method: 'POST' }),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['monitoring', 'dns-candidates'] });
      toast({ title: 'DNS candidate promoted to monitoring target' });
    },
    onError: (error) => toast({ title: 'Unable to promote DNS candidate', description: error.message, variant: 'destructive' }),
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

  const bulkSetPublic = useMutation({
    mutationFn: (isPublic: boolean) =>
      Promise.all(selectedTargetIds.map((id) => apiFetch<MonitoredTarget>(`/monitoring/targets/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isPublic }),
      }))),
    onSuccess: async (updated, isPublic) => {
      await refresh();
      toast({ title: `${updated.length} target(s) marked ${isPublic ? 'public' : 'private'}` });
    },
    onError: (error) => toast({ title: 'Bulk update failed', description: error.message, variant: 'destructive' }),
  });

  const bulkRunChecks = useMutation({
    mutationFn: () => apiFetch<{ processed: number }>('/monitoring/checks/run', {
      method: 'POST',
      body: JSON.stringify({ targetIds: selectedTargetIds }),
    }),
    onSuccess: async (result) => {
      await refresh();
      toast({ title: `Started ${result.processed} check(s)` });
    },
    onError: (error) => toast({ title: 'Bulk check run failed', description: error.message, variant: 'destructive' }),
  });

  const bulkDelete = useMutation({
    mutationFn: () => Promise.all(selectedTargetIds.map((id) => apiFetch(`/monitoring/targets/${id}`, { method: 'DELETE' }))),
    onSuccess: async (deleted) => {
      setSelectedTargetIds([]);
      setSelectedTargetId(null);
      await refresh();
      toast({ title: `${deleted.length} target(s) deleted` });
    },
    onError: (error) => toast({ title: 'Bulk delete failed', description: error.message, variant: 'destructive' }),
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
            <Button variant="outline" onClick={() => importDnsCandidates.mutate()} disabled={importDnsCandidates.isPending}>
              <Globe2 className="mr-2 h-4 w-4" /> Import DNS
            </Button>
            {canCrawlArin && (
              <Button variant="outline" onClick={() => crawlArinIsps.mutate()} disabled={crawlArinIsps.isPending || !ispNames.trim()}>
                <Globe2 className={cn('mr-2 h-4 w-4', crawlArinIsps.isPending && 'animate-spin')} /> Crawl ARIN ISPs
              </Button>
            )}
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Add target
            </Button>
          </div>
        </div>

        {canCrawlArin && (
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">ISP candidate discovery</CardTitle>
              <p className="text-xs text-muted-foreground">Enter up to 25 comma-separated ISP names. Selected candidates are explicitly approved for ICMP monitoring when added. Re-crawling the same ISPs returns the same candidate IPs (routing data changes rarely); already-promoted or already-monitored IPs are hidden from this list. Raise &quot;candidates per prefix&quot;, &quot;minimum prefix length&quot;, or &quot;maximum ASNs&quot; to widen the scan and surface more addresses per block/ISP.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="isp-names">ISPs</Label>
                <Input id="isp-names" value={ispNames} onChange={(event) => setIspNames(event.target.value)} placeholder="AT&T, Verizon, Comcast" />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="grid gap-2"><Label htmlFor="isp-candidates-per-prefix">Candidates per prefix</Label><Input id="isp-candidates-per-prefix" type="number" min="0" max="10" value={candidatesPerPrefix} onChange={(event) => setCandidatesPerPrefix(event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="isp-min-prefix">Minimum prefix length</Label><Input id="isp-min-prefix" type="number" min="8" max="30" value={minimumPrefixLength} onChange={(event) => setMinimumPrefixLength(event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="isp-max-candidates">Maximum candidates</Label><Input id="isp-max-candidates" type="number" min="0" max="1000" value={maxCandidates} onChange={(event) => setMaxCandidates(event.target.value)} /></div>
                <div className="grid gap-2"><Label htmlFor="isp-max-asns">Maximum ASNs per ISP list</Label><Input id="isp-max-asns" type="number" min="1" max="100" value={maxAsns} onChange={(event) => setMaxAsns(event.target.value)} /></div>
              </div>
              {crawlResult && (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span><strong>{crawlResult.candidateCount}</strong> candidates from <strong>{crawlResult.resultCount}</strong> ISPs and <strong>{crawlResult.queriedAsnCount}</strong> ASNs</span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedIspCandidates(ispCandidates.map((candidate) => candidate.candidateIp))} disabled={!ispCandidates.length}>Select all</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelectedIspCandidates([])} disabled={!selectedIspCandidates.length}>Clear</Button>
                    </div>
                  </div>
                  <div className="max-h-72 overflow-auto rounded border">
                    {ispCandidates.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No candidate IPs were returned.</p> : ispCandidates.map((candidate) => (
                      <div key={`${candidate.candidateIp}-${candidate.asn}`} className="flex items-center gap-3 border-b p-2 text-sm last:border-b-0 hover:bg-muted/30">
                        <label className="flex flex-1 cursor-pointer items-center gap-3">
                          <input type="checkbox" checked={selectedIspCandidates.includes(candidate.candidateIp)} onChange={(event) => setSelectedIspCandidates((current) => event.target.checked ? [...current, candidate.candidateIp] : current.filter((ip) => ip !== candidate.candidateIp))} />
                          <span className="font-mono text-xs">{candidate.candidateIp}</span>
                          <span className="text-muted-foreground">{candidate.isp} · AS{candidate.asn} · {candidate.prefix}</span>
                          <span className="text-xs text-muted-foreground">
                            {candidate.latitude != null && candidate.longitude != null
                              ? `${candidate.city ? `${candidate.city}, ` : ''}${candidate.country ?? ''} (${candidate.latitude.toFixed(2)}, ${candidate.longitude.toFixed(2)})`
                              : 'Location unknown'}
                          </span>
                        </label>
                        <Button size="sm" variant="outline" onClick={() => promoteIspCandidate.mutate(candidate.candidateIp)} disabled={promoteIspCandidate.isPending}>
                          Promote
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={() => createIspTargets.mutate()} disabled={!selectedIspCandidates.length || createIspTargets.isPending}>
                      <Plus className="mr-2 h-4 w-4" /> Promote {selectedIspCandidates.length} selected candidate(s)
                    </Button>
                    {createdIspTargetIds.length > 0 && <Button size="sm" variant="outline" onClick={() => startIspPings.mutate()} disabled={startIspPings.isPending}><Play className="mr-2 h-4 w-4" /> Start pings</Button>}
                    {createdIspTargetIds.length > 0 && <span className="text-xs text-muted-foreground">{createdIspTargetIds.length} target(s) ready to ping.</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{selectedTargetIds.length} selected</span>
            <Button size="sm" variant="outline" onClick={() => setSelectedTargetIds(targets.map((target) => target.id))} disabled={!targets.length}>Select all</Button>
            {createdIspTargetIds.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setSelectedTargetIds(createdIspTargetIds.filter((id) => targets.some((target) => target.id === id)))}>
                Select recently promoted ({createdIspTargetIds.length})
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelectedTargetIds([])} disabled={!selectedTargetIds.length}>Clear</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => bulkSetPublic.mutate(true)} disabled={!selectedTargetIds.length || bulkSetPublic.isPending}>Make public</Button>
            <Button size="sm" variant="outline" onClick={() => bulkSetPublic.mutate(false)} disabled={!selectedTargetIds.length || bulkSetPublic.isPending}>Make private</Button>
            <Button size="sm" variant="outline" onClick={() => bulkRunChecks.mutate()} disabled={!selectedTargetIds.length || bulkRunChecks.isPending}>
              <Play className="mr-2 h-4 w-4" /> Run checks
            </Button>
            <Button size="sm" variant="destructive" onClick={() => bulkDelete.mutate()} disabled={!selectedTargetIds.length || bulkDelete.isPending}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/60 bg-white shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={targets.length > 0 && selectedTargetIds.length === targets.length}
                    onChange={(event) => setSelectedTargetIds(event.target.checked ? targets.map((target) => target.id) : [])}
                  />
                </TableHead>
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
                <TableRow><TableCell colSpan={8} className="h-24 text-center"><Activity className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
              ) : targets.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No monitoring targets registered.</TableCell></TableRow>
              ) : targets.map((target) => (
                <TableRow key={target.id} className={cn(selectedTargetId === target.id && 'bg-blue-50/50')}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedTargetIds.includes(target.id)}
                      onChange={(event) => setSelectedTargetIds((current) => event.target.checked ? [...current, target.id] : current.filter((id) => id !== target.id))}
                    />
                  </TableCell>
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
          <CardHeader className="pb-3"><CardTitle className="text-sm">Curated public DNS candidates</CardTitle></CardHeader>
          <CardContent>
            {dnsCandidatesLoading ? <Activity className="mx-auto h-5 w-5 animate-spin" /> : dnsCandidates.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Import curated provider endpoints to validate them before monitoring.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {dnsCandidates.map((candidate) => (
                  <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <div><span className="font-medium">{candidate.providerName}</span><span className="ml-3 font-mono text-xs text-muted-foreground">{candidate.address}</span><p className="text-xs text-muted-foreground">{candidate.status}{candidate.validationMessage ? ` · ${candidate.validationMessage}` : ''}</p></div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => validateDnsCandidate.mutate(candidate.id)} disabled={validateDnsCandidate.isPending || candidate.status === 'promoted'}>Validate</Button>
                      <Button size="sm" onClick={() => promoteDnsCandidate.mutate(candidate.id)} disabled={promoteDnsCandidate.isPending || candidate.status !== 'validated'}>Promote</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

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