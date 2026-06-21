import { useState } from 'react';
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
import { StatusBadge } from '@/components/status-badge';
import { SeverityBadge } from '@/components/severity-badge';
import { Activity } from 'lucide-react';
import { Link } from 'wouter';

export default function MyTickets() {
  const { data: tickets, isLoading } = useGetTickets({}); // user logic is handled in backend for role=customer

  return (
    <AppLayout title="My Tickets">
      <div className="space-y-4">
        <div className="bg-white border border-border/50 rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Ticket #</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Opened</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Activity className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !tickets?.length ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    You have no open tickets.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">
                      <Link href={`/tickets/${t.id}`} className="text-primary hover:underline">
                        {t.ticketNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate">{t.title}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={t.severity} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(t.openedAt).toLocaleDateString()}
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
