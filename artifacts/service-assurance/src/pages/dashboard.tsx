import {
  useGetDashboardSummary,
  useGetRecentTickets,
  useGetEscalationNeeded,
} from '@workspace/api-client-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { SeverityBadge } from '@/components/severity-badge';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Download,
  Globe2,
  Ticket,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { apiDownload, apiFetch } from '@/lib/api';

type OutageContextSummary = {
  openOnly: boolean;
  totals: {
    monitoring: number;
    controller: number;
  };
  monitoring: {
    byClassification: Record<string, number>;
    byConfidence: Record<string, number>;
    byReasonCode: Record<string, number>;
  };
  controller: {
    byClassification: Record<string, number>;
    byConfidence: Record<string, number>;
    byReasonCode: Record<string, number>;
  };
};

type OutageDrilldownSource = 'monitoring' | 'controller';

type ImpactGroup = {
  key: string;
  totalChecks: number;
  outages: number;
  degraded: number;
  availabilityPct: number;
  averageResponseTimeMs: number | null;
};

type NetworkImpactReport = {
  totals: { checks: number; outages: number; degraded: number; devices: number };
  byProvider: ImpactGroup[];
  byRegion: ImpactGroup[];
  byDevice: Array<ImpactGroup & {
    targetId: string;
    name: string;
    provider: string;
    region: string;
    lastStatus: string;
  }>;
};

function buildTicketsHref(params: {
  source: OutageDrilldownSource;
  classification?: string;
  reasonCode?: string;
}): string {
  const searchParams = new URLSearchParams({
    outageSource: params.source,
    outageOpenOnly: 'true',
  });

  if (params.classification) {
    searchParams.set('outageClassification', params.classification);
  }

  if (params.reasonCode) {
    searchParams.set('outageReasonCode', params.reasonCode);
  }

  return `/tickets?${searchParams.toString()}`;
}

