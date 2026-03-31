import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
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
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ClipboardCopy,
  ExternalLink,
  Globe2,
  Lock,
  MapPin,
  MessageSquare,
  RefreshCw,
  Sparkles,
  Tag,
  Truck,
  User as UserIcon,
  Wrench,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_STEPS = [
  { value: "new", label: "New" },
  { value: "investigating", label: "Investigating" },
  { value: "vendor_engaged", label: "Vendor Engaged" },
  { value: "dispatch_scheduled", label: "Dispatch" },
  { value: "monitoring", label: "Monitoring" },
  { value: "resolved", label: "Resolved" },
] as const;

const STATUS_ORDER = STATUS_STEPS.map((s) => s.value);

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

function formatDuration(ms: number): string {
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

const UPDATE_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; bg: string; text: string; border: string }
> = {
  system_event: {
    label: "System Event",
    icon: Zap,
    bg: "bg-slate-100",
    text: "text-slate-600",
    border: "border-slate-200",
  },
  internal_note: {
    label: "Internal Note",
    icon: Lock,
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
  },
  vendor_update: {
    label: "Vendor Update",
    icon: Wrench,
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
  },
  customer_update: {
    label: "Customer Update",
    icon: MessageSquare,
    bg: "bg-green-50",
    text: "text-green-700",
    border: "border-green-200",
  },
  ai_generated: {
    label: "AI Generated",
    icon: Sparkles,
    bg: "bg-indigo-50",
    text: "text-indigo-700",
    border: "border-indigo-200",
  },
};

