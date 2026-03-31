import { useGetDashboardSummary, useGetRecentTickets, useGetEscalationNeeded } from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Activity, AlertCircle, Building2, Clock, Globe2, Ticket } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: recentTickets, isLoading: isLoadingTickets } = useGetRecentTickets({ limit: 5 });
  const { data: escalations, isLoading: isLoadingEscalations } = useGetEscalationNeeded();

  const stats = [
    { label: "Active Customers", value: summary?.totalActiveCustomers ?? 0, icon: Building2, color: "text-blue-600", bg: "bg-blue-100" },
    { label: "Active Services", value: summary?.totalActiveServices ?? 0, icon: Globe2, color: "text-indigo-600", bg: "bg-indigo-100" },
    { label: "Open Tickets", value: summary?.openTickets ?? 0, icon: Ticket, color: "text-yellow-600", bg: "bg-yellow-100" },
    { label: "Critical Tickets", value: summary?.criticalTickets ?? 0, icon: AlertCircle, color: "text-red-600", bg: "bg-red-100" },
    { label: "SLA Breaching", value: summary?.slaBreachingTickets ?? 0, icon: Clock, color: "text-orange-600", bg: "bg-orange-100" },
  ];

  return (
    <AppLayout title="Operations Dashboard">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat, i) => (
            <Card key={i} className="border-border/50 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold tracking-tight text-foreground">
                    {isLoadingSummary ? "-" : stat.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-border/50 shadow-sm col-span-1">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Recent Tickets</CardTitle>
                <p className="text-sm text-muted-foreground">Latest tickets opened</p>
              </div>
              <Link href="/tickets" className="text-sm text-primary hover:underline font-medium">View All</Link>
            </CardHeader>
            <CardContent>
              {isLoadingTickets ? (
                <div className="py-8 flex justify-center"><Activity className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : recentTickets?.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No recent tickets</div>
              ) : (
                <div className="rounded-md border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>Ticket</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Severity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTickets?.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">
                            <Link href={`/tickets/${t.id}`} className="text-primary hover:underline">{t.ticketNumber}</Link>
                          </TableCell>
                          <TableCell className="truncate max-w-[150px]">{t.customer?.name}</TableCell>
                          <TableCell><StatusBadge status={t.status} /></TableCell>
                          <TableCell className="text-right"><SeverityBadge severity={t.severity} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Escalation Needed</CardTitle>
                <p className="text-sm text-muted-foreground">Tickets approaching or past SLA</p>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingEscalations ? (
                <div className="py-8 flex justify-center"><Activity className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : escalations?.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">No tickets need escalation</div>
              ) : (
                <div className="rounded-md border border-border/50">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead>Ticket</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Escalation</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {escalations?.map((t) => {
                        const isBreached = t.nextEscalationAt && new Date(t.nextEscalationAt) < new Date();
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">
                              <Link href={`/tickets/${t.id}`} className="text-primary hover:underline">{t.ticketNumber}</Link>
                            </TableCell>
                            <TableCell className="truncate max-w-[150px]">{t.title}</TableCell>
                            <TableCell><StatusBadge status={t.status} /></TableCell>
                            <TableCell className="text-right text-sm">
                              {t.nextEscalationAt ? (
                                <span className={isBreached ? "text-red-600 font-bold" : "text-orange-600"}>
                                  {new Date(t.nextEscalationAt).toLocaleTimeString()}
                                </span>
                              ) : "-"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
