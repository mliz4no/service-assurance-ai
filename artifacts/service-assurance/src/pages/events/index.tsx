import { AppLayout } from '@/components/layout/app-layout';
import {
  useGetDeviceEvents,
  useGetControllers,
  useAiAnalyzeEvent,
  type DeviceEventRecord,
} from '@/lib/controller-hooks';
import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Search, Activity, Sparkles, ExternalLink, TicketCheck } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

function severityBadge(sev: string) {
  const map: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-slate-100 text-slate-700 border-slate-200',
    informational: 'bg-blue-50 text-blue-700 border-blue-200',
  };
  return <Badge className={map[sev] ?? 'bg-slate-100 text-slate-700'}>{sev}</Badge>;
}

function vendorTag(source: string) {
  if (source.includes('meraki'))
    return <span className="text-xs text-teal-700 font-medium">Meraki</span>;
  if (source.includes('fortinet') || source.includes('fortigate'))
    return <span className="text-xs text-orange-700 font-medium">Fortinet</span>;
  return <span className="text-xs text-muted-foreground">{source}</span>;
}

const CATEGORY_COLORS: Record<string, string> = {
  appliance_connectivity: 'bg-red-50 text-red-700 border-red-200',
  vpn: 'bg-purple-50 text-purple-700 border-purple-200',
  security: 'bg-orange-50 text-orange-700 border-orange-200',
  firmware: 'bg-blue-50 text-blue-700 border-blue-200',
  ha: 'bg-amber-50 text-amber-700 border-amber-200',
  uplink: 'bg-teal-50 text-teal-700 border-teal-200',
  cellular: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  traffic: 'bg-slate-50 text-slate-600 border-slate-200',
  sdwan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  device: 'bg-violet-50 text-violet-700 border-violet-200',
  routing: 'bg-sky-50 text-sky-700 border-sky-200',
};

function categoryChip(category: string | null | undefined) {
  if (!category) return null;
  const cls = CATEGORY_COLORS[category] ?? 'bg-slate-50 text-slate-600 border-slate-200';
  return <Badge className={`text-xs font-normal ${cls}`}>{category.replace(/_/g, ' ')}</Badge>;
}

