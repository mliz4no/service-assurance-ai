import { AppLayout } from '@/components/layout/app-layout';
import {
  useGetSlaPolicies,
  useGetUsers,
  useGetConfigHealth,
  useAiTest,
  useDeleteSlaPolicy,
  useDeleteUser,
  getGetSlaPoliciesQueryKey,
  getGetUsersQueryKey,
  type SlaPolicy,
  type User,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  Activity,
  Server,
  ShieldCheck,
  BrainCircuit,
  Play,
  Plus,
  Pencil,
  Trash2,
  Users,
  Grid3X3,
  Handshake,
  Cloud,
  RefreshCw,
} from 'lucide-react';
import { usePartners, useDeletePartner } from '@/pages/admin/hooks/useAdminPartners';
import { SalesforcePanel } from '@/pages/admin/components/SalesforcePanel';
import { SlaPolicyDialog } from '@/pages/admin/components/dialogs/SlaPolicyDialog';
import { PartnerDialog } from '@/pages/admin/components/dialogs/PartnerDialog';
import { UserDialog } from '@/pages/admin/components/dialogs/UserDialog';
import { EscalationMatrixEditor } from '@/components/EscalationMatrixEditor';
import { SeverityBadge } from '@/components/severity-badge';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

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

  const [aiTestInput, setAiTestInput] = useState('');
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

  function openEditPolicy(policy: SlaPolicy) {
    setEditingPolicy(policy);
    setSlaPolicyDialogOpen(true);
  }

  function confirmDeletePolicy(id: string) {
    deleteSlaPolicy.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: 'SLA policy deleted' });
          queryClient.invalidateQueries({ queryKey: getGetSlaPoliciesQueryKey() });
          setDeletingPolicyId(null);
        },
        onError: (err: any) => {
          toast({
            title: 'Error deleting SLA policy',
            description: err.message,
            variant: 'destructive',
          });
          setDeletingPolicyId(null);
        },
      },
    );
  }

  function openCreateUser() {
    setEditingUser(null);
    setUserDialogOpen(true);
  }

  function openEditUser(user: User) {
    setEditingUser(user);
    setUserDialogOpen(true);
  }

  function confirmDeleteUser(id: string) {
    deleteUser.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: 'User deleted' });
          queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
          setDeletingUserId(null);
        },
        onError: (err: any) => {
          toast({ title: 'Error deleting user', description: err.message, variant: 'destructive' });
          setDeletingUserId(null);
        },
      },
    );
  }

  function confirmDeletePartner(id: string) {
    deletePartner.mutate(id, {
      onSuccess: () => {
        toast({ title: 'Partner deleted' });
        setDeletingPartnerId(null);
      },
      onError: (err: any) => {
        toast({
          title: 'Error deleting partner',
          description: err.message,
          variant: 'destructive',
        });
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

  function roleBadge(role: string) {
    const colors: Record<string, string> = {
      admin: 'bg-red-100 text-red-700 border-red-200',
      ops: 'bg-blue-100 text-blue-700 border-blue-200',
      customer: 'bg-slate-100 text-slate-600 border-slate-200',
      telecom_services_partner: 'bg-violet-100 text-violet-700 border-violet-200',
    };
    const labels: Record<string, string> = {
      admin: 'admin',
      ops: 'ops',
      customer: 'customer',
      telecom_services_partner: 'partner',
    };
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${colors[role] || 'bg-slate-100 text-slate-600'}`}
      >
        {labels[role] || role}
      </span>
    );
  }

  return (
    <AppLayout title="System Administration">
      <div className="max-w-6xl mx-auto space-y-8">
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
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      <Activity className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !policies?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                      No SLA policies configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  policies.map((policy) => (
                    <TableRow
                      key={policy.id}
                      className="hover:bg-muted/20"
                      data-testid="sla-policy-row"
                    >
                      <TableCell className="font-medium">{policy.name}</TableCell>
                      <TableCell>
                        <SeverityBadge severity={policy.severity} />
                      </TableCell>
                      <TableCell>{policy.initialResponseMinutes}m</TableCell>
                      <TableCell>{policy.escalationMinutes}m</TableCell>
                      <TableCell>{policy.resolutionTargetMinutes}m</TableCell>
                      <TableCell>
                        {policy.isDefault ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEditPolicy(policy)}
                            data-testid="edit-sla-policy-btn"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeletingPolicyId(policy.id)}
                            data-testid="delete-sla-policy-btn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

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
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6">
                      <Activity className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !users?.length ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id} className="hover:bg-muted/20" data-testid="user-row">
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className="text-muted-foreground">{user.email}</TableCell>
                      <TableCell>{roleBadge(user.role)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => openEditUser(user)}
                            data-testid="edit-user-btn"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeletingUserId(user.id)}
                            data-testid="delete-user-btn"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Handshake className="w-5 h-5 text-muted-foreground" /> Telecom Services Partners
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Resellers and aggregators with scoped multi-customer access
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingPartner(null);
                setPartnerDialogOpen(true);
              }}
            >
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
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6">
                      <Activity className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : !partners?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">
                      No partners configured.
                    </TableCell>
                  </TableRow>
                ) : (
                  partners.map((partner) => (
                    <TableRow key={partner.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{partner.companyName}</TableCell>
                      <TableCell>{partner.name}</TableCell>
                      <TableCell className="text-muted-foreground">{partner.email}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${partner.status === 'active' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}
                        >
                          {partner.status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingPartner(partner);
                              setPartnerDialogOpen(true);
                            }}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeletingPartnerId(partner.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <SalesforcePanel />

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Grid3X3 className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-base font-semibold">Escalation Severity Matrix</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            The global matrix defines the default ITIL severity derived from Impact × Urgency.
            Individual customers, locations, and circuits can override specific cells.
          </p>
          <EscalationMatrixEditor
            scopeType="global"
            scopeLabel="Global Default Matrix (ITIL Baseline)"
            defaultExpanded={true}
          />
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-muted-foreground" /> AI Classification Test
            </CardTitle>
            <CardDescription>
              Test the AI normalized status classifier with any update text
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Paste an update from a vendor (e.g. 'We dispatched a tech on-site')"
                value={aiTestInput}
                onChange={(e) => setAiTestInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTestAi()}
                data-testid="ai-test-input"
              />
              <Button
                onClick={handleTestAi}
                disabled={testAiMutation.isPending || !aiTestInput}
                data-testid="ai-test-btn"
              >
                <Play className="w-4 h-4 mr-2" /> Classify
              </Button>
            </div>

            {testAiMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Activity className="w-4 h-4 animate-spin" /> Classifying...
              </div>
            )}

            {testAiMutation.data && (
              <div
                className="p-4 bg-muted/30 rounded-md border border-border/50 space-y-3"
                data-testid="ai-test-result"
              >
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Normalized Status
                    </p>
                    <p className="font-semibold text-primary">
                      {testAiMutation.data.normalizedStatus}
                    </p>
                  </div>
                  {testAiMutation.data.confidence !== undefined && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                        Confidence
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                          testAiMutation.data.confidence >= 80
                            ? 'bg-green-100 text-green-800'
                            : testAiMutation.data.confidence >= 50
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {testAiMutation.data.confidence}%
                      </span>
                    </div>
                  )}
                </div>
                {testAiMutation.data.reasoning && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                      Reasoning
                    </p>
                    <p className="text-sm text-muted-foreground italic">
                      {testAiMutation.data.reasoning}
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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

      <AlertDialog
        open={!!deletingPolicyId}
        onOpenChange={(open) => !open && setDeletingPolicyId(null)}
      >
        <AlertDialogContent data-testid="delete-sla-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SLA Policy?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the SLA policy. Tickets already using this policy will
              not be affected.
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

      <AlertDialog
        open={!!deletingPartnerId}
        onOpenChange={(open) => !open && setDeletingPartnerId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Partner?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the partner organisation. Their linked customers will remain but will
              lose the partner association. User accounts will also lose partner access.
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

      <AlertDialog
        open={!!deletingUserId}
        onOpenChange={(open) => !open && setDeletingUserId(null)}
      >
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
