import {
  useGetDashboardSummary,
  useGetRecentTickets,
  useGetEscalationNeeded,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Globe2,
  Ticket,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatOverdue(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
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
        "border-border/60 shadow-sm border-l-4 transition-shadow group",
        borderColor,
        href && "hover:shadow-md cursor-pointer"
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
              {label}
            </p>
            <p className="text-3xl font-bold tracking-tight text-foreground leading-none">
              {isLoading ? (
                <span className="text-muted-foreground text-2xl">—</span>
              ) : (
                value
              )}
            </p>
            {subtext && (
              <p className="text-xs text-muted-foreground mt-1.5">{subtext}</p>
            )}
          </div>
          <div className={cn("p-2.5 rounded-lg shrink-0", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
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
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentTickets, isLoading: isLoadingTickets } = useGetRecentTickets({ limit: 8 });
  const { data: escalations, isLoading: isLoadingEscalations } = useGetEscalationNeeded();

  const ticketsByStatus = summary?.ticketsByStatus as Record<string, number> | undefined;
  const ticketsBySeverity = summary?.ticketsBySeverity as Record<string, number> | undefined;

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
            subtext="Require escalation"
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
                  { key: "new", label: "New", color: "bg-slate-400" },
                  { key: "investigating", label: "Investigating", color: "bg-blue-500" },
                  { key: "vendor_engaged", label: "Vendor Engaged", color: "bg-purple-500" },
                  { key: "dispatch_scheduled", label: "Dispatch", color: "bg-orange-500" },
                  { key: "monitoring", label: "Monitoring", color: "bg-yellow-500" },
                  { key: "resolved", label: "Resolved", color: "bg-green-500" },
                  { key: "closed", label: "Closed", color: "bg-gray-300" },
                ].map(({ key, label, color }) => {
                  const count = ticketsByStatus[key] ?? 0;
                  if (count === 0) return null;
                  return (
                    <Link
                      key={key}
                      href={`/tickets?status=${key}`}
                      className="flex items-center gap-1.5 hover:opacity-80"
                    >
                      <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", color)} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-bold text-foreground">{count}</span>
                    </Link>
                  );
                })}
                {ticketsBySeverity && (
                  <>
                    <span className="text-border mx-2">|</span>
                    {[
                      { key: "critical", label: "Critical", color: "bg-red-500" },
                      { key: "high", label: "High", color: "bg-orange-500" },
                      { key: "medium", label: "Medium", color: "bg-yellow-500" },
                      { key: "low", label: "Low", color: "bg-slate-400" },
                    ].map(({ key, label, color }) => {
                      const count = ticketsBySeverity[key] ?? 0;
                      if (count === 0) return null;
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className={cn("w-2 h-2 rounded-sm shrink-0", color)} />
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
                ) : !recentTickets?.length ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    No tickets yet.
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {recentTickets.map((t) => {
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
                              "mt-1 w-2 h-2 rounded-full shrink-0",
                              t.severity === "critical"
                                ? "bg-red-500"
                                : t.severity === "high"
                                ? "bg-orange-400"
                                : t.severity === "medium"
                                ? "bg-yellow-400"
                                : "bg-slate-300"
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

          {/* Escalation Queue — narrower */}
          <div className="xl:col-span-2">
            <Card className="border-border/60 border-l-4 border-l-red-500 shadow-sm h-full">
              <CardHeader className="pb-3 pt-4 px-5 flex-row items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold">Escalation Queue</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Requires immediate attention
                  </p>
                </div>
                {escalations && escalations.length > 0 && (
                  <span className="text-xs font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
                    {escalations.length}
                  </span>
                )}
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {isLoadingEscalations ? (
                  <div className="py-12 flex justify-center">
                    <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !escalations?.length ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">All SLAs on track</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {escalations.map((t) => {
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
                            "block p-3 rounded-lg border transition-all hover:shadow-sm",
                            isBreached
                              ? "bg-red-50 border-red-200 hover:border-red-300"
                              : "bg-orange-50 border-orange-200 hover:border-orange-300"
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
                                  "text-xs font-bold shrink-0",
                                  isBreached ? "text-red-700" : "text-orange-700"
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