export default function EventMonitorPage() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('__all__');
  const [controllerFilter, setControllerFilter] = useState('__all__');
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const aiAnalyze = useAiAnalyzeEvent();

  const { data: controllers } = useGetControllers();
  const {
    data: events,
    isLoading,
    refetch,
  } = useGetDeviceEvents({
    severity: severityFilter !== '__all__' ? severityFilter : undefined,
    controllerId: controllerFilter !== '__all__' ? controllerFilter : undefined,
    search: search || undefined,
  });

  function handleAiAnalyze(eventId: string) {
    aiAnalyze.mutate(eventId, {
      onSuccess: (r) => {
        toast({ title: 'AI analysis complete' });
        refetch();
        if (selectedEvent?.id === eventId) {
          setSelectedEvent((prev: any) => ({
            ...prev,
            aiSummary: r.aiSummary,
            aiProbableImpact: r.aiProbableImpact,
            confidenceScore: r.confidence,
          }));
        }
      },
      onError: (err: any) =>
        toast({ title: 'AI analysis failed', description: err.message, variant: 'destructive' }),
    });
  }

  const criticalOrHigh =
    events?.filter((e) => e.severity === 'critical' || e.severity === 'high').length ?? 0;

  return (
    <AppLayout title="Event Monitor">
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Event Monitor</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Live controller-sourced device and link events
          </p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Events', value: events?.length ?? 0, cls: '' },
            {
              label: 'Critical / High',
              value: criticalOrHigh,
              cls: criticalOrHigh > 0 ? 'text-red-600' : '',
            },
            {
              label: 'With AI Analysis',
              value: events?.filter((e) => e.aiSummary).length ?? 0,
              cls: 'text-blue-600',
            },
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
            <Input
              className="pl-9"
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="informational">Informational</SelectItem>
            </SelectContent>
          </Select>
          <Select value={controllerFilter} onValueChange={setControllerFilter}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Controllers</SelectItem>
              {controllers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Source / Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Linked Ticket</TableHead>
                <TableHead>AI</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : events?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No events found
                  </TableCell>
                </TableRow>
              ) : (
                events?.map((e) => (
                  <TableRow
                    key={e.id}
                    className={`cursor-pointer hover:bg-muted/30 ${e.severity === 'high' || e.severity === 'critical' ? 'border-l-2 border-l-red-400' : ''}`}
                    onClick={() => setSelectedEvent(e)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm max-w-xs">{e.title}</div>
                      <div className="text-xs text-muted-foreground">{e.eventType}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {vendorTag(e.eventSource)}
                        {categoryChip(e.category)}
                      </div>
                    </TableCell>
                    <TableCell>{severityBadge(e.severity)}</TableCell>
                    <TableCell className="text-sm">{e.customer?.name ?? '—'}</TableCell>
                    <TableCell>
                      {e.linkedTickets && e.linkedTickets.length > 0 ? (
                        <Link
                          href={`/tickets/${e.linkedTickets[0].id}`}
                          onClick={(ev) => ev.stopPropagation()}
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <TicketCheck className="h-3 w-3" />
                          {e.linkedTickets[0].ticketNumber}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.aiSummary ? (
                        <Badge className="bg-blue-100 text-blue-800 text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Analyzed
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(e.occurredAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(ev) => {
                          ev.stopPropagation();
                          handleAiAnalyze(e.id);
                        }}
                        disabled={aiAnalyze.isPending}
                        title="Run AI analysis"
                      >
                        <Sparkles className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Event detail dialog */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">{selectedEvent.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                {severityBadge(selectedEvent.severity)}
                {categoryChip((selectedEvent as DeviceEventRecord).category)}
                <span className="text-sm text-muted-foreground">{selectedEvent.eventType}</span>
                {vendorTag(selectedEvent.eventSource)}
                <span className="text-sm text-muted-foreground">
                  {format(new Date(selectedEvent.occurredAt), 'MMM d, yyyy HH:mm')}
                </span>
              </div>

              {selectedEvent.description && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Description
                  </div>
                  <p className="text-sm leading-relaxed">{selectedEvent.description}</p>
                </div>
              )}

              {selectedEvent.customer && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Customer: </span>
                    {selectedEvent.customer.name}
                  </div>
                </div>
              )}

              {selectedEvent.linkedTickets?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Linked Tickets
                  </div>
                  {selectedEvent.linkedTickets.map((t: any) => (
                    <Link
                      key={t.id}
                      href={`/tickets/${t.id}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <TicketCheck className="h-3 w-3" />
                      {t.ticketNumber} — {t.title}
                    </Link>
                  ))}
                </div>
              )}

              {selectedEvent.aiSummary ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs text-blue-700 font-semibold uppercase tracking-wide">
                    <Sparkles className="h-3 w-3" /> AI Analysis
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">Summary</div>
                    <p className="text-sm">{selectedEvent.aiSummary}</p>
                  </div>
                  {selectedEvent.aiProbableImpact && (
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Probable Impact</div>
                      <p className="text-sm">{selectedEvent.aiProbableImpact}</p>
                    </div>
                  )}
                  {selectedEvent.confidenceScore != null && (
                    <div className="text-xs text-muted-foreground">
                      Confidence: {selectedEvent.confidenceScore}/100
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-muted/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-3">No AI analysis yet</p>
                  <Button
                    size="sm"
                    onClick={() => handleAiAnalyze(selectedEvent.id)}
                    disabled={aiAnalyze.isPending}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {aiAnalyze.isPending ? 'Analyzing...' : 'Run AI Analysis'}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </AppLayout>
  );
}
