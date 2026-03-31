import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetTickets } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Activity, Plus, Search } from "lucide-react";
import { Link } from "wouter";

export default function TicketsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [severity, setSeverity] = useState<string>("all");

  const { data: tickets, isLoading } = useGetTickets({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    severity: severity !== "all" ? severity : undefined,
  });

  return (
    <AppLayout title="Tickets">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                className="pl-9 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
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
            <Select value={severity} onValueChange={setSeverity}>
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
            <Button>
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
              ) : !tickets?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No tickets found.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((t) => {
                  const isBreached = t.nextEscalationAt && new Date(t.nextEscalationAt) < new Date();
                  return (
                    <TableRow key={t.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">
                        <Link href={`/tickets/${t.id}`} className="text-primary hover:underline">{t.ticketNumber}</Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">{t.title}</TableCell>
                      <TableCell>{t.customer?.name}</TableCell>
                      <TableCell><StatusBadge status={t.status} /></TableCell>
                      <TableCell><SeverityBadge severity={t.severity} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(t.openedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {t.nextEscalationAt ? (
                          <span className={isBreached ? "text-red-600 font-bold" : "text-orange-600"}>
                            {new Date(t.nextEscalationAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
