import { AppLayout } from "@/components/layout/app-layout";
import { useGetControllers, useTestControllerConnection, useSyncController, useDeleteController, useCreateController, useUpdateController, type ControllerRecord } from "@/lib/controller-hooks";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Plus, Link2, Trash2, Pencil, Server, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

function vendorBadge(vendor: string) {
  return vendor === "meraki"
    ? <Badge className="bg-teal-100 text-teal-800 border-teal-200">Meraki</Badge>
    : <Badge className="bg-orange-100 text-orange-800 border-orange-200">Fortinet</Badge>;
}

function pollStatusIcon(status: string | null) {
  if (status === "success") return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-red-500" />;
  if (status === "running") return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
  return <Clock className="h-4 w-4 text-muted-foreground" />;
}

interface ControllerFormData {
  name: string;
  vendor: "meraki" | "fortinet";
  type: "sdwan" | "firewall_manager" | "network_manager";
  baseUrl: string;
  apiKeyEncryptedOrPlaceholder: string;
  organizationIdOrTenant: string;
  pollingEnabled: boolean;
  pollingIntervalSeconds: number;
}

const defaultForm: ControllerFormData = {
  name: "",
  vendor: "meraki",
  type: "network_manager",
  baseUrl: "",
  apiKeyEncryptedOrPlaceholder: "",
  organizationIdOrTenant: "",
  pollingEnabled: false,
  pollingIntervalSeconds: 300,
};

export default function ControllersPage() {
  const { data: controllers, isLoading } = useGetControllers();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const testConnection = useTestControllerConnection();
  const syncController = useSyncController();
  const deleteController = useDeleteController();
  const createController = useCreateController();
  const updateController = useUpdateController();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingController, setEditingController] = useState<ControllerRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ControllerRecord | null>(null);
  const [form, setForm] = useState<ControllerFormData>(defaultForm);

  function openCreate() {
    setEditingController(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEdit(c: ControllerRecord) {
    setEditingController(c);
    setForm({
      name: c.name,
      vendor: c.vendor,
      type: c.type,
      baseUrl: c.baseUrl,
      apiKeyEncryptedOrPlaceholder: c.apiKeyEncryptedOrPlaceholder ?? "",
      organizationIdOrTenant: c.organizationIdOrTenant ?? "",
      pollingEnabled: c.pollingEnabled,
      pollingIntervalSeconds: c.pollingIntervalSeconds,
    });
    setDialogOpen(true);
  }

  function handleSave() {
    if (editingController) {
      updateController.mutate(
        { id: editingController.id, data: form },
        {
          onSuccess: () => { toast({ title: "Controller updated" }); setDialogOpen(false); },
          onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
        }
      );
    } else {
      createController.mutate(form, {
        onSuccess: () => { toast({ title: "Controller created" }); setDialogOpen(false); },
        onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
      });
    }
  }

  function handleTest(id: string) {
    testConnection.mutate(id, {
      onSuccess: (r) => toast({ title: r.ok ? "Connection OK" : "Connection Failed", description: r.message, variant: r.ok ? "default" : "destructive" }),
      onError: (err: any) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
    });
  }

  function handleSync(id: string) {
    syncController.mutate(id, {
      onSuccess: () => toast({ title: "Sync started" }),
      onError: (err: any) => toast({ title: "Sync failed", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete(c: ControllerRecord) {
    deleteController.mutate(c.id, {
      onSuccess: () => { toast({ title: "Controller deleted" }); setDeleteTarget(null); },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <AppLayout title="Controllers">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Controllers</h2>
            <p className="text-muted-foreground text-sm mt-1">Cisco Meraki and Fortinet controller integrations</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Controller
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {["meraki", "fortinet"].map((v) => {
            const count = controllers?.filter((c) => c.vendor === v).length ?? 0;
            return (
              <Card key={v} className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground capitalize">{v} Controllers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{count}</div>
                </CardContent>
              </Card>
            );
          })}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Polling Enabled</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{controllers?.filter((c) => c.pollingEnabled).length ?? 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Controller</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Polling</TableHead>
                <TableHead>Last Poll</TableHead>
                <TableHead>Devices / Events</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : controllers?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <Server className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No controllers configured
                  </TableCell>
                </TableRow>
              ) : controllers?.map((c) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setLocation(`/controllers/${c.id}`)}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{vendorBadge(c.vendor)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground capitalize">{c.type.replace(/_/g, " ")}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {pollStatusIcon(c.lastPollStatus)}
                      <span className={`text-xs ${c.pollingEnabled ? "text-green-600" : "text-muted-foreground"}`}>
                        {c.pollingEnabled ? `Every ${c.pollingIntervalSeconds}s` : "Disabled"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.lastPolledAt
                      ? <span className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(c.lastPolledAt), { addSuffix: true })}</span>
                      : <span className="text-sm text-muted-foreground">Never</span>}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{c.deviceCount ?? 0} devices &middot; {c.eventCount ?? 0} events</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => handleTest(c.id)} disabled={testConnection.isPending}>
                        <Link2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleSync(c.id)} disabled={syncController.isPending}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(c)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingController ? "Edit Controller" : "Add Controller"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Meraki Dashboard — Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Vendor</Label>
                <Select value={form.vendor} onValueChange={(v) => setForm({ ...form, vendor: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="meraki">Cisco Meraki</SelectItem>
                    <SelectItem value="fortinet">Fortinet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="network_manager">Network Manager</SelectItem>
                    <SelectItem value="firewall_manager">Firewall Manager</SelectItem>
                    <SelectItem value="sdwan">SD-WAN</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Base URL</Label>
              <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder="https://api.meraki.com/api/v1" />
            </div>
            <div className="space-y-1">
              <Label>API Key</Label>
              <Input type="password" value={form.apiKeyEncryptedOrPlaceholder} onChange={(e) => setForm({ ...form, apiKeyEncryptedOrPlaceholder: e.target.value })} placeholder="Enter API key or leave as placeholder" />
            </div>
            <div className="space-y-1">
              <Label>Organization / Tenant ID (optional)</Label>
              <Input value={form.organizationIdOrTenant} onChange={(e) => setForm({ ...form, organizationIdOrTenant: e.target.value })} placeholder="org-id or tenant" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Polling Enabled</Label>
                <p className="text-xs text-muted-foreground">Auto-sync on schedule</p>
              </div>
              <Switch checked={form.pollingEnabled} onCheckedChange={(v) => setForm({ ...form, pollingEnabled: v })} />
            </div>
            {form.pollingEnabled && (
              <div className="space-y-1">
                <Label>Polling Interval (seconds)</Label>
                <Input type="number" value={form.pollingIntervalSeconds} onChange={(e) => setForm({ ...form, pollingIntervalSeconds: parseInt(e.target.value) || 300 })} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createController.isPending || updateController.isPending}>
              {editingController ? "Save Changes" : "Add Controller"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Controller?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deleteTarget?.name}" and all its devices, links, and events.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
