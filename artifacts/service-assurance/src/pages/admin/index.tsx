import { AppLayout } from "@/components/layout/app-layout";
import {
  useGetSlaPolicies,
  useGetUsers,
  useGetConfigHealth,
  useGetCustomers,
  useAiTest,
  useCreateSlaPolicy,
  useUpdateSlaPolicy,
  useDeleteSlaPolicy,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  getGetSlaPoliciesQueryKey,
  getGetUsersQueryKey,
  type SlaPolicy,
  type User,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Activity, Server, ShieldCheck, Database, BrainCircuit, Play, Plus, Pencil, Trash2, Users, Grid3X3, Handshake, Cloud, RefreshCw } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getToken, clearToken } from "@/lib/token";
import { EscalationMatrixEditor } from "@/components/EscalationMatrixEditor";
import { SeverityBadge } from "@/components/severity-badge";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useEffect } from "react";

// ── SLA Policy form ────────────────────────────────────────────────────

const slaPolicySchema = z.object({
  name: z.string().min(1, "Name is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  initialResponseMinutes: z.coerce.number().int().min(1, "Must be at least 1 minute"),
  escalationMinutes: z.coerce.number().int().min(1, "Must be at least 1 minute"),
  resolutionTargetMinutes: z.coerce.number().int().min(1, "Must be at least 1 minute"),
  isDefault: z.boolean(),
});
type SlaPolicyForm = z.infer<typeof slaPolicySchema>;

function SlaPolicyDialog({
  open,
  onOpenChange,
  policy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: SlaPolicy | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSlaPolicy();
  const updateMutation = useUpdateSlaPolicy();
  const isEdit = !!policy;

  const form = useForm<SlaPolicyForm>({
    resolver: zodResolver(slaPolicySchema),
    defaultValues: {
      name: "",
      severity: "medium",
      initialResponseMinutes: 60,
      escalationMinutes: 240,
      resolutionTargetMinutes: 480,
      isDefault: false,
    },
  });

  useEffect(() => {
    if (open) {
      if (policy) {
        form.reset({
          name: policy.name,
          severity: policy.severity as SlaPolicyForm["severity"],
          initialResponseMinutes: policy.initialResponseMinutes,
          escalationMinutes: policy.escalationMinutes,
          resolutionTargetMinutes: policy.resolutionTargetMinutes,
          isDefault: policy.isDefault ?? false,
        });
      } else {
        form.reset({
          name: "",
          severity: "medium",
          initialResponseMinutes: 60,
          escalationMinutes: 240,
          resolutionTargetMinutes: 480,
          isDefault: false,
        });
      }
    }
  }, [open, policy, form]);

  function onSubmit(values: SlaPolicyForm) {
    const data = {
      name: values.name,
      severity: values.severity as any,
      initialResponseMinutes: values.initialResponseMinutes,
      escalationMinutes: values.escalationMinutes,
      resolutionTargetMinutes: values.resolutionTargetMinutes,
      isDefault: values.isDefault,
    };

    if (isEdit && policy) {
      updateMutation.mutate({ id: policy.id, data }, {
        onSuccess: () => {
          toast({ title: "SLA policy updated" });
          queryClient.invalidateQueries({ queryKey: getGetSlaPoliciesQueryKey() });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error updating SLA policy", description: err.message, variant: "destructive" });
        },
      });
    } else {
      createMutation.mutate({ data }, {
        onSuccess: () => {
          toast({ title: "SLA policy created" });
          queryClient.invalidateQueries({ queryKey: getGetSlaPoliciesQueryKey() });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error creating SLA policy", description: err.message, variant: "destructive" });
        },
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" data-testid="sla-policy-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit SLA Policy" : "Create SLA Policy"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl><Input data-testid="sla-name-input" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="severity" render={({ field }) => (
              <FormItem>
                <FormLabel>Severity *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="sla-severity-select"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-3 gap-4">
              <FormField control={form.control} name="initialResponseMinutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Initial Response (min)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="escalationMinutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Escalation (min)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="resolutionTargetMinutes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Resolution Target (min)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="isDefault" render={({ field }) => (
              <FormItem className="flex items-center gap-3 space-y-0 pt-1">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="w-4 h-4 rounded border-input accent-primary"
                    data-testid="sla-default-checkbox"
                  />
                </FormControl>
                <FormLabel className="font-normal cursor-pointer">Set as default policy for this severity</FormLabel>
              </FormItem>
            )} />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="sla-submit-btn">
                {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Policy"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Partners API hooks ──────────────────────────────────────────────────

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    window.location.href = "/";
    throw new Error("Session expired — redirecting to login…");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

// ── Salesforce API hooks ────────────────────────────────────────────────

function useSalesforceStatus() {
  return useQuery({ queryKey: ["salesforce-status"], queryFn: () => apiFetch("/salesforce/status"), refetchInterval: 30_000 });
}

function useSalesforceConfig() {
  return useQuery({ queryKey: ["salesforce-config"], queryFn: () => apiFetch("/salesforce/config") });
}

function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/salesforce/config", { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["salesforce-config"] });
      qc.invalidateQueries({ queryKey: ["salesforce-status"] });
    },
  });
}

function useSalesforceTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/salesforce/test", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salesforce-status"] }),
  });
}

