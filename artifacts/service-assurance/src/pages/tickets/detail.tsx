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
  useGetUsers
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Activity, Ticket as TicketIcon, Clock, Building2, MapPin, Globe2, Sparkles, User as UserIcon } from "lucide-react";
import { Link } from "wouter";
import { StatusBadge } from "@/components/status-badge";
import { SeverityBadge } from "@/components/severity-badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

export default function TicketDetail() {
  const params = useParams();
  const id = params.id as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  const [updateText, setUpdateText] = useState("");
  const [updateType, setUpdateType] = useState<"internal_note" | "vendor_update" | "customer_update">("internal_note");
  const [updateVisibility, setUpdateVisibility] = useState<"internal" | "customer">("internal");

  const { data: ticket, isLoading: isLoadingTicket } = useGetTicket(id, { query: { enabled: !!id } });
  const { data: updates, isLoading: isLoadingUpdates } = useGetTicketUpdates(id, { query: { enabled: !!id } });
  const { data: users } = useGetUsers();

  const updateMutation = useUpdateTicket();
  const createUpdateMutation = useCreateTicketUpdate();
  const summarizeMutation = useAiSummarizeTicket();
  const normalizeMutation = useAiNormalizeLatestUpdate();
  const customerUpdateMutation = useAiGenerateCustomerUpdate();

  if (isLoadingTicket) return <AppLayout title="Loading Ticket..."><div className="flex justify-center py-12"><Activity className="w-8 h-8 animate-spin text-muted-foreground" /></div></AppLayout>;
  if (!ticket) return <AppLayout title="Ticket Not Found"><div className="text-center py-12 text-muted-foreground">Ticket not found.</div></AppLayout>;

  const handleStatusChange = (newStatus: any) => {
    updateMutation.mutate({
      id,
      data: { status: newStatus }
    }, {
      onSuccess: () => {
        // Log a system event
        createUpdateMutation.mutate({
          id,
          data: {
            updateType: "system_event",
            rawText: `Status changed to ${newStatus}`,
            visibility: "internal"
          }
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
          }
        });
      }
    });
  };

  const handleAssigneeChange = (newUserId: string) => {
    updateMutation.mutate({
      id,
      data: { assignedToUserId: newUserId === "unassigned" ? null : newUserId }
    }, {
      onSuccess: () => {
        const userName = newUserId === "unassigned" ? "Unassigned" : (users?.find(u => u.id === newUserId)?.name || "Unknown User");
        createUpdateMutation.mutate({
          id,
          data: {
            updateType: "system_event",
            rawText: `Assigned to ${userName}`,
            visibility: "internal"
          }
        }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) });
            queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
          }
        });
      }
    });
  }

  const handleAddUpdate = () => {
    if (!updateText.trim()) return;
    createUpdateMutation.mutate({
      id,
      data: {
        updateType,
        rawText: updateText,
        visibility: updateVisibility
      }
    }, {
      onSuccess: () => {
        setUpdateText("");
        toast({ title: "Update added" });
        queryClient.invalidateQueries({ queryKey: getGetTicketUpdatesQueryKey(id) });
      },
      onError: (err: any) => {
        toast({ title: "Error adding update", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleAiAction = (action: () => void) => {
    toast({ title: "Running AI...", description: "This may take a few seconds." });
    action();
  };

  const isCustomer = currentUser?.role === "customer";
  const isBreached = ticket.nextEscalationAt && new Date(ticket.nextEscalationAt) < new Date();

  return (
    <AppLayout title={`${ticket.ticketNumber} - ${ticket.title}`}>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
              <TicketIcon className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                {ticket.ticketNumber}
                <SeverityBadge severity={ticket.severity} />
                <StatusBadge status={ticket.status} />
              </h1>
              <p className="text-muted-foreground">{ticket.title}</p>
            </div>
          </div>
          
          {!isCustomer && (
            <div className="flex items-center gap-2">
              <Select value={ticket.assignedToUserId || "unassigned"} onValueChange={handleAssigneeChange}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {users?.filter(u => u.role !== 'customer').map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px] bg-white">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="vendor_engaged">Vendor Engaged</SelectItem>
                  <SelectItem value="dispatch_scheduled">Dispatch Scheduled</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Details & AI */}
          <div className="lg:col-span-1 space-y-6">
            
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base font-semibold">Properties</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Customer</p>
                  {ticket.customer ? (
                    <Link href={`/customers/${ticket.customer.id}`} className="font-medium text-primary hover:underline flex items-center gap-1"><Building2 className="w-3 h-3"/> {ticket.customer.name}</Link>
                  ) : "-"}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Site</p>
                  {ticket.site ? (
                    <Link href={`/sites/${ticket.site.id}`} className="font-medium text-primary hover:underline flex items-center gap-1"><MapPin className="w-3 h-3"/> {ticket.site.siteName}</Link>
                  ) : "-"}
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Service</p>
                  {ticket.service ? (
                    <Link href={`/services/${ticket.service.id}`} className="font-medium text-primary hover:underline flex items-center gap-1"><Globe2 className="w-3 h-3"/> {ticket.service.vendorName} ({ticket.service.serviceType})</Link>
                  ) : "-"}
                </div>
                
                <div className="pt-4 border-t border-border/50">
                  <p className="text-muted-foreground mb-1">Opened</p>
                  <p className="font-medium">{new Date(ticket.openedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Next Escalation SLA</p>
                  <p className={`font-medium flex items-center gap-1 ${isBreached ? 'text-red-600' : ''}`}>
                    <Clock className="w-3 h-3" />
                    {ticket.nextEscalationAt ? new Date(ticket.nextEscalationAt).toLocaleString() : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Vendor Ticket ID</p>
                  <p className="font-medium font-mono">{ticket.vendorTicketId || "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Assignee</p>
                  <p className="font-medium flex items-center gap-1">
                    <UserIcon className="w-3 h-3" />
                    {ticket.assignedTo ? ticket.assignedTo.name : "Unassigned"}
                  </p>
                </div>
              </CardContent>
            </Card>

            {!isCustomer && (
              <Card className="border-border/50 shadow-sm bg-indigo-50/30 border-indigo-100">
                <CardHeader className="pb-3 border-b border-indigo-100/50">
                  <CardTitle className="text-base font-semibold flex items-center gap-2 text-indigo-900">
                    <Sparkles className="w-5 h-5 text-indigo-500" /> AI Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-6">
                  
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-indigo-900">Executive Summary</p>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-indigo-600" 
                        onClick={() => handleAiAction(() => summarizeMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) }) }))}
                        disabled={summarizeMutation.isPending}>
                        {summarizeMutation.isPending ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {ticket.aiSummary ? (
                      <p className="text-sm text-slate-700 bg-white p-3 rounded-md border border-indigo-100/50 shadow-sm">{ticket.aiSummary}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not yet generated</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-indigo-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-indigo-900">Normalized Vendor Status</p>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-indigo-600" 
                        onClick={() => handleAiAction(() => normalizeMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) }) }))}
                        disabled={normalizeMutation.isPending}>
                        {normalizeMutation.isPending ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {ticket.aiNormalizedStatus ? (
                      <div className="bg-white p-3 rounded-md border border-indigo-100/50 shadow-sm">
                        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">{ticket.aiNormalizedStatus}</Badge>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not yet generated</p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-indigo-100/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-indigo-900">Draft Customer Update</p>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-indigo-600" 
                        onClick={() => handleAiAction(() => customerUpdateMutation.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetTicketQueryKey(id) }) }))}
                        disabled={customerUpdateMutation.isPending}>
                        {customerUpdateMutation.isPending ? "Generating..." : "Generate"}
                      </Button>
                    </div>
                    {ticket.aiCustomerUpdate ? (
                      <div className="space-y-2">
                        <p className="text-sm text-slate-700 bg-white p-3 rounded-md border border-indigo-100/50 shadow-sm">{ticket.aiCustomerUpdate}</p>
                        <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => {
                          setUpdateText(ticket.aiCustomerUpdate || "");
                          setUpdateType("customer_update");
                          setUpdateVisibility("customer");
                          window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                        }}>Use as Update</Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not yet generated</p>
                    )}
                  </div>

                </CardContent>
              </Card>
            )}

          </div>

          {/* Right Column: Timeline */}
          <div className="lg:col-span-2 space-y-6">
            
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base font-semibold">Description</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="whitespace-pre-wrap text-sm">{ticket.description || "No description provided."}</p>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="text-base font-semibold">Timeline</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {isLoadingUpdates ? (
                  <div className="flex justify-center py-8"><Activity className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : !updates?.length ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No updates yet.</p>
                ) : (
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                    {updates.map((update, idx) => (
                      <div key={update.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          {update.updateType === "system_event" ? <Activity className="w-4 h-4"/> : <UserIcon className="w-4 h-4"/>}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-border/50 bg-white shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex gap-2">
                              <Badge variant="outline" className="text-[10px] uppercase bg-slate-50">{update.updateType.replace("_", " ")}</Badge>
                              {!isCustomer && update.visibility === "internal" && <Badge variant="secondary" className="text-[10px] uppercase">Internal Only</Badge>}
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(update.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{update.rawText}</p>
                          {update.normalizedStatus && !isCustomer && (
                            <div className="mt-2 text-xs flex items-center gap-1 text-indigo-600">
                              <Sparkles className="w-3 h-3"/> Normalized: {update.normalizedStatus}
                            </div>
                          )}
                          <p className="text-xs text-muted-foreground mt-2 text-right">By {update.createdBy?.name || "System"}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Add Update Form */}
            {!isCustomer && (
              <Card className="border-border/50 shadow-sm mt-6">
                <CardHeader className="pb-3 border-b border-border/50 bg-slate-50/50 rounded-t-lg">
                  <CardTitle className="text-base font-semibold">Add Update</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex gap-4">
                    <Select value={updateType} onValueChange={(v: any) => setUpdateType(v)}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal_note">Internal Note</SelectItem>
                        <SelectItem value="vendor_update">Vendor Update</SelectItem>
                        <SelectItem value="customer_update">Customer Update</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select value={updateVisibility} onValueChange={(v: any) => setUpdateVisibility(v)}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Internal Only</SelectItem>
                        <SelectItem value="customer">Visible to Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Textarea 
                    placeholder="Type your update here..." 
                    className="min-h-[100px]"
                    value={updateText}
                    onChange={(e) => setUpdateText(e.target.value)}
                  />
                  
                  <div className="flex justify-end">
                    <Button onClick={handleAddUpdate} disabled={createUpdateMutation.isPending || !updateText.trim()}>
                      {createUpdateMutation.isPending ? "Adding..." : "Add Update"}
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

// Inline Badge for use in this file to avoid another file creation if not needed, or use shadcn one
import { Badge } from "@/components/ui/badge";
