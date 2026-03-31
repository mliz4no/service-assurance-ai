import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetCustomers } from "@workspace/api-client-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Activity, Plus, Search } from "lucide-react";
import { Link } from "wouter";

export default function CustomersList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: customers, isLoading } = useGetCustomers({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
  });

  return (
    <AppLayout title="Customers">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search customers..."
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
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link href="/customers/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Customer
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Customer Name</TableHead>
                <TableHead>Account Number</TableHead>
                <TableHead>Primary Contact</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center">
                    <Activity className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !customers?.length ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No customers found.
                  </TableCell>
                </TableRow>
              ) : (
                customers.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">
                      <Link href={`/customers/${c.id}`} className="text-primary hover:underline">{c.name}</Link>
                    </TableCell>
                    <TableCell>{c.accountNumber || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <span>{c.primaryContactName || "-"}</span>
                        <span className="text-muted-foreground">{c.primaryContactEmail}</span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
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
