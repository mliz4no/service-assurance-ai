import { useParams, useLocation } from "wouter";
import { AppLayout } from "@/components/layout/app-layout";
import { useGetCustomer, useGetCustomerContacts, useCreateCustomerContact, useUpdateCustomerContact, useDeleteCustomerContact, getGetCustomerContactsQueryKey } from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, Edit, Building2, MapPin, Globe2, Ticket, Mail, Phone, Users, Plus, Trash2, Pencil, Bell } from "lucide-react";
import { EscalationMatrixEditor } from "@/components/EscalationMatrixEditor";
import { Link } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { CustomerContact } from "@workspace/api-client-react";

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

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  role: string;
  notifyOnSeverity: string;
  notifyOnDurationMinutes: string;
}

const BLANK_FORM: ContactFormData = {
  name: "",
  email: "",
  phone: "",
  role: "noc",
  notifyOnSeverity: "high",
  notifyOnDurationMinutes: "",
};

function ContactForm({
  initial,
  onSave,
  onCancel,
  isSaving,
}: {
  initial: ContactFormData;
  onSave: (data: ContactFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<ContactFormData>(initial);
  const set = (k: keyof ContactFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-muted/30 rounded-lg border border-border/50">
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Name *</label>
        <Input value={form.name} onChange={set("name")} placeholder="Full name" data-testid="contact-name-input" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Email *</label>
        <Input type="email" value={form.email} onChange={set("email")} placeholder="email@company.com" data-testid="contact-email-input" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
        <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="+1 555-000-0000" data-testid="contact-phone-input" />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Role *</label>
        <Select value={form.role} onValueChange={(v) => setForm(f => ({ ...f, role: v }))}>
          <SelectTrigger data-testid="contact-role-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="noc">NOC</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="director">Director</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Notify at severity</label>
        <Select value={form.notifyOnSeverity} onValueChange={(v) => setForm(f => ({ ...f, notifyOnSeverity: v }))}>
          <SelectTrigger data-testid="contact-severity-select"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="low">Low and above</SelectItem>
            <SelectItem value="medium">Medium and above</SelectItem>
            <SelectItem value="high">High and above</SelectItem>
            <SelectItem value="critical">Critical only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Escalate after (minutes)</label>
        <Input
          type="number"
          min="0"
          value={form.notifyOnDurationMinutes}
          onChange={set("notifyOnDurationMinutes")}
          placeholder="e.g. 30"
          data-testid="contact-duration-input"
        />
      </div>
      <div className="md:col-span-3 flex gap-2 justify-end pt-1">
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={isSaving || !form.name || !form.email} data-testid="contact-save-btn">
          {isSaving ? "Saving..." : "Save Contact"}
        </Button>
      </div>
    </div>
  );
}

function ContactsTab({ customerId }: { customerId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useGetCustomerContacts(customerId);
  const createMutation = useCreateCustomerContact(customerId);
  const updateMutation = useUpdateCustomerContact(customerId);
  const deleteMutation = useDeleteCustomerContact(customerId);

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleCreate(data: ContactFormData) {
    createMutation.mutate({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        role: data.role as "noc" | "manager" | "director" | "executive",
        notifyOnSeverity: data.notifyOnSeverity as "low" | "medium" | "high" | "critical",
        notifyOnDurationMinutes: data.notifyOnDurationMinutes ? parseInt(data.notifyOnDurationMinutes) : null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Contact added" });
        setShowAdd(false);
        queryClient.invalidateQueries({ queryKey: getGetCustomerContactsQueryKey(customerId) });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  }

  function handleUpdate(contact: CustomerContact, data: ContactFormData) {
    updateMutation.mutate({
      contactId: contact.id,
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        role: data.role as "noc" | "manager" | "director" | "executive",
        notifyOnSeverity: data.notifyOnSeverity as "low" | "medium" | "high" | "critical",
        notifyOnDurationMinutes: data.notifyOnDurationMinutes ? parseInt(data.notifyOnDurationMinutes) : null,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Contact updated" });
        setEditingId(null);
        queryClient.invalidateQueries({ queryKey: getGetCustomerContactsQueryKey(customerId) });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  }

  function handleDelete(contactId: string) {
    deleteMutation.mutate({ contactId }, {
      onSuccess: () => {
        toast({ title: "Contact removed" });
        queryClient.invalidateQueries({ queryKey: getGetCustomerContactsQueryKey(customerId) });
      },
      onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
    });
  }

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Customer Escalation Contacts</CardTitle>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} disabled={showAdd} data-testid="add-contact-btn">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Contact
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">Customer contacts are automatically notified when ticket severity and/or open duration thresholds are met. Distinct from vendor escalation.</p>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {showAdd && (
          <ContactForm
            initial={BLANK_FORM}
            onSave={handleCreate}
            onCancel={() => setShowAdd(false)}
            isSaving={createMutation.isPending}
          />
        )}
        {isLoading ? (
          <div className="py-4 text-center text-sm text-muted-foreground">Loading contacts...</div>
        ) : !contacts?.length && !showAdd ? (
          <div className="py-6 text-center text-sm text-muted-foreground italic" data-testid="contacts-empty">
            No escalation contacts configured.
          </div>
        ) : (
          contacts?.map((contact) => (
            editingId === contact.id ? (
              <ContactForm
                key={contact.id}
                initial={{
                  name: contact.name,
                  email: contact.email,
                  phone: contact.phone ?? "",
                  role: contact.role,
                  notifyOnSeverity: contact.notifyOnSeverity,
                  notifyOnDurationMinutes: contact.notifyOnDurationMinutes?.toString() ?? "",
                }}
                onSave={(data) => handleUpdate(contact, data)}
                onCancel={() => setEditingId(null)}
                isSaving={updateMutation.isPending}
              />
            ) : (
              <div key={contact.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-colors" data-testid="contact-row">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{contact.name}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium capitalize", ROLE_BADGE[contact.role] ?? "bg-slate-100 text-slate-700")}>
                        {contact.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <a href={`mailto:${contact.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                        <Mail className="w-3 h-3" />{contact.email}
                      </a>
                      {contact.phone && (
                        <a href={`tel:${contact.phone}`} className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
                          <Phone className="w-3 h-3" />{contact.phone}
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
                      <Bell className="w-3 h-3" />
                      <span>Notify at</span>
                      <span className={cn("px-1.5 py-0.5 rounded font-semibold uppercase", SEVERITY_BADGE[contact.notifyOnSeverity] ?? "bg-slate-100")}>
                        {contact.notifyOnSeverity}
                      </span>
                    </div>
                    {contact.notifyOnDurationMinutes && (
                      <div className="text-xs text-muted-foreground">
                        + after {contact.notifyOnDurationMinutes}m
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(contact.id)} data-testid="edit-contact-btn">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(contact.id)} data-testid="delete-contact-btn">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            )
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function CustomerDetail() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useLocation();

  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { enabled: !!id }
  });

  if (isLoading) {
    return (
      <AppLayout title="Loading Customer...">
        <div className="flex justify-center py-12"><Activity className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  if (!customer) {
    return (
      <AppLayout title="Customer Not Found">
        <div className="text-center py-12 text-muted-foreground">Customer not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={customer.name}>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                {customer.name}
                <StatusBadge status={customer.status} />
              </h1>
              <p className="text-muted-foreground">Account #: {customer.accountNumber || "N/A"}</p>
            </div>
          </div>
          <Button onClick={() => setLocation(`/customers/${id}/edit`)} variant="outline">
            <Edit className="w-4 h-4 mr-2" /> Edit Customer
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contact Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Primary Contact</p>
                <p className="font-medium">{customer.primaryContactName || "Not set"}</p>
              </div>
              {customer.primaryContactEmail && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${customer.primaryContactEmail}`} className="text-primary hover:underline">{customer.primaryContactEmail}</a>
                </div>
              )}
              {customer.primaryContactPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{customer.primaryContactPhone}</span>
                </div>
              )}
              {customer.notes && (
                <div className="pt-4 border-t border-border/50">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{customer.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="col-span-1 md:col-span-2">
            <Tabs defaultValue="sites" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="sites"><MapPin className="w-4 h-4 mr-1.5"/> Sites ({customer.sites?.length || 0})</TabsTrigger>
                <TabsTrigger value="services"><Globe2 className="w-4 h-4 mr-1.5"/> Services ({customer.services?.length || 0})</TabsTrigger>
                <TabsTrigger value="tickets"><Ticket className="w-4 h-4 mr-1.5"/> Tickets ({customer.tickets?.length || 0})</TabsTrigger>
                <TabsTrigger value="contacts" data-testid="contacts-tab"><Users className="w-4 h-4 mr-1.5"/> Contacts</TabsTrigger>
              </TabsList>

              <TabsContent value="sites" className="mt-4">
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-0">
                    {!customer.sites?.length ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No sites configured.</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {customer.sites.map(s => (
                          <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                            <div>
                              <Link href={`/sites/${s.id}`} className="font-medium text-primary hover:underline">{s.siteName}</Link>
                              <div className="text-sm text-muted-foreground">{s.city}, {s.state}</div>
                            </div>
                            <div className="text-sm text-muted-foreground">{s.siteCode}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="mt-4">
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-0">
                    {!customer.services?.length ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No services provisioned.</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {customer.services.map(s => (
                          <div key={s.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                            <div>
                              <Link href={`/services/${s.id}`} className="font-medium text-primary hover:underline">{s.serviceType}</Link>
                              <div className="text-sm text-muted-foreground">Circuit: {s.circuitId || "N/A"}</div>
                            </div>
                            <StatusBadge status={s.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="tickets" className="mt-4">
                <Card className="border-border/50 shadow-sm">
                  <CardContent className="p-0">
                    {!customer.tickets?.length ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No recent tickets.</div>
                    ) : (
                      <div className="divide-y divide-border/50">
                        {customer.tickets.map(t => (
                          <div key={t.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                            <div>
                              <Link href={`/tickets/${t.id}`} className="font-medium text-primary hover:underline">{t.ticketNumber} - {t.title}</Link>
                              <div className="text-sm text-muted-foreground">{new Date(t.openedAt).toLocaleDateString()}</div>
                            </div>
                            <StatusBadge status={t.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="contacts" className="mt-4 space-y-4">
                <ContactsTab customerId={id} />
                <EscalationMatrixEditor
                  scopeType="customer"
                  scopeId={id}
                  scopeLabel="Customer Severity Matrix Override"
                  defaultExpanded={false}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