function useSalesforceSync(type: "accounts" | "contacts" | "full") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/salesforce/sync/${type}`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["salesforce-status"] }),
  });
}

// ── Salesforce Panel ──────────────────────────────────────────────────────

const MASKED = "••••••••";

function SalesforcePanel() {
  const { toast } = useToast();
  const { data: status, isLoading: loadingStatus } = useSalesforceStatus();
  const { data: savedConfig, isLoading: loadingConfig } = useSalesforceConfig();
  const saveConfigMutation = useSaveConfig();
  const testMutation = useSalesforceTest();
  const syncMutation = useSalesforceSync("full");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    clientId: "",
    clientSecret: "",
    instanceUrl: "",
    username: "",
    password: "",
    securityToken: "",
  });

  useEffect(() => {
    if (savedConfig && showForm) {
      setForm({
        clientId:     savedConfig.clientId     || "",
        clientSecret: savedConfig.hasClientSecret ? MASKED : "",
        instanceUrl:  savedConfig.instanceUrl  || "",
        username:     savedConfig.username     || "",
        password:     savedConfig.hasPassword  ? MASKED : "",
      });
    }
  }, [savedConfig, showForm]);

  function handleOpenForm() {
    setShowForm(true);
  }

  function handleSave() {
    const payload: Record<string, string> = {};
    if (form.clientId     && form.clientId     !== MASKED) payload.clientId     = form.clientId;
    if (form.clientSecret && form.clientSecret !== MASKED) payload.clientSecret = form.clientSecret;
    if (form.instanceUrl  && form.instanceUrl  !== MASKED) payload.instanceUrl  = form.instanceUrl;
    if (form.username     && form.username     !== MASKED) payload.username     = form.username;
    if (form.password && form.password !== MASKED) {
      payload.password = form.password + (form.securityToken.trim() ? form.securityToken.trim() : "");
    }

    if (Object.keys(payload).length === 0) {
      toast({ title: "No changes to save." });
      return;
    }

    saveConfigMutation.mutate(payload, {
      onSuccess: () => {
        toast({ title: "Credentials saved" });
        setShowForm(false);
      },
      onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
    });
  }

  function handleTest() {
    testMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        toast({
          title: data.ok ? "Connection successful" : "Connection failed",
          description: data.message,
          variant: data.ok ? "default" : "destructive",
        });
      },
      onError: (err: any) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
    });
  }

  function handleSync() {
    syncMutation.mutate(undefined, {
      onSuccess: (data: any) => {
        const accSynced = data?.accounts?.synced ?? 0;
        const conSynced = data?.contacts?.synced ?? 0;
        toast({ title: "Sync complete", description: `${accSynced} accounts, ${conSynced} contacts synced.` });
      },
      onError: (err: any) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
    });
  }

  const configured = status?.configured ?? false;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#00A1E0]" /> Salesforce Integration
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Read-only sync — pulls Accounts and Contacts into internal customer records
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!showForm && (
              <Button size="sm" variant="outline" onClick={handleOpenForm} disabled={loadingConfig}>
                <Pencil className="w-4 h-4 mr-1.5" />
                {configured ? "Edit Credentials" : "Add Credentials"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={handleTest} disabled={testMutation.isPending || !configured}>
              {testMutation.isPending ? <Activity className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
              Test Connection
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncMutation.isPending || !configured}>
              {syncMutation.isPending ? <Activity className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
              Sync Now
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">

        {/* Credentials form */}
        {showForm && (
          <div className="p-4 bg-muted/20 rounded-lg border border-border/60 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salesforce Credentials</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Instance URL</label>
                <Input
                  value={form.instanceUrl}
                  onChange={set("instanceUrl")}
                  placeholder="https://yourorg.my.salesforce.com"
                  onFocus={() => { if (form.instanceUrl === MASKED) setForm(f => ({ ...f, instanceUrl: "" })); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Username</label>
                <Input
                  value={form.username}
                  onChange={set("username")}
                  placeholder="user@yourorg.com"
                  onFocus={() => { if (form.username === MASKED) setForm(f => ({ ...f, username: "" })); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Consumer Key (Client ID)</label>
                <Input
                  value={form.clientId}
                  onChange={set("clientId")}
                  placeholder="3MVG9..."
                  onFocus={() => { if (form.clientId === MASKED) setForm(f => ({ ...f, clientId: "" })); }}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Consumer Secret</label>
                <textarea
                  value={form.clientSecret}
                  onChange={e => setForm(f => ({ ...f, clientSecret: e.target.value }))}
                  onFocus={() => { if (form.clientSecret === MASKED) setForm(f => ({ ...f, clientSecret: "" })); }}
                  placeholder={savedConfig?.hasClientSecret ? "Leave blank to keep existing" : "Consumer Secret"}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground placeholder:font-sans"
                  autoComplete="off"
                  spellCheck={false}
                />
                {form.clientSecret && form.clientSecret !== MASKED && (
                  <p className="text-xs text-muted-foreground mt-0.5">{form.clientSecret.length} characters</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Password</label>
                <textarea
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  onFocus={() => { if (form.password === MASKED) setForm(f => ({ ...f, password: "" })); }}
                  placeholder={savedConfig?.hasPassword ? "Leave blank to keep existing" : "Salesforce password"}
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 placeholder:text-muted-foreground placeholder:font-sans"
                  autoComplete="off"
                  spellCheck={false}
                />
                {form.password && form.password !== MASKED && (
                  <p className="text-xs text-muted-foreground mt-0.5">{form.password.length} characters</p>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Security Token <span className="font-normal">(optional — required if your org uses IP restrictions)</span>
                </label>
                <Input
                  value={form.securityToken}
                  onChange={set("securityToken")}
                  placeholder="aBcDeFgH1234..."
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The token will be appended directly to your password before saving. Find it in Salesforce → Settings → My Personal Information → Reset My Security Token.
                </p>
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={saveConfigMutation.isPending}>
                {saveConfigMutation.isPending ? "Saving..." : "Save Credentials"}
              </Button>
            </div>
          </div>
        )}

        {/* Status row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Credentials</p>
            <div className="flex items-center gap-1.5">
              {configured ? (
                <><CheckCircle2 className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-green-700">Configured</span></>
              ) : (
                <><XCircle className="w-4 h-4 text-amber-500" /><span className="text-sm font-medium text-amber-700">Not set</span></>
              )}
            </div>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Accounts synced</p>
            <p className="text-lg font-bold">{loadingStatus ? "—" : (status?.accountsSynced ?? 0)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Contacts synced</p>
            <p className="text-lg font-bold">{loadingStatus ? "—" : (status?.contactsSynced ?? 0)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-md border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Last sync</p>
            <p className="text-sm font-medium">
              {loadingStatus ? "—" : status?.lastSyncAt
                ? new Date(status.lastSyncAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                : "Never"}
            </p>
          </div>
        </div>

        {/* Test connection result */}
        {testMutation.data && (
          <div className={`flex items-start gap-2 p-3 rounded-md text-xs border ${testMutation.data.ok ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"}`}>
            {testMutation.data.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{testMutation.data.message}</span>
          </div>
        )}

        {/* Sync result */}
        {syncMutation.data && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md text-xs text-green-800">
            Sync complete — {syncMutation.data.accounts?.synced ?? 0} accounts, {syncMutation.data.contacts?.synced ?? 0} contacts processed.
            {(syncMutation.data.accounts?.errors?.length > 0 || syncMutation.data.contacts?.errors?.length > 0) && (
              <span className="text-amber-700"> Some rows had errors — check sync log below.</span>
            )}
          </div>
        )}

        {/* Sync log */}
        {status?.recentLogs?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Sync Log</p>
            <div className="space-y-1.5">
              {status.recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-3 px-3 py-2 bg-muted/20 rounded border border-border/40 text-xs">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold capitalize ${
                    log.status === "success" ? "bg-green-100 text-green-700"
                    : log.status === "failed" ? "bg-red-100 text-red-700"
                    : "bg-blue-100 text-blue-700"
                  }`}>{log.status}</span>
                  <span className="text-muted-foreground capitalize">{log.syncType}</span>
                  <span className="font-medium">{log.recordsProcessed ?? 0} records</span>
                  <span className="text-muted-foreground ml-auto">{new Date(log.startedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  {log.message && <span className="text-muted-foreground truncate max-w-[200px]" title={log.message}>{log.message}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Partners API hooks ──────────────────────────────────────────────────

function usePartners() {
  return useQuery({ queryKey: ["partners"], queryFn: () => apiFetch("/partners") });
}

function useCreatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => apiFetch("/partners", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}

function useUpdatePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiFetch(`/partners/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}

function useDeletePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/partners/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["partners"] }),
  });
}

const partnerFormSchema = z.object({
  name: z.string().min(1, "Contact name required"),
  companyName: z.string().min(1, "Company name required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  notes: z.string().optional(),
});
type PartnerFormData = z.infer<typeof partnerFormSchema>;

function PartnerDialog({
  open,
  onOpenChange,
  partner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: any | null;
}) {
  const { toast } = useToast();
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const isEdit = !!partner;

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: "", companyName: "", email: "", phone: "", status: "active", notes: "" },
  });

  useEffect(() => {
    if (open) {
      if (partner) {
        form.reset({
          name: partner.name,
          companyName: partner.companyName,
          email: partner.email,
          phone: partner.phone || "",
          status: partner.status,
          notes: partner.notes || "",
        });
      } else {
        form.reset({ name: "", companyName: "", email: "", phone: "", status: "active", notes: "" });
      }
    }
  }, [open, partner, form]);

  function onSubmit(values: PartnerFormData) {
    const payload = { ...values, phone: values.phone || null, notes: values.notes || null };
    if (isEdit) {
      updateMutation.mutate({ id: partner.id, data: payload }, {
        onSuccess: () => { toast({ title: "Partner updated" }); onOpenChange(false); },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => { toast({ title: "Partner created" }); onOpenChange(false); },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Partner" : "New Partner"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="companyName" render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Company Name *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Primary Contact *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Internal Notes</FormLabel>
                <FormControl><Textarea rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Partner"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── User form ────────────────────────────────────────────────────────────

const userFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["admin", "ops", "customer", "telecom_services_partner"]),
  customerId: z.string().optional(),
  telecomServicesPartnerId: z.string().optional(),
});
type UserFormData = z.infer<typeof userFormSchema>;

function UserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const { data: customers } = useGetCustomers();
  const isEdit = !!user;

  const { data: partners } = usePartners();

  const form = useForm<UserFormData>({
    resolver: zodResolver(
      isEdit
        ? userFormSchema.extend({ password: z.string().optional().or(z.literal("")) })
        : userFormSchema.extend({ password: z.string().min(6, "Password must be at least 6 characters") })
    ),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "ops",
      customerId: "__none__",
      telecomServicesPartnerId: "__none__",
    },
  });

  const watchedRole = form.watch("role");

  useEffect(() => {
    if (open) {
      if (user) {
        form.reset({
          name: user.name,
          email: user.email,
          password: "",
          role: user.role as UserFormData["role"],
          customerId: (user as any).customerId || "__none__",
          telecomServicesPartnerId: (user as any).telecomServicesPartnerId || "__none__",
        });
      } else {
        form.reset({ name: "", email: "", password: "", role: "ops", customerId: "__none__", telecomServicesPartnerId: "__none__" });
      }
    }
  }, [open, user, form]);

  function onSubmit(values: UserFormData) {
    const custId = values.customerId && values.customerId !== "__none__" ? values.customerId : null;
    const tspId = values.telecomServicesPartnerId && values.telecomServicesPartnerId !== "__none__" ? values.telecomServicesPartnerId : null;
    if (isEdit && user) {
      const data: any = {
        name: values.name,
        email: values.email,
        role: values.role as any,
        customerId: values.role === "customer" ? custId : null,
        telecomServicesPartnerId: values.role === "telecom_services_partner" ? tspId : null,
      };
      if (values.password) data.password = values.password;

      updateMutation.mutate({ id: user.id, data }, {
        onSuccess: () => {
          toast({ title: "User updated" });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error updating user", description: err.message, variant: "destructive" });
        },
      });
    } else {
      createMutation.mutate({
        data: {
          name: values.name,
          email: values.email,
          password: values.password || "",
          role: values.role as any,
          customerId: values.role === "customer" ? custId : null,
          telecomServicesPartnerId: values.role === "telecom_services_partner" ? tspId : null,
        } as any,
      }, {
        onSuccess: () => {
          toast({ title: "User created" });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: "Error creating user", description: err.message, variant: "destructive" });
        },
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" data-testid="user-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Create User"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl><Input data-testid="user-name-input" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="email" render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl><Input type="email" data-testid="user-email-input" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="password" render={({ field }) => (
              <FormItem>
                <FormLabel>{isEdit ? "Password (leave blank to keep current)" : "Password *"}</FormLabel>
                <FormControl><Input type="password" data-testid="user-password-input" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="role" render={({ field }) => (
              <FormItem>
                <FormLabel>Role *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="ops">Ops</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="telecom_services_partner">Telecom Services Partner</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            {watchedRole === "customer" && (
              <FormField control={form.control} name="customerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Account</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {customers?.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            {watchedRole === "telecom_services_partner" && (
              <FormField control={form.control} name="telecomServicesPartnerId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Partner Organisation</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Select partner" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {partners?.map((p: any) => (
                        <SelectItem key={p.id} value={p.id}>{p.companyName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isPending} data-testid="user-submit-btn">
                {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// ── Main AdminPanel ──────────────────────────────────────────────────────

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    admin: "bg-red-100 text-red-700 border-red-200",
    ops: "bg-blue-100 text-blue-700 border-blue-200",
    customer: "bg-slate-100 text-slate-600 border-slate-200",
    telecom_services_partner: "bg-violet-100 text-violet-700 border-violet-200",
  };
  const labels: Record<string, string> = {
    admin: "admin",
    ops: "ops",
    customer: "customer",
    telecom_services_partner: "partner",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${colors[role] || "bg-slate-100 text-slate-600"}`}>
      {labels[role] || role}
    </span>
  );
}

export default function AdminPanel() {
  const { data: policies, isLoading: loadingPolicies } = useGetSlaPolicies();
  const { data: users, isLoading: loadingUsers } = useGetUsers();
  const { data: health, isLoading: loadingHealth } = useGetConfigHealth();
  const { data: partners, isLoading: loadingPartners } = usePartners();
  const deleteSlaPolicy = useDeleteSlaPolicy();
  const deleteUser = useDeleteUser();
  const deletePartner = useDeletePartner();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [aiTestInput, setAiTestInput] = useState("");
  const testAiMutation = useAiTest();

  const [slaPolicyDialogOpen, setSlaPolicyDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<SlaPolicy | null>(null);
  const [deletingPolicyId, setDeletingPolicyId] = useState<string | null>(null);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState<any | null>(null);
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(null);

  const handleTestAi = () => {
    if (!aiTestInput) return;
    testAiMutation.mutate({ data: { text: aiTestInput } });
  };

  function openCreatePolicy() {
    setEditingPolicy(null);
    setSlaPolicyDialogOpen(true);
  }

  function openEditPolicy(p: SlaPolicy) {
    setEditingPolicy(p);
    setSlaPolicyDialogOpen(true);
  }

  function confirmDeletePolicy(id: string) {
    deleteSlaPolicy.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "SLA policy deleted" });
        queryClient.invalidateQueries({ queryKey: getGetSlaPoliciesQueryKey() });
        setDeletingPolicyId(null);
      },
      onError: (err: any) => {
        toast({ title: "Error deleting SLA policy", description: err.message, variant: "destructive" });
        setDeletingPolicyId(null);
      },
    });
  }

  function openCreateUser() {
    setEditingUser(null);
    setUserDialogOpen(true);
  }

  function openEditUser(u: User) {
    setEditingUser(u);
    setUserDialogOpen(true);
  }

  function confirmDeleteUser(id: string) {
    deleteUser.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "User deleted" });
        queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
        setDeletingUserId(null);
      },
      onError: (err: any) => {
        toast({ title: "Error deleting user", description: err.message, variant: "destructive" });
        setDeletingUserId(null);
      },
    });
  }

  function confirmDeletePartner(id: string) {
    deletePartner.mutate(id, {
      onSuccess: () => {
        toast({ title: "Partner deleted" });
        setDeletingPartnerId(null);
      },
      onError: (err: any) => {
        toast({ title: "Error deleting partner", description: err.message, variant: "destructive" });
        setDeletingPartnerId(null);
      },
    });
  }

  const HealthIndicator = ({ status, label }: { status?: boolean; label: string }) => (
    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border border-border/50">
      <span className="font-medium text-sm">{label}</span>
      {status === undefined ? (
        <Activity className="w-5 h-5 text-muted-foreground animate-spin" />
      ) : status ? (
        <CheckCircle2 className="w-5 h-5 text-green-500" data-testid="health-ok" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" data-testid="health-fail" />
      )}
    </div>
  );

  return (
    <AppLayout title="System Administration">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* System Health */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Server className="w-5 h-5 text-muted-foreground" /> System Health
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <HealthIndicator label="Database Connection" status={health?.database} />
            <HealthIndicator label="OpenAI API" status={health?.openAi} />
            <HealthIndicator label="Session Secret Configured" status={health?.sessionSecret} />
          </CardContent>
        </Card>

        {/* SLA Policies */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-muted-foreground" /> SLA Policies
            </CardTitle>
            <Button size="sm" onClick={openCreatePolicy} data-testid="add-sla-policy-btn">
              <Plus className="w-4 h-4 mr-1.5" /> Add Policy
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Name</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Initial Response</TableHead>
                  <TableHead>Escalation</TableHead>
                  <TableHead>Resolution Target</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPolicies ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6"><Activity className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : !policies?.length ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-6 text-muted-foreground">No SLA policies configured.</TableCell></TableRow>
                ) : policies.map(p => (
                  <TableRow key={p.id} className="hover:bg-muted/20" data-testid="sla-policy-row">
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><SeverityBadge severity={p.severity} /></TableCell>
                    <TableCell>{p.initialResponseMinutes}m</TableCell>
                    <TableCell>{p.escalationMinutes}m</TableCell>
                    <TableCell>{p.resolutionTargetMinutes}m</TableCell>
                    <TableCell>
                      {p.isDefault ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditPolicy(p)} data-testid="edit-sla-policy-btn">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingPolicyId(p.id)} data-testid="delete-sla-policy-btn">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Users */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-muted-foreground" /> Users
            </CardTitle>
            <Button size="sm" onClick={openCreateUser} data-testid="add-user-btn">
              <Plus className="w-4 h-4 mr-1.5" /> Add User
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingUsers ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6"><Activity className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : !users?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No users found.</TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id} className="hover:bg-muted/20" data-testid="user-row">
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{roleBadge(u.role)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditUser(u)} data-testid="edit-user-btn">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingUserId(u.id)} data-testid="delete-user-btn">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Partners */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Handshake className="w-5 h-5 text-muted-foreground" /> Telecom Services Partners
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">Resellers and aggregators with scoped multi-customer access</CardDescription>
            </div>
            <Button size="sm" onClick={() => { setEditingPartner(null); setPartnerDialogOpen(true); }}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Partner
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Company</TableHead>
                  <TableHead>Primary Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPartners ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6"><Activity className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                ) : !partners?.length ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No partners configured.</TableCell></TableRow>
                ) : partners.map((p: any) => (
                  <TableRow key={p.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">{p.companyName}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell className="text-muted-foreground">{p.email}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${p.status === "active" ? "bg-green-100 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200"}`}>
                        {p.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingPartner(p); setPartnerDialogOpen(true); }}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingPartnerId(p.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Salesforce Integration */}
        <SalesforcePanel />

        {/* Global Escalation Matrix */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Grid3X3 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Escalation Severity Matrix</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            The global matrix defines the default ITIL severity derived from Impact × Urgency. Individual customers, locations, and circuits can override specific cells.
          </p>
          <EscalationMatrixEditor
            scopeType="global"
            scopeLabel="Global Default Matrix (ITIL Baseline)"
            defaultExpanded={true}
          />
        </div>

        {/* AI Test Panel */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-muted-foreground" /> AI Classification Test
            </CardTitle>
            <CardDescription>Test the AI normalized status classifier with any update text</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Paste an update from a vendor (e.g. 'We dispatched a tech on-site')"
                value={aiTestInput}
                onChange={(e) => setAiTestInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestAi()}
                data-testid="ai-test-input"
              />
              <Button onClick={handleTestAi} disabled={testAiMutation.isPending || !aiTestInput} data-testid="ai-test-btn">
                <Play className="w-4 h-4 mr-2" /> Classify
              </Button>
            </div>

            {testAiMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="w-4 h-4 animate-spin" /> Classifying...
              </div>
            )}

            {testAiMutation.data && (
              <div className="p-4 bg-muted/30 rounded-md border border-border/50 space-y-3" data-testid="ai-test-result">
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Normalized Status</p>
                    <p className="font-semibold text-primary">{testAiMutation.data.normalizedStatus}</p>
                  </div>
                  {testAiMutation.data.confidence !== undefined && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Confidence</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                        testAiMutation.data.confidence >= 80
                          ? "bg-green-100 text-green-800"
                          : testAiMutation.data.confidence >= 50
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}>
                        {testAiMutation.data.confidence}%
                      </span>
                    </div>
                  )}
                </div>
                {testAiMutation.data.reasoning && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Reasoning</p>
                    <p className="text-sm text-muted-foreground italic">{testAiMutation.data.reasoning}</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Dialogs */}
      <SlaPolicyDialog
        open={slaPolicyDialogOpen}
        onOpenChange={(open) => {
          setSlaPolicyDialogOpen(open);
          if (!open) setEditingPolicy(null);
        }}
        policy={editingPolicy}
      />

      <UserDialog
        open={userDialogOpen}
        onOpenChange={(open) => {
          setUserDialogOpen(open);
          if (!open) setEditingUser(null);
        }}
        user={editingUser}
      />

      <PartnerDialog
        open={partnerDialogOpen}
        onOpenChange={(open) => {
          setPartnerDialogOpen(open);
          if (!open) setEditingPartner(null);
        }}
        partner={editingPartner}
      />

      {/* Delete SLA Policy Confirm */}
      <AlertDialog open={!!deletingPolicyId} onOpenChange={(open) => !open && setDeletingPolicyId(null)}>
        <AlertDialogContent data-testid="delete-sla-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SLA Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the SLA policy. Tickets already using this policy will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPolicyId && confirmDeletePolicy(deletingPolicyId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-sla-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Partner Confirm */}
      <AlertDialog open={!!deletingPartnerId} onOpenChange={(open) => !open && setDeletingPartnerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the partner organisation. Their linked customers will remain but will lose the partner association. User accounts will also lose partner access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingPartnerId && confirmDeletePartner(deletingPartnerId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete User Confirm */}
      <AlertDialog open={!!deletingUserId} onOpenChange={(open) => !open && setDeletingUserId(null)}>
        <AlertDialogContent data-testid="delete-user-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user account. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUserId && confirmDeleteUser(deletingUserId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-user-btn"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </AppLayout>
  );
}
