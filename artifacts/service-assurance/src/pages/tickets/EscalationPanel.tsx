import { useState } from "react";
import { Bell, ChevronDown, ChevronRight, Clock, GitBranch, Mail, RefreshCw, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useGetTicketNotifications, useEvaluateEscalation, getGetTicketNotificationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const REASON_LABELS: Record<string, string> = {
  severity_threshold: "Severity threshold met",
  duration_threshold: "Duration threshold reached",
  manual: "Manually triggered",
};

const ROLE_BADGE: Record<string, string> = {
  noc: "bg-blue-100 text-blue-800",
  manager: "bg-purple-100 text-purple-800",
  director: "bg-orange-100 text-orange-800",
  executive: "bg-red-100 text-red-800",
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800",
  high: "bg-orange-100 text-orange-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-slate-100 text-slate-700",
};

interface Props {
  ticketId: string;
  isCustomer: boolean;
  isResolved: boolean;
}

export function EscalationPanel({ ticketId, isCustomer, isResolved }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useGetTicketNotifications(ticketId);
  const evaluateMutation = useEvaluateEscalation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleEvaluate = () => {
    evaluateMutation.mutate({ ticketId }, {
      onSuccess: (result) => {
        queryClient.invalidateQueries({ queryKey: getGetTicketNotificationsQueryKey(ticketId) });
        if (result.notified > 0) {
          toast({ title: `Customer escalation evaluated — ${result.notified} contact(s) notified` });
        } else {
          toast({ title: "Customer escalation evaluated — no new notifications required" });
        }
      },
      onError: (err: any) => {
        toast({ title: "Customer escalation failed", description: err.message, variant: "destructive" });
      },
    });
  };

  if (isCustomer) return null;

  return (
    <Card className="border-border/60 shadow-sm" data-testid="escalation-panel">
      <CardHeader className="pb-2 pt-4 px-5 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Customer Escalation
        </CardTitle>
        {!isResolved && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={handleEvaluate}
            disabled={evaluateMutation.isPending}
            data-testid="evaluate-escalation-btn"
          >
            <RefreshCw className={cn("w-3 h-3 mr-1", evaluateMutation.isPending && "animate-spin")} />
            Evaluate
          </Button>
        )}
      </CardHeader>
      <CardContent className="px-5 pb-4">
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-2">Loading...</p>
        ) : !notifications?.length ? (
          <p className="text-xs text-muted-foreground py-2 italic" data-testid="escalation-empty">
            No customer escalation notifications sent yet. Click Evaluate to check rules.
          </p>
        ) : (
          <div className="space-y-2 mt-1">
            {notifications.map((n) => (
              <div key={n.id} className="border border-border/50 rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(expandedId === n.id ? null : n.id)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {expandedId === n.id
                      ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    }
                    <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium truncate" data-testid="notif-contact-name">{n.contactName}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium capitalize shrink-0", ROLE_BADGE[n.contactRole] ?? "bg-slate-100 text-slate-700")}>
                      {n.contactRole}
                    </span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium uppercase shrink-0", SEVERITY_BADGE[n.severity] ?? "bg-slate-100 text-slate-700")}>
                      {n.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 ml-2">
                    <Clock className="w-3 h-3" />
                    {new Date(n.notifiedAt).toLocaleString()}
                  </div>
                </button>
                {expandedId === n.id && (
                  <div className="px-3 pb-3 pt-1 border-t border-border/50 bg-muted/20">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Mail className="w-3 h-3" />
                      <span>{n.contactEmail}</span>
                      <span className="ml-2 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                        {REASON_LABELS[n.reason] ?? n.reason}
                      </span>
                      <span className="ml-1 text-muted-foreground">
                        · {n.durationMinutes}m into incident
                      </span>
                    </div>
                    {n.ruleDescription && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <GitBranch className="w-3 h-3 shrink-0" />
                        <span className="italic">{n.ruleDescription}</span>
                      </div>
                    )}
                    <pre className="text-xs text-muted-foreground bg-muted/40 rounded p-2 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                      {n.message}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
