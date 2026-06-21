import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  Globe2,
  MapPin,
  User as UserIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { SeverityBadge } from '@/components/severity-badge';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { STATUS_STEPS, STATUS_ORDER, timeAgo, formatDuration } from './ticket-utils';
import type { TicketWithAI } from '@/types';
import type { User } from '@workspace/api-client-react';

interface Props {
  ticket: TicketWithAI;
  users: User[] | undefined;
  isCustomer: boolean;
  isBreached: boolean;
  isApproaching: boolean;
  minsUntilBreach: number | null;
  breachOverdueMs: number;
  isResolved: boolean;
  isUpdating: boolean;
  onStatusChange: (status: string) => void;
  onAssigneeChange: (userId: string) => void;
}

export function TicketHeader({
  ticket,
  users,
  isCustomer,
  isBreached,
  isApproaching,
  minsUntilBreach,
  breachOverdueMs,
  isResolved,
  isUpdating,
  onStatusChange,
  onAssigneeChange,
}: Props) {
  const currentStepIdx = STATUS_ORDER.indexOf(ticket.status);

  return (
    <>
      {/* ── Escalation Banners ─────────────────────────────── */}
      {isBreached && !isResolved && (
        <div className="flex items-center gap-3 px-5 py-3 mb-4 bg-red-600 text-white rounded-lg text-sm font-medium shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            SLA BREACH — Vendor escalation was due {formatDuration(breachOverdueMs)} ago. Immediate
            action required.
          </span>
        </div>
      )}
      {isApproaching && !isResolved && (
        <div className="flex items-center gap-3 px-5 py-3 mb-4 bg-orange-500 text-white rounded-lg text-sm font-medium shadow-sm">
          <Clock className="w-4 h-4 shrink-0" />
          <span>
            Vendor escalation due in {minsUntilBreach}m — {ticket.ticketNumber} requires attention
            soon.
          </span>
        </div>
      )}

      {/* ── Header Card ───────────────────────────────────── */}
      <Card className="border-border/60 shadow-sm mb-5">
        <CardContent className="p-5">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            {/* Left: title block */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-sm font-semibold text-muted-foreground tracking-wide">
                  {ticket.ticketNumber}
                </span>
                <SeverityBadge severity={ticket.severity} />
                <StatusBadge status={ticket.status} />
                {ticket.outageType && ticket.outageType !== 'unknown' && (
                  <Badge variant="outline" className="text-xs capitalize bg-slate-50">
                    {ticket.outageType}
                  </Badge>
                )}
              </div>
              <h1 className="text-xl font-bold text-foreground leading-tight mb-3">
                {ticket.title}
              </h1>

              {/* Quick-info row */}
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                {ticket.customer && (
                  <Link
                    href={`/customers/${ticket.customer.id}`}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    {ticket.customer.name}
                  </Link>
                )}
                {ticket.site && (
                  <Link
                    href={`/sites/${ticket.site.id}`}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    {ticket.site.siteName}
                  </Link>
                )}
                {ticket.service && (
                  <Link
                    href={`/services/${ticket.service.id}`}
                    className="flex items-center gap-1 hover:text-primary"
                  >
                    <Globe2 className="w-3.5 h-3.5" />
                    {ticket.service.vendorName} ·{' '}
                    {ticket.service.circuitId || ticket.service.serviceType}
                  </Link>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Opened {timeAgo(ticket.openedAt)}
                </span>
              </div>
            </div>

            {/* Right: controls */}
            {!isCustomer && (
              <div className="flex items-center gap-2 shrink-0">
                <Select
                  value={ticket.assignedToUserId || 'unassigned'}
                  onValueChange={onAssigneeChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-[170px] h-8 text-sm bg-white">
                    <UserIcon className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users
                      ?.filter((u) => u.role !== 'customer')
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select value={ticket.status} onValueChange={onStatusChange} disabled={isUpdating}>
                  <SelectTrigger className="w-[170px] h-8 text-sm bg-white">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_STEPS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Status stepper */}
          {!isCustomer && (
            <div className="mt-5 pt-4 border-t border-border/50">
              <div className="flex items-center gap-0 overflow-x-auto">
                {STATUS_STEPS.map((step, idx) => {
                  const isDone = currentStepIdx > idx;
                  const isCurrent = currentStepIdx === idx;
                  const isLast = idx === STATUS_STEPS.length - 1;
                  return (
                    <div key={step.value} className="flex items-center min-w-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 h-auto rounded text-xs font-medium whitespace-nowrap transition-all',
                          isCurrent
                            ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90'
                            : isDone
                              ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                        )}
                        onClick={() => onStatusChange(step.value)}
                        disabled={isUpdating}
                      >
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <span
                            className={cn(
                              'w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold',
                              isCurrent
                                ? 'border-primary-foreground bg-primary-foreground/20 text-primary-foreground'
                                : 'border-current',
                            )}
                          >
                            {idx + 1}
                          </span>
                        )}
                        {step.label}
                      </Button>
                      {!isLast && (
                        <div
                          className={cn(
                            'h-px w-6 mx-1 shrink-0',
                            isDone ? 'bg-green-300' : 'bg-border',
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
