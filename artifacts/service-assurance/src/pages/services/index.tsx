import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetServices } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Activity, Plus, Search, Globe2 } from "lucide-react";
import { Link } from "wouter";

export default function ServicesList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: services, isLoading } = useGetServices({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
  });

  return (
    <AppLayout title="Services & Circuits">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search circuit ID, vendor..."
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="down">Down</SelectItem>
                <SelectItem value="impaired">Impaired</SelectItem>
                <SelectItem value="disconnected">Disconnected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link href="/services/new">
            <Button data-testid="new-service-btn">
              <Plus className="w-4 h-4 mr-2" />
              New Service
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Type</TableHead>
                <TableHead>Circuit ID</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Activity className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !services?.length ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No services found.
                  </TableCell>
                </TableRow>
              ) : (
                services.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-sm flex items-center gap-2">
                      <Globe2 className="w-4 h-4 text-muted-foreground" />
                      {s.serviceType}
                    </TableCell>
                    <TableCell>
                      <Link href={`/services/${s.id}`} className="text-primary font-mono text-sm hover:underline">
                        {s.circuitId || "(no circuit id)"}
                      </Link>
                    </TableCell>
                    <TableCell>{s.vendorName}</TableCell>
                    <TableCell>
                      {s.customer ? (
                        <Link href={`/customers/${s.customer.id}`} className="hover:underline">
                          {s.customer.name}
                        </Link>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {s.site ? (
                        <Link href={`/sites/${s.site.id}`} className="hover:underline">
                          {s.site.siteName}
                        </Link>
                      ) : "-"}
                    </TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
