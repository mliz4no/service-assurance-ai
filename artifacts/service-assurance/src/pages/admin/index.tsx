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
import { CheckCircle2, XCircle, Activity, Server, ShieldCheck, Database, BrainCircuit, Play, Plus, Pencil, Trash2, Users, Grid3X3 } from "lucide-react";
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

// ── User form ────────────────────────────────────────────────────────────

const userFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password must be at least 6 characters").optional().or(z.literal("")),
  role: z.enum(["admin", "ops", "customer"]),
  customerId: z.string().optional(),
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
        });
      } else {
        form.reset({ name: "", email: "", password: "", role: "ops", customerId: "__none__" });
      }
    }
  }, [open, user, form]);

  function onSubmit(values: UserFormData) {
    if (isEdit && user) {
      const custId = values.customerId && values.customerId !== "__none__" ? values.customerId : null;
      const data: any = {
        name: values.name,
        email: values.email,
        role: values.role as any,
        customerId: values.role === "customer" ? custId : null,
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
      const custIdCreate = values.customerId && values.customerId !== "__none__" ? values.customerId : null;
      createMutation.mutate({
        data: {
          name: values.name,
          email: values.email,
          password: values.password || "",
          role: values.role as any,
          customerId: values.role === "customer" ? custIdCreate : null,
        },
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
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${colors[role] || "bg-slate-100 text-slate-600"}`}>
      {role}
    </span>
  );
}

export default function AdminPanel() {
  const { data: policies, isLoading: loadingPolicies } = useGetSlaPolicies();
  const { data: users, isLoading: loadingUsers } = useGetUsers();
  const { data: health, isLoading: loadingHealth } = useGetConfigHealth();
  const deleteSlaPolicy = useDeleteSlaPolicy();
  const deleteUser = useDeleteUser();
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