export default function TicketDetail() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [updateText, setUpdateText] = useState("");
  const [updateType, setUpdateType] = useState<
    "internal_note" | "vendor_update" | "customer_update"
  >("internal_note");
  const [updateVisibility, setUpdateVisibility] = useState<"internal" | "customer">("internal");

  const { data: ticket, isLoading: isLoadingTicket } = useGetTicket(id, {
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

  if (!ticket) {
    return (
      <AppLayout title="Not Found">
        <div className="text-center py-20 text-muted-foreground">Ticket not found.</div>
      </AppLayout>
    );
  }

  const isCustomer = currentUser?.role === "customer";
  const now = new Date();
  const escalationAt = ticket.nextEscalationAt ? new Date(ticket.nextEscalationAt) : null;
  const isBreached = escalationAt && escalationAt < now;
  const minsUntilBreach = escalationAt
    ? Math.floor((escalationAt.getTime() - now.getTime()) / 60000)
    : null;
  const isApproaching = !isBreached && minsUntilBreach !== null && minsUntilBreach < 60;
  const breachOverdueMs = isBreached ? now.getTime() - escalationAt!.getTime() : 0;
  const isResolved = ticket.status === "resolved" || ticket.status === "closed";
  const currentStepIdx = STATUS_ORDER.indexOf(ticket.status as any);

  const handleStatusChange = (newStatus: string) => {
    updateMutation.mutate(
      { id, data: { status: newStatus as any } },
      {
        onSuccess: () => {
          createUpdateMutation.mutate(
            {
              id,
              data: {
                updateType: "system_event",
                rawText: `Status changed to ${newStatus.replace(/_/g, " ")}`,
                visibility: "internal",
              },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
                queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
                toast({ title: "Status updated" });
              },
            }
          );
        },
        onError: (err: any) => {
          toast({ title: "Failed to update status", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleAssigneeChange = (newUserId: string) => {
    updateMutation.mutate(
      { id, data: { assignedToUserId: newUserId === "unassigned" ? null : newUserId } },
      {
        onSuccess: () => {
          const userName =
            newUserId === "unassigned"
              ? "Unassigned"
              : users?.find((u) => u.id === newUserId)?.name || "Unknown";
          createUpdateMutation.mutate(
            {
              id,
              data: {
                updateType: "system_event",
                rawText: `Assigned to ${userName}`,
                visibility: "internal",
              },
            },
            {
              onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
                queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
              },
            }
          );
        },
      }
    );
  };

  const handleAddUpdate = () => {
    if (!updateText.trim()) return;
    createUpdateMutation.mutate(
      { id, data: { updateType, rawText: updateText, visibility: updateVisibility } },
      {
        onSuccess: () => {
          setUpdateText("");
          toast({ title: "Update posted" });
          queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
        },
        onError: (err: any) => {
          toast({ title: "Error posting update", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const runAi = (
    action: "summarize" | "normalize" | "customer_update"
  ) => {
    const mut =
      action === "summarize"
        ? summarizeMutation
        : action === "normalize"
        ? normalizeMutation
        : customerUpdateMutation;
    (mut as any).mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
          toast({ title: "AI output generated" });
        },
        onError: (err: any) => {
          toast({
            title: "AI generation failed",
            description: err.message || "Check your OPENAI_API_KEY",
            variant: "destructive",
          });
        },
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <AppLayout title={`${ticket.ticketNumber} — ${ticket.title}`}>
      <div className="max-w-7xl mx-auto pb-16 space-y-0">

        {/* ── Escalation Banner ─────────────────────────────── */}
        {isBreached && !isResolved && (
          <div className="flex items-center gap-3 px-5 py-3 mb-4 bg-red-600 text-white rounded-lg text-sm font-medium shadow-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              SLA BREACH — Escalation was due {formatDuration(breachOverdueMs)} ago. Immediate action required.
            </span>
          </div>
        )}
        {isApproaching && !isResolved && (
          <div className="flex items-center gap-3 px-5 py-3 mb-4 bg-orange-500 text-white rounded-lg text-sm font-medium shadow-sm">
            <Clock className="w-4 h-4 shrink-0" />
            <span>
              Escalation due in {minsUntilBreach}m — {ticket.ticketNumber} requires attention soon.
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
                  {ticket.outageType && ticket.outageType !== "unknown" && (
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
                      {ticket.service.vendorName} · {ticket.service.circuitId || ticket.service.serviceType}
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
                    value={ticket.assignedToUserId || "unassigned"}
                    onValueChange={handleAssigneeChange}
                    disabled={updateMutation.isPending}
                  >
                    <SelectTrigger className="w-[170px] h-8 text-sm bg-white">
                      <UserIcon className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                      <SelectValue placeholder="Assignee" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {users
                        ?.filter((u) => u.role !== "customer")
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={ticket.status}
                    onValueChange={handleStatusChange}
                    disabled={updateMutation.isPending}
                  >
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
                        <button
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all",
                            isCurrent
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : isDone
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                          onClick={() => handleStatusChange(step.value)}
                          disabled={updateMutation.isPending}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : (
                            <span
                              className={cn(
                                "w-4 h-4 rounded-full border-2 flex items-center justify-center text-[9px] font-bold",
                                isCurrent
                                  ? "border-primary-foreground bg-primary-foreground/20 text-primary-foreground"
                                  : "border-current"
                              )}
                            >
                              {idx + 1}
                            </span>
                          )}
                          {step.label}
                        </button>
                        {!isLast && (
                          <div
                            className={cn(
                              "h-px w-6 mx-1 shrink-0",
                              isDone ? "bg-green-300" : "bg-border"
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

        {/* ── AI Insights Panel (ops/admin only) ────────────── */}
        {!isCustomer && (
          <Card className="border-indigo-200 bg-indigo-50/40 shadow-sm mb-5">
            <CardHeader className="pb-0 pt-4 px-5">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <CardTitle className="text-sm font-semibold text-indigo-900">
                  AI Insights
                </CardTitle>
                {ticket.aiLastGeneratedAt && (
                  <span className="text-xs text-indigo-500 ml-auto">
                    Last generated {timeAgo(ticket.aiLastGeneratedAt)}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pt-3 pb-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Executive Summary */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                      Executive Summary
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                      onClick={() => runAi("summarize")}
                      disabled={summarizeMutation.isPending}
                    >
                      {summarizeMutation.isPending ? (
                        <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating</>
                      ) : (
                        <><RefreshCw className="w-3 h-3 mr-1" />Regenerate</>
                      )}
                    </Button>
                  </div>
                  {ticket.aiSummary ? (
                    <p className="text-sm text-slate-700 bg-white rounded-md border border-indigo-100 p-3 leading-relaxed">
                      {ticket.aiSummary}
                    </p>
                  ) : (
                    <button
                      onClick={() => runAi("summarize")}
                      className="w-full text-sm text-indigo-500 italic bg-white rounded-md border border-dashed border-indigo-200 p-3 text-left hover:bg-indigo-50 transition-colors"
                    >
                      Click to generate summary...
                    </button>
                  )}
                </div>

                {/* Normalized Vendor Status */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                      Normalized Status
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                      onClick={() => runAi("normalize")}
                      disabled={normalizeMutation.isPending}
                    >
                      {normalizeMutation.isPending ? (
                        <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating</>
                      ) : (
                        <><RefreshCw className="w-3 h-3 mr-1" />Regenerate</>
                      )}
                    </Button>
                  </div>
                  {ticket.aiNormalizedStatus ? (
                    <div className="bg-white rounded-md border border-indigo-100 p-3">
                      <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 font-medium">
                        {ticket.aiNormalizedStatus}
                      </Badge>
                    </div>
                  ) : (
                    <button
                      onClick={() => runAi("normalize")}
                      className="w-full text-sm text-indigo-500 italic bg-white rounded-md border border-dashed border-indigo-200 p-3 text-left hover:bg-indigo-50 transition-colors"
                    >
                      Click to normalize latest vendor update...
                    </button>
                  )}
                </div>

                {/* Customer Update Draft */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-indigo-800 uppercase tracking-wide">
                      Customer Update Draft
                    </p>
                    <div className="flex gap-1">
                      {ticket.aiCustomerUpdate && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                          onClick={() => copyToClipboard(ticket.aiCustomerUpdate!)}
                        >
                          <ClipboardCopy className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs text-indigo-600 hover:bg-indigo-100"
                        onClick={() => runAi("customer_update")}
                        disabled={customerUpdateMutation.isPending}
                      >
                        {customerUpdateMutation.isPending ? (
                          <><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Generating</>
                        ) : (
                          <><RefreshCw className="w-3 h-3 mr-1" />Regenerate</>
                        )}
                      </Button>
                    </div>
                  </div>
                  {ticket.aiCustomerUpdate ? (
                    <div className="space-y-2">
                      <p className="text-sm text-slate-700 bg-white rounded-md border border-indigo-100 p-3 leading-relaxed">
                        {ticket.aiCustomerUpdate}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs h-7 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                        onClick={() => {
                          setUpdateText(ticket.aiCustomerUpdate!);
                          setUpdateType("customer_update");
                          setUpdateVisibility("customer");
                          document.getElementById("update-form")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Use as Update
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => runAi("customer_update")}
                      className="w-full text-sm text-indigo-500 italic bg-white rounded-md border border-dashed border-indigo-200 p-3 text-left hover:bg-indigo-50 transition-colors"
                    >
                      Click to draft customer-facing update...
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
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
                  <span className="font-mono text-xs">
                    {(ticket.customer as any)?.accountNumber || "—"}
                  </span>
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
                <Row label="Next Escalation">
                  {escalationAt ? (
                    <span
                      className={cn(
                        "flex items-center gap-1 font-medium",
                        isBreached ? "text-red-600" : isApproaching ? "text-orange-500" : ""
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

          </div>

          {/* Right: Description + Timeline + Add Update */}
          <div className="lg:col-span-2 space-y-5">

            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 pb-5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                  {ticket.description || (
                    <span className="italic text-muted-foreground">No description provided.</span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-5 flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Activity Timeline
                </CardTitle>
                {updates && (
                  <span className="text-xs text-muted-foreground">
                    {updates.length} {updates.length === 1 ? "entry" : "entries"}
                  </span>
                )}
              </CardHeader>
              <CardContent className="px-5 pb-5">
                {isLoadingUpdates ? (
                  <div className="flex justify-center py-10">
                    <Activity className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !updates?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No activity yet.
                  </p>
                ) : (
                  <div className="relative">
                    {/* Vertical line */}
                    <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

                    <div className="space-y-4">
                      {[...updates]
                        .sort(
                          (a, b) =>
                            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                        )
                        .map((update) => {
                          const cfg =
                            UPDATE_TYPE_CONFIG[update.updateType] ||
                            UPDATE_TYPE_CONFIG.system_event;
                          const Icon = cfg.icon;
                          const isInternal =
                            update.visibility === "internal" &&
                            update.updateType !== "system_event";

                          return (
                            <div key={update.id} className="flex gap-4 relative">
                              {/* Icon */}
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 z-10",
                                  cfg.bg,
                                  cfg.border,
                                  "border-white ring-2 ring-white"
                                )}
                              >
                                <Icon className={cn("w-3.5 h-3.5", cfg.text)} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 pb-1">
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0",
                                      cfg.bg,
                                      cfg.text,
                                      cfg.border
                                    )}
                                  >
                                    {cfg.label}
                                  </Badge>
                                  {isInternal && !isCustomer && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-slate-50 text-slate-600 border-slate-200 px-1.5 py-0"
                                    >
                                      <Lock className="w-2.5 h-2.5 mr-0.5" /> Internal
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground ml-auto">
                                    {timeAgo(update.createdAt)} ·{" "}
                                    {update.createdBy?.name || "System"}
                                  </span>
                                </div>
                                <div
                                  className={cn(
                                    "text-sm rounded-md border p-3 leading-relaxed whitespace-pre-wrap",
                                    update.updateType === "system_event"
                                      ? "bg-slate-50 border-slate-100 text-slate-500 italic text-xs"
                                      : "bg-white border-border/60 text-foreground"
                                  )}
                                >
                                  {update.rawText}
                                </div>
                                {update.normalizedStatus && !isCustomer && (
                                  <div className="mt-1 flex items-center gap-1 text-xs text-indigo-600">
                                    <Sparkles className="w-3 h-3" />
                                    Normalized: {update.normalizedStatus}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Update Form */}
            {!isCustomer && (
              <Card id="update-form" className="border-border/60 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Post Update
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-5 pb-5 space-y-3">
                  <div className="flex flex-wrap gap-3">
                    <Select
                      value={updateType}
                      onValueChange={(v: any) => {
                        setUpdateType(v);
                        setUpdateVisibility(v === "customer_update" ? "customer" : "internal");
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal_note">Internal Note</SelectItem>
                        <SelectItem value="vendor_update">Vendor Update</SelectItem>
                        <SelectItem value="customer_update">Customer Update</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={updateVisibility}
                      onValueChange={(v: any) => setUpdateVisibility(v)}
                    >
                      <SelectTrigger className="w-[175px] h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal Only</SelectItem>
                        <SelectItem value="customer">Visible to Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea
                    placeholder="Type your update..."
                    className="min-h-[120px] text-sm resize-none"
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                  />

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {updateVisibility === "customer"
                        ? "This update will be visible to the customer."
                        : "This update is internal only."}
                    </p>
                    <Button
                      onClick={handleAddUpdate}
                      disabled={createUpdateMutation.isPending || !updateText.trim()}
                      size="sm"
                    >
                      {createUpdateMutation.isPending ? "Posting..." : "Post Update"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}

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
