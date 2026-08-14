import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { useGetTickets } from '@workspace/api-client-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { SeverityBadge } from '@/components/severity-badge';
import { Activity, Plus, Search } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

type OutageSource = 'monitoring' | 'controller';

type OutageReportTicket = {
  id: string;
  ticketNumber: string;
  title: string;
  status:
    | 'new'
    | 'investigating'
    | 'vendor_engaged'
    | 'dispatch_scheduled'
    | 'monitoring'
    | 'resolved'
    | 'closed';
  severity: 'low' | 'medium' | 'high' | 'critical';
  openedAt: string;
  nextEscalationAt?: string | null;
  customer?: { name?: string | null } | null;
};

function parseDrilldown(location: string) {
  const searchParams = new URLSearchParams(location.split('?')[1] ?? '');
  const source = searchParams.get('outageSource');
  const outageSource: OutageSource | null =
    source === 'monitoring' || source === 'controller' ? source : null;

  return {
    outageSource,
    outageClassification: searchParams.get('outageClassification'),
    outageReasonCode: searchParams.get('outageReasonCode'),
    outageOpenOnly: searchParams.get('outageOpenOnly') !== 'false',
  };
}

function buildFullTicketsHref(location: string): string {
  const searchParams = new URLSearchParams(location.split('?')[1] ?? '');
  const fullParams = new URLSearchParams();

  const search = searchParams.get('search');
  const status = searchParams.get('status');
  const severity = searchParams.get('severity');

  if (search) fullParams.set('search', search);
  if (status) fullParams.set('status', status);
  if (severity) fullParams.set('severity', severity);

  const query = fullParams.toString();
  return query.length > 0 ? `/tickets?${query}` : '/tickets';
}

export default function TicketsList() {
  const [location] = useLocation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [severity, setSeverity] = useState<string>('all');
  const drilldown = useMemo(() => parseDrilldown(location), [location]);
  const isOutageDrilldown = drilldown.outageSource !== null;

  useEffect(() => {
    const searchParams = new URLSearchParams(location.split('?')[1] ?? '');
    setSearch(searchParams.get('search') ?? '');
    setStatus(searchParams.get('status') ?? 'all');
    setSeverity(searchParams.get('severity') ?? 'all');
  }, [location]);

  const { data: tickets, isLoading: isLoadingTickets } = useGetTickets({
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
    severity: severity !== 'all' ? severity : undefined,
  });

  const { data: outageReportTickets = [], isLoading: isLoadingOutageReport } = useQuery({
    queryKey: [
      'dashboard',
      'outage-context-report',
      drilldown.outageSource,
      drilldown.outageClassification,
      drilldown.outageReasonCode,
      drilldown.outageOpenOnly,
    ],
    enabled: isOutageDrilldown,
    staleTime: 30_000,
    queryFn: () => {
      const params = new URLSearchParams({
        source: drilldown.outageSource as OutageSource,
        openOnly: String(drilldown.outageOpenOnly),
      });

      if (drilldown.outageClassification) {
        params.set('classification', drilldown.outageClassification);
      }

      if (drilldown.outageReasonCode) {
        params.set('reasonCode', drilldown.outageReasonCode);
      }

      return apiFetch<OutageReportTicket[]>(`/dashboard/outage-context-report?${params.toString()}`);
    },
  });

  const visibleTickets = useMemo(
    () => (isOutageDrilldown ? outageReportTickets : ((tickets ?? []) as OutageReportTicket[])),
    [isOutageDrilldown, outageReportTickets, tickets],
  );

  const isLoading = isOutageDrilldown ? isLoadingOutageReport : isLoadingTickets;

  return (
    <AppLayout title="Tickets">
      <div className="space-y-4">
        {isOutageDrilldown && (
          <Card className="border-border/60 bg-blue-50/60 shadow-sm">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Outage drilldown
                </p>
                <p className="text-sm text-blue-950">
                  {drilldown.outageSource === 'monitoring' ? 'Monitoring' : 'Controller'} context
                  {drilldown.outageClassification
                    ? ` · ${drilldown.outageClassification.replaceAll('_', ' ')}`
                    : ''}
                  {drilldown.outageReasonCode
                    ? ` · reason ${drilldown.outageReasonCode.replaceAll('_', ' ')}`
                    : ''}
                </p>
                <p className="text-xs text-blue-700/80">
                  Showing {visibleTickets.length} matching ticket{visibleTickets.length === 1 ? '' : 's'} from outage context report.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href={buildFullTicketsHref(location)}>
                  <Button variant="outline" size="sm" className="border-blue-200 bg-white">
                    Open full tickets list
                  </Button>
                </Link>
                <Link href="/tickets">
                  <Button variant="outline" size="sm" className="border-blue-200 bg-white">
                    Clear drilldown
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                className="pl-9 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                disabled={isOutageDrilldown}
              />
            </div>
            <Select value={status} onValueChange={setStatus} disabled={isOutageDrilldown}>
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="investigating">Investigating</SelectItem>
                <SelectItem value="vendor_engaged">Vendor Engaged</SelectItem>
                <SelectItem value="dispatch_scheduled">Dispatch Scheduled</SelectItem>
                <SelectItem value="monitoring">Monitoring</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={severity} onValueChange={setSeverity} disabled={isOutageDrilldown}>
              <SelectTrigger className="w-[140px] bg-white">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link href="/tickets/new">
            <Button data-testid="new-ticket-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Ticket
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Ticket #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>SLA</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Activity className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !visibleTickets.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    {isOutageDrilldown
                      ? 'No matching outage-context tickets found.'
                      : 'No tickets found.'}
                  </TableCell>
                </TableRow>
              ) : (
                visibleTickets.map((t) => {
                  const isBreached =
                    t.nextEscalationAt && new Date(t.nextEscalationAt) < new Date();
                  return (
                    <TableRow
                      key={t.id}
                      className={cn('hover:bg-muted/20', isOutageDrilldown && 'bg-blue-50/20')}
                      data-testid="ticket-row"
                    >
                      <TableCell className="font-medium">
                        <Link href={`/tickets/${t.id}`} className="text-primary hover:underline">
                          {t.ticketNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.title}</TableCell>
                      <TableCell>{t.customer?.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status} />
                      </TableCell>
                      <TableCell>
                        <SeverityBadge severity={t.severity} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(t.openedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {t.nextEscalationAt ? (
                          <span
                            className={isBreached ? 'text-red-600 font-bold' : 'text-orange-600'}
                          >
                            {new Date(t.nextEscalationAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