function timeAgo(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatOverdue(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 0) {
    const upcoming = Math.abs(mins);
    if (upcoming < 60) return `Due in ${upcoming}m`;
    return `Due in ${Math.floor(upcoming / 60)}h ${upcoming % 60}m`;
  }
  if (mins < 60) return `${mins}m overdue`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m overdue`;
}

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  borderColor: string;
  iconBg: string;
  iconColor: string;
  subtext?: string;
  isLoading?: boolean;
  href?: string;
}

function KpiCard({
  label,
  value,
  icon: Icon,
  borderColor,
  iconBg,
  iconColor,
  subtext,
  isLoading,
  href,
}: KpiCardProps) {
  const inner = (
    <Card
      className={cn(
        'border-border/60 shadow-sm border-l-4 transition-shadow group',
        borderColor,
        href && 'hover:shadow-md cursor-pointer',
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className="text-3xl font-bold tracking-tight text-foreground leading-none">
              {isLoading ? <span className="text-muted-foreground text-2xl">—</span> : value}
            </p>
            {subtext && <p className="text-xs text-muted-foreground mt-1.5">{subtext}</p>}
          </div>
          <div className={cn('p-2.5 rounded-lg shrink-0', iconBg)}>
            <Icon className={cn('w-5 h-5', iconColor)} />
          </div>
        </div>
        {href && (
          <div className="mt-3 flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
            View all <ArrowRight className="w-3 h-3 ml-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function Dashboard() {
  const [reportDays, setReportDays] = useState(7);
  const reportFrom = new Date(Date.now() - reportDays * 24 * 60 * 60 * 1000).toISOString();
  const reportQuery = `from=${encodeURIComponent(reportFrom)}&to=${encodeURIComponent(new Date().toISOString())}`;
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentTickets, isLoading: isLoadingTickets } = useGetRecentTickets({ limit: 8 });
  const { data: escalations, isLoading: isLoadingEscalations } = useGetEscalationNeeded();
  const { data: outageContext, isLoading: isLoadingOutageContext } = useQuery({
    queryKey: ['dashboard', 'outage-context-summary'],
    queryFn: () => apiFetch<OutageContextSummary>('/dashboard/outage-context-summary'),
    staleTime: 30_000,
  });
  const { data: networkImpact, isLoading: isLoadingNetworkImpact } = useQuery({
    queryKey: ['dashboard', 'network-impact-report', reportDays],
    queryFn: () => apiFetch<NetworkImpactReport>(`/dashboard/network-impact-report?${reportQuery}`),
    staleTime: 30_000,
  });

  const recentTicketsList = Array.isArray(recentTickets) ? recentTickets : [];
  const escalationList = Array.isArray(escalations) ? escalations : [];

  const ticketsByStatus = summary?.ticketsByStatus as Record<string, number> | undefined;
  const ticketsBySeverity = summary?.ticketsBySeverity as Record<string, number> | undefined;
  const monitoringClassifications = outageContext?.monitoring.byClassification ?? {};
  const controllerClassifications = outageContext?.controller.byClassification ?? {};
  const monitoringReasons = outageContext?.monitoring.byReasonCode ?? {};
  const controllerReasons = outageContext?.controller.byReasonCode ?? {};

  return (
    <AppLayout title="Operations Dashboard">
      <div className="space-y-6 max-w-7xl">
        {/* ── KPI Cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <KpiCard
            label="Active Customers"
            value={summary?.totalActiveCustomers ?? 0}
            icon={Building2}
            borderColor="border-l-blue-500"
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            subtext="Managed accounts"
            isLoading={isLoadingSummary}
            href="/customers"
          />
          <KpiCard
            label="Active Services"
            value={summary?.totalActiveServices ?? 0}
            icon={Globe2}
            borderColor="border-l-indigo-500"
            iconBg="bg-indigo-50"
            iconColor="text-indigo-600"
            subtext="Circuits in service"
            isLoading={isLoadingSummary}
            href="/services"
          />
          <KpiCard
            label="Open Tickets"
            value={summary?.openTickets ?? 0}
            icon={Ticket}
            borderColor="border-l-yellow-500"
            iconBg="bg-yellow-50"
            iconColor="text-yellow-600"
            subtext="Awaiting resolution"
            isLoading={isLoadingSummary}
            href="/tickets"
          />
          <KpiCard
            label="Critical Tickets"
            value={summary?.criticalTickets ?? 0}
            icon={Zap}
            borderColor="border-l-red-500"
            iconBg="bg-red-50"
            iconColor="text-red-600"
            subtext="Highest priority"
            isLoading={isLoadingSummary}
          />
          <KpiCard
            label="SLA Breaching"
            value={summary?.slaBreachingTickets ?? 0}
            icon={Clock}
            borderColor="border-l-orange-500"
            iconBg="bg-orange-50"
            iconColor="text-orange-600"
            subtext="Require vendor escalation"
            isLoading={isLoadingSummary}
          />
        </div>

        {/* ── Status breakdown bar ──────────────────────────── */}
        {ticketsByStatus && Object.keys(ticketsByStatus).length > 0 && (
          <Card className="border-border/60 shadow-sm">
            <CardContent className="px-5 py-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
                  Ticket Pipeline
                </span>
                {[
                  { key: 'new', label: 'New', color: 'bg-slate-400' },
                  { key: 'investigating', label: 'Investigating', color: 'bg-blue-500' },
                  { key: 'vendor_engaged', label: 'Vendor Engaged', color: 'bg-purple-500' },
                  { key: 'dispatch_scheduled', label: 'Dispatch', color: 'bg-orange-500' },
                  { key: 'monitoring', label: 'Monitoring', color: 'bg-yellow-500' },
                  { key: 'resolved', label: 'Resolved', color: 'bg-green-500' },
                  { key: 'closed', label: 'Closed', color: 'bg-gray-300' },
                ].map(({ key, label, color }) => {
                  const count = ticketsByStatus[key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <Link
                      key={key}
                      href={`/tickets?status=${key}`}
                      className="flex items-center gap-1.5 hover:opacity-80"
                    >
                      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', color)} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-bold text-foreground">{count}</span>
                    </Link>
                  );
                })}
                {ticketsBySeverity && (
                  <>
                    <span className="text-border mx-2">|</span>
                    {[
                      { key: 'critical', label: 'Critical', color: 'bg-red-500' },
                      { key: 'high', label: 'High', color: 'bg-orange-500' },
                      { key: 'medium', label: 'Medium', color: 'bg-yellow-500' },
                      { key: 'low', label: 'Low', color: 'bg-slate-400' },
                    ].map(({ key, label, color }) => {
                      const count = ticketsBySeverity[key] ?? 0;
                      if (count === 0) return null;
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className={cn('w-2 h-2 rounded-sm shrink-0', color)} />
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-bold text-foreground">{count}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          <div className="xl:col-span-3">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-3 pt-4 px-5 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Outage Context Distribution</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Shared, isolated, regional, and controller-origin classifications for open work.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  Open tickets only
                </Badge>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {isLoadingOutageContext ? (
                  <div className="py-10 flex justify-center">
                    <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Monitoring Context
                          </p>
                          <p className="text-2xl font-bold mt-1">
                            {outageContext?.totals.monitoring ?? 0}
                          </p>
                        </div>
                        <Link
                          href={buildTicketsHref({ source: 'monitoring' })}
                          className="rounded-full p-1.5 transition-colors hover:bg-blue-100"
                        >
                          <TrendingUp className="w-5 h-5 text-blue-500" />
                        </Link>
                      </div>
                      <div className="space-y-2">
                        {[
                          ['shared_outage', 'Shared'],
                          ['regional_outage', 'Regional'],
                          ['isolated_issue', 'Isolated'],
                          ['unknown', 'Unknown'],
                        ].map(([key, label]) => (
                          <Link
                            key={key}
                            href={buildTicketsHref({
                              source: 'monitoring',
                              classification: key,
                            })}
                            className="flex items-center justify-between rounded-md px-2 py-1 text-sm transition-colors hover:bg-background/80"
                          >
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold">
                              {monitoringClassifications[key] ?? 0}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Controller Context
                          </p>
                          <p className="text-2xl font-bold mt-1">
                            {outageContext?.totals.controller ?? 0}
                          </p>
                        </div>
                        <Link
                          href={buildTicketsHref({ source: 'controller' })}
                          className="rounded-full p-1.5 transition-colors hover:bg-indigo-100"
                        >
                          <Activity className="w-5 h-5 text-indigo-500" />
                        </Link>
                      </div>
                      <div className="space-y-2">
                        {[
                          ['controller_outage', 'Outage'],
                          ['controller_impairment', 'Impairment'],
                          ['controller_info', 'Info'],
                        ].map(([key, label]) => (
                          <Link
                            key={key}
                            href={buildTicketsHref({
                              source: 'controller',
                              classification: key,
                            })}
                            className="flex items-center justify-between rounded-md px-2 py-1 text-sm transition-colors hover:bg-background/80"
                          >
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-semibold">
                              {controllerClassifications[key] ?? 0}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-2">
            <Card className="border-border/60 shadow-sm h-full">
              <CardHeader className="pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold">Top Correlation Signals</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Most common reasons driving automated outage classification.
                </p>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4">
                {isLoadingOutageContext ? (
                  <div className="py-10 flex justify-center">
                    <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Monitoring Reasons
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(monitoringReasons).length === 0 ? (
                          <span className="text-sm text-muted-foreground">No monitoring context yet.</span>
                        ) : (
                          Object.entries(monitoringReasons)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4)
                            .map(([key, count]) => (
                              <Link
                                key={key}
                                href={buildTicketsHref({ source: 'monitoring', reasonCode: key })}
                                className="inline-flex"
                              >
                                <Badge variant="outline" className="px-2.5 py-1 hover:bg-background">
                                  {key.replaceAll('_', ' ')}: {count}
                                </Badge>
                              </Link>
                            ))
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Controller Reasons
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.keys(controllerReasons).length === 0 ? (
                          <span className="text-sm text-muted-foreground">No controller context yet.</span>
                        ) : (
                          Object.entries(controllerReasons)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 4)
                            .map(([key, count]) => (
                              <Link
                                key={key}
                                href={buildTicketsHref({ source: 'controller', reasonCode: key })}
                                className="inline-flex"
                              >
                                <Badge variant="outline" className="px-2.5 py-1 hover:bg-background">
                                  {key.replaceAll('_', ' ')}: {count}
                                </Badge>
                              </Link>
                            ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-3 pt-4 px-5 flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-semibold">Network Impact Report</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Availability and incident load by carrier, region, and monitored device.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border border-border p-0.5" aria-label="Report period">
                {[7, 30, 90].map((days) => (
                  <Button
                    key={days}
                    type="button"
                    size="sm"
                    variant={reportDays === days ? 'secondary' : 'ghost'}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setReportDays(days)}
                  >
                    {days}d
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="h-8 w-8"
                title="Download network impact CSV"
                onClick={() => void apiDownload(
                  `/dashboard/network-impact-report?${reportQuery}&format=csv`,
                  `network-impact-${reportDays}d.csv`,
                )}
              >
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {isLoadingNetworkImpact ? (
              <div className="py-8 flex justify-center">
                <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Providers</p>
                  {(networkImpact?.byProvider ?? []).slice(0, 5).map((provider) => (
                    <div key={provider.key} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="truncate">{provider.key}</span>
                      <span className="font-semibold">{provider.availabilityPct}%</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Regions</p>
                  {(networkImpact?.byRegion ?? []).slice(0, 5).map((region) => (
                    <div key={region.key} className="flex items-center justify-between py-1.5 text-sm">
                      <span className="truncate">{region.key}</span>
                      <span className="font-semibold">{region.outages} outages</span>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Most Impacted Devices</p>
                  {(networkImpact?.byDevice ?? []).slice(0, 5).map((device) => (
                    <div key={device.targetId} className="flex items-center justify-between py-1.5 text-sm gap-3">
                      <span className="truncate">{device.name}</span>
                      <Badge variant={device.outages > 0 ? 'destructive' : 'outline'}>
                        {device.outages}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Main two-column ───────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Recent Tickets — wider */}
          <div className="xl:col-span-3">
            <Card className="border-border/60 shadow-sm h-full">
              <CardHeader className="pb-3 pt-4 px-5 flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Recent Tickets</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Latest activity across all accounts
                  </p>
                </div>
                <Link
                  href="/tickets"
                  className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {isLoadingTickets ? (
                  <div className="py-12 flex justify-center">
                    <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : recentTicketsList.length === 0 ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No tickets yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {recentTicketsList.map((t) => {
                      const isBreached =
                        t.nextEscalationAt && new Date(t.nextEscalationAt) < new Date();
                      return (
                        <Link
                          key={t.id}
                          href={`/tickets/${t.id}`}
                          className="flex items-start gap-3 py-3 group hover:bg-muted/30 -mx-1 px-1 rounded transition-colors"
                        >
                          {/* Severity dot */}
                          <span
                            className={cn(
                              'mt-1 w-2 h-2 rounded-full shrink-0',
                              t.severity === 'critical'
                                ? 'bg-red-500'
                                : t.severity === 'high'
                                  ? 'bg-orange-400'
                                  : t.severity === 'medium'
                                    ? 'bg-yellow-400'
                                    : 'bg-slate-300',
                            )}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-mono text-muted-foreground">
                                {t.ticketNumber}
                              </span>
                              <StatusBadge status={t.status} />
                              {isBreached && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] bg-red-50 text-red-700 border-red-200 px-1.5 py-0"
                                >
                                  SLA Breach
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm font-medium text-foreground group-hover:text-primary truncate leading-tight">
                              {t.title}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t.customer?.name} · {timeAgo(t.openedAt)}
                            </p>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-primary shrink-0 mt-1" />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Vendor Escalation Queue — narrower */}
          <div className="xl:col-span-2">
            <Card className="border-border/60 border-l-4 border-l-red-500 shadow-sm h-full">
              <CardHeader className="pb-3 pt-4 px-5 flex-row items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold">Vendor Escalation Queue</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    SLA breach — requires immediate action
                  </p>
                </div>
                {escalationList.length > 0 && (
                  <span className="text-xs font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                    {escalationList.length}
                  </span>
                )}
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {isLoadingEscalations ? (
                  <div className="py-12 flex justify-center">
                    <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : escalationList.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All SLAs on track</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {escalationList.map((t) => {
                      const isBreached =
                        t.nextEscalationAt && new Date(t.nextEscalationAt) < new Date();
                      const escalationLabel = t.nextEscalationAt
                        ? formatOverdue(t.nextEscalationAt)
                        : null;

                      return (
                        <Link
                          key={t.id}
                          href={`/tickets/${t.id}`}
                          className={cn(
                            'block p-3 rounded-lg border transition-all hover:shadow-sm',
                            isBreached
                              ? 'bg-red-50 border-red-200 hover:border-red-300'
                              : 'bg-orange-50 border-orange-200 hover:border-orange-300',
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {t.ticketNumber}
                              </span>
                              <SeverityBadge severity={t.severity} />
                            </div>
                            {escalationLabel && (
                              <span
                                className={cn(
                                  'text-xs font-bold shrink-0',
                                  isBreached ? 'text-red-700' : 'text-orange-700',
                                )}
                              >
                                {escalationLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-medium text-foreground truncate mb-1">
                            {t.title}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {t.customer?.name}
                            </span>
                            <StatusBadge status={t.status} />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
