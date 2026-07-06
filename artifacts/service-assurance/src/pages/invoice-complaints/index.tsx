import { useState } from 'react';
import { Link } from 'wouter';
import { Activity, Plus, Search } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useInvoiceComplaints } from './hooks';

function statusBadge(status: string) {
  const map: Record<string, string> = {
    new: 'bg-blue-100 text-blue-800',
    triaged: 'bg-indigo-100 text-indigo-800',
    awaiting_customer: 'bg-amber-100 text-amber-800',
    resolved: 'bg-green-100 text-green-800',
    closed: 'bg-slate-100 text-slate-700',
  };

  return (
    <Badge className={map[status] || 'bg-slate-100 text-slate-700'}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

function validationBadge(status: string) {
  const map: Record<string, string> = {
    not_validated: 'bg-slate-100 text-slate-700',
    validated: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <Badge variant="outline" className={map[status] || 'bg-slate-100 text-slate-700'}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

export default function InvoiceComplaintsList() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  const { data, isLoading } = useInvoiceComplaints({
    search: search || undefined,
    status: status !== 'all' ? status : undefined,
  });

  return (
    <AppLayout title="Invoice Complaints">
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-2 items-center">
            <div className="relative w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search complaints..."
                className="pl-9 bg-white"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="triaged">Triaged</SelectItem>
                <SelectItem value="awaiting_customer">Awaiting customer</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link href="/invoice-complaints/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Complaint
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Complaint #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Avalara</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Activity className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !data?.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No invoice complaints found.
                  </TableCell>
                </TableRow>
              ) : (
                data.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">
                      <Link href={`/invoice-complaints/${c.id}`} className="text-primary hover:underline">
                        {c.complaintNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate">{c.title}</TableCell>
                    <TableCell>{c.customer?.name || '-'}</TableCell>
                    <TableCell>{c.invoiceNumber}</TableCell>
                    <TableCell>{statusBadge(c.status)}</TableCell>
                    <TableCell>{validationBadge(c.avalaraValidationStatus)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
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
