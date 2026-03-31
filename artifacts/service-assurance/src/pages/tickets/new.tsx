import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useCreateTicket, 
  getGetTicketsQueryKey, 
  useGetCustomers, 
  useGetSites, 
  useGetServices,
  useGetUsers
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  siteId: z.string().optional(),
  serviceId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  source: z.enum(["manual", "email", "api"]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  status: z.enum(["new", "investigating", "vendor_engaged", "dispatch_scheduled", "monitoring", "resolved", "closed"]),
  outageType: z.enum(["outage", "impairment", "informational", "unknown"]),
  vendorTicketId: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

export default function TicketNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateTicket();
  
  const { data: customers } = useGetCustomers({ status: "active" });
  const { data: users } = useGetUsers();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: "",
      siteId: "__none__",
      serviceId: "__none__",
      title: "",
      description: "",
      source: "manual",
      severity: "medium",
      status: "new",
      outageType: "unknown",
      vendorTicketId: "",
      assignedToUserId: "__none__",
    },
  });

  const selectedCustomerId = form.watch("customerId");
  const selectedSiteId = form.watch("siteId");

  const { data: sites } = useGetSites({ customerId: selectedCustomerId }, {
    query: { enabled: !!selectedCustomerId }
  });

  const { data: services } = useGetServices({ 
    customerId: selectedCustomerId,
    siteId: (selectedSiteId && selectedSiteId !== "__none__") ? selectedSiteId : undefined
  }, {
    query: { enabled: !!selectedCustomerId }
  });

  function toNullable(val?: string): string | null {
    if (!val || val === "__none__") return null;
    return val;
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate({ data: {
      customerId: values.customerId,
      siteId: toNullable(values.siteId),
      serviceId: toNullable(values.serviceId),
      title: values.title,
      description: values.description || null,
      source: values.source,
      severity: values.severity,
      status: values.status,
      outageType: values.outageType,
      vendorTicketId: values.vendorTicketId || null,
      assignedToUserId: toNullable(values.assignedToUserId),
    } }, {
      onSuccess: (ticket) => {
        toast({ title: "Ticket created successfully" });
        queryClient.invalidateQueries({ queryKey: getGetTicketsQueryKey() });
        setLocation(`/tickets/${ticket.id}`);
      },
      onError: (err: any) => {
        toast({ title: "Error creating ticket", description: err.response?.data?.message || err.message, variant: "destructive" });
      }
    });
  }

  return (
    <AppLayout title="New Ticket">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Open Support Ticket</h2>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Ticket Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="title" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Title *</FormLabel>
                      <FormControl><Input placeholder="Brief description of the issue" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="customerId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {customers?.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="siteId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCustomerId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a site (optional)" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {sites?.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.siteName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <FormField control={form.control} name="serviceId" render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Service / Circuit</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCustomerId}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a service (optional)" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {services?.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.vendorName} - {s.serviceType} {s.circuitId ? `(${s.circuitId})` : ""}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Classification</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="severity" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Severity</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
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
                    <FormField control={form.control} name="outageType" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Outage Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="outage">Outage</SelectItem>
                            <SelectItem value="impairment">Impairment</SelectItem>
                            <SelectItem value="informational">Informational</SelectItem>
                            <SelectItem value="unknown">Unknown</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="source" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="manual">Manual</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="api">API</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Assignments & Reference</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="assignedToUserId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign To</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Unassigned</SelectItem>
                            {users?.filter(u => u.role !== 'customer').map(u => (
                              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="vendorTicketId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Ticket ID</FormLabel>
                        <FormControl><Input placeholder="e.g. INC00123" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea className="min-h-[120px]" placeholder="Detailed description of the issue..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setLocation("/tickets")}>Cancel</Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "Creating..." : "Create Ticket"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
