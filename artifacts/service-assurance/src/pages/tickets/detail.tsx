import { useParams } from 'wouter';
import { AppLayout } from '@/components/layout/app-layout';
import {
  useGetTicket,
  useGetTicketUpdates,
  useCreateTicketUpdate,
  useUpdateTicket,
  useAiSummarizeTicket,
  useAiNormalizeLatestUpdate,
  useAiGenerateCustomerUpdate,
  getGetTicketQueryKey,
  getGetTicketUpdatesQueryKey,
  useGetUsers,
  UpdateTicketRequestStatus,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  Clock,
  Globe2,
  MapPin,
  Tag,
  User as UserIcon,
  AlertTriangle,
} from 'lucide-react';
import { EscalationPanel } from './EscalationPanel';
import { cn } from '@/lib/utils';
import { formatDuration, timeAgo } from './ticket-utils';
import { TicketHeader } from './TicketHeader';
import { AIPanels } from './AIPanels';
import { UpdateTimeline } from './UpdateTimeline';
import type { TicketWithAI } from '@/types';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-muted-foreground shrink-0 w-32">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

export default function TicketDetail() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [updateText, setUpdateText] = useState('');
  const [updateType, setUpdateType] = useState<
    'internal_note' | 'vendor_update' | 'customer_update'
  >('internal_note');
  const [updateVisibility, setUpdateVisibility] = useState<'internal' | 'customer'>('internal');

  const { data: rawTicket, isLoading: isLoadingTicket } = useGetTicket(id, {
    query: { enabled: !!id },
  });
  const { data: updates, isLoading: isLoadingUpdates } = useGetTicketUpdates(id, {
    query: { enabled: !!id },
  });
  const { data: users } = useGetUsers();

  const updateMutation = useUpdateTicket();
  const createUpdateMutation = useCreateTicketUpdate();
  const summarizeMutation = useAiSummarizeTicket();
  const normalizeMutation = useAiNormalizeLatestUpdate();
  const customerUpdateMutation = useAiGenerateCustomerUpdate();

  if (isLoadingTicket) {
    return (
      <AppLayout title="Loading...">
        <div className="flex justify-center py-20">
          <Activity className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!rawTicket) {
    return (
      <AppLayout title="Not Found">
        <div className="text-center py-20 text-muted-foreground">Ticket not found.</div>
      </AppLayout>
    );
  }

  // Cast once to the augmented type — the API returns all AI timestamp fields
  // even though they're absent from the generated OpenAPI spec
  const ticket = rawTicket as TicketWithAI;

  const isCustomer = currentUser?.role === 'customer';
  const now = new Date();
  const escalationAt = ticket.nextEscalationAt ? new Date(ticket.nextEscalationAt) : null;
  const isBreached = !!(escalationAt && escalationAt < now);
  const minsUntilBreach = escalationAt
    ? Math.floor((escalationAt.getTime() - now.getTime()) / 60000)
    : null;
  const isApproaching = !isBreached && minsUntilBreach !== null && minsUntilBreach < 60;
  const breachOverdueMs = isBreached ? now.getTime() - escalationAt!.getTime() : 0;
  const isResolved = ticket.status === 'resolved' || ticket.status === 'closed';

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id, data: { status: newStatus as UpdateTicketRequestStatus } },
      {
        onSuccess: () => {
          createUpdateMutation.mutate(
            {
              id,
              data: {
                updateType: 'system_event',
                rawText: `Status changed to ${newStatus.replace(/_/g, ' ')}`,
                visibility: 'internal',
              },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
                queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
                toast({ title: 'Status updated' });
              },
            },
          );
        },
        onError: (err: Error) => {
          toast({
            title: 'Failed to update status',
            description: err.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const handleAssigneeChange = (newUserId: string) => {
    updateMutation.mutate(
      { id, data: { assignedToUserId: newUserId === 'unassigned' ? null : newUserId } },
      {
        onSuccess: () => {
          const userName =
            newUserId === 'unassigned'
              ? 'Unassigned'
              : users?.find((u) => u.id === newUserId)?.name || 'Unknown';
          createUpdateMutation.mutate(
            {
              id,
              data: {
                updateType: 'system_event',
                rawText: `Assigned to ${userName}`,
                visibility: 'internal',
              },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
                queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
              },
            },
          );
        },
      },
    );
  };

  const handleAddUpdate = () => {
    if (!updateText.trim()) return;
    createUpdateMutation.mutate(
      { id, data: { updateType, rawText: updateText, visibility: updateVisibility } },
      {
        onSuccess: () => {
          setUpdateText('');
          toast({ title: 'Update posted' });
          queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
        },
        onError: (err: Error) => {
          toast({
            title: 'Error posting update',
            description: err.message,
            variant: 'destructive',
          });
        },
      },
    );
  };

  const runAi = (action: 'summarize' | 'normalize' | 'customer_update') => {
    const callbacks = {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
        toast({ title: 'AI output generated' });
      },
      onError: (err: Error) => {
        toast({
          title: 'AI generation failed',
          description: err.message || 'Check your OPENAI_API_KEY',
          variant: 'destructive',
        });
      },
    };

    if (action === 'summarize') summarizeMutation.mutate({ id }, callbacks);
    else if (action === 'normalize') normalizeMutation.mutate({ id }, callbacks);
    else customerUpdateMutation.mutate({ id }, callbacks);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'Copied to clipboard' });
  };

  const handleUseAsUpdate = (text: string) => {
    setUpdateText(text);
    setUpdateType('customer_update');
    setUpdateVisibility('customer');
    document.getElementById('update-form')?.scrollIntoView({ behavior: 'smooth' });
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <AppLayout title={`${ticket.ticketNumber} — ${ticket.title}`}>
      <div className="max-w-7xl mx-auto pb-16 space-y-0">
        <TicketHeader
          ticket={ticket}
          users={users}
          isCustomer={isCustomer}
          isBreached={isBreached}
          isApproaching={isApproaching}
          minsUntilBreach={minsUntilBreach}
          breachOverdueMs={breachOverdueMs}
          isResolved={isResolved}
          isUpdating={updateMutation.isPending}
          onStatusChange={handleStatusChange}
          onAssigneeChange={handleAssigneeChange}
        />

        {!isCustomer && (
          <AIPanels
            ticket={ticket}
            summarizeMutation={summarizeMutation}
            normalizeMutation={normalizeMutation}
            customerUpdateMutation={customerUpdateMutation}
            onRunAi={runAi}
            onCopyToClipboard={copyToClipboard}
            onUseAsUpdate={handleUseAsUpdate}
          />
        )}

        {/* ── Main two-column layout ────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Properties */}
          <div className="space-y-5">
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Ticket Properties
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4 text-sm">
                <Row label="Customer">
                  {ticket.customer ? (
                    <Link
                      href={`/customers/${ticket.customer.id}`}
                      className="flex items-center gap-1 text-primary font-medium hover:underline"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      {ticket.customer.name}
                    </Link>
                  ) : (
                    <Dash />
                  )}
                </Row>
                <Row label="Account No.">
                  <span className="font-mono text-xs">{ticket.customer?.accountNumber || '—'}</span>
                </Row>
                <Row label="Site">
                  {ticket.site ? (
                    <Link
                      href={`/sites/${ticket.site.id}`}
                      className="flex items-center gap-1 text-primary font-medium hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      {ticket.site.siteName}
                    </Link>
                  ) : (
                    <Dash />
                  )}
                </Row>
                <Row label="Service / Circuit">
                  {ticket.service ? (
                    <Link
                      href={`/services/${ticket.service.id}`}
                      className="flex items-center gap-1 text-primary font-medium hover:underline"
                    >
                      <Globe2 className="w-3.5 h-3.5" />
                      {ticket.service.vendorName} — {ticket.service.serviceType}
                    </Link>
                  ) : (
                    <Dash />
                  )}
                </Row>
                {ticket.service?.circuitId && (
                  <Row label="Circuit ID">
                    <span className="font-mono text-xs tracking-wide">
                      {ticket.service.circuitId}
                    </span>
                  </Row>
                )}
                <Row label="Assignee">
                  <span className="flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                    {ticket.assignedTo?.name || (
                      <span className="text-muted-foreground italic">Unassigned</span>
                    )}
                  </span>
                </Row>
                <Row label="Source">
                  <span className="capitalize">{ticket.source}</span>
                </Row>
                {(ticket.impactLevel || ticket.urgencyLevel) && (
                  <>
                    <div className="border-t border-border/40 pt-3 mt-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        ITIL Assessment
                      </p>
                    </div>
                    {ticket.impactLevel && (
                      <Row label="Impact">
                        <span className="capitalize font-medium">{ticket.impactLevel}</span>
                      </Row>
                    )}
                    {ticket.urgencyLevel && (
                      <Row label="Urgency">
                        <span className="capitalize font-medium">{ticket.urgencyLevel}</span>
                      </Row>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Vendor &amp; SLA
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5 space-y-4 text-sm">
                <Row label="Vendor Ticket ID">
                  {ticket.vendorTicketId ? (
                    <span className="font-mono text-xs font-semibold tracking-wide flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-muted-foreground" />
                      {ticket.vendorTicketId}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground text-xs">Not yet assigned</span>
                  )}
                </Row>
                <Row label="Opened">
                  <span>{new Date(ticket.openedAt).toLocaleString()}</span>
                </Row>
                <Row label="SLA Target">
                  {ticket.slaTargetMinutes ? (
                    <span>{formatDuration(ticket.slaTargetMinutes * 60000)}</span>
                  ) : (
                    <Dash />
                  )}
                </Row>
                <Row label="Vendor Escalation">
                  {escalationAt ? (
                    <span
                      className={cn(
                        'flex items-center gap-1 font-medium',
                        isBreached ? 'text-red-600' : isApproaching ? 'text-orange-500' : '',
                      )}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      {isBreached
                        ? `Overdue by ${formatDuration(breachOverdueMs)}`
                        : escalationAt.toLocaleString()}
                    </span>
                  ) : (
                    <Dash />
                  )}
                </Row>
                {ticket.resolvedAt && (
                  <Row label="Resolved At">
                    <span className="text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {new Date(ticket.resolvedAt).toLocaleString()}
                    </span>
                  </Row>
                )}
              </CardContent>
            </Card>

            <EscalationPanel ticketId={id} isCustomer={isCustomer} isResolved={isResolved} />
          </div>

          {/* Right: Description + Timeline + Add Update */}
          <UpdateTimeline
            description={ticket.description}
            updates={updates}
            isLoadingUpdates={isLoadingUpdates}
            isCustomer={isCustomer}
            updateText={updateText}
            setUpdateText={setUpdateText}
            updateType={updateType}
            setUpdateType={setUpdateType}
            updateVisibility={updateVisibility}
            setUpdateVisibility={setUpdateVisibility}
            onAddUpdate={handleAddUpdate}
            isPostingUpdate={createUpdateMutation.isPending}
          />
        </div>
      </div>
    </AppLayout>
  );
}
