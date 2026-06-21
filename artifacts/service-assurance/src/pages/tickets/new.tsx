import { useLocation } from 'wouter';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';
import {
  useCreateTicket,
  getGetTicketsQueryKey,
  useGetCustomers,
  useGetSites,
  getGetSitesQueryKey,
  useGetServices,
  getGetServicesQueryKey,
  useGetUsers,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const SEVERITY_MATRIX: Record<string, Record<string, string>> = {
  high: { high: 'critical', medium: 'high', low: 'medium' },
  medium: { high: 'high', medium: 'medium', low: 'low' },
  low: { high: 'medium', medium: 'low', low: 'low' },
};

function deriveSeverity(impact?: string, urgency?: string): string | null {
  if (!impact || impact === '__none__' || !urgency || urgency === '__none__') return null;
  return SEVERITY_MATRIX[impact]?.[urgency] ?? null;
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-slate-100 text-slate-700 border-slate-200',
};

const formSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  siteId: z.string().optional(),
  serviceId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  source: z.enum(['manual', 'email', 'api']),
  impactLevel: z.string().optional(),
  urgencyLevel: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  outageType: z.enum(['outage', 'impairment', 'informational', 'unknown']),
  vendorTicketId: z.string().optional(),
  assignedToUserId: z.string().optional(),
});

export default function TicketNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateTicket();

  const { data: customers } = useGetCustomers({ status: 'active' });
  const { data: users } = useGetUsers();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: '',
      siteId: '__none__',
      serviceId: '__none__',
      title: '',
      description: '',
      source: 'manual',
      impactLevel: '__none__',
      urgencyLevel: '__none__',
      severity: 'medium',
      outageType: 'unknown',
      vendorTicketId: '',
      assignedToUserId: '__none__',
    },
  });

  const selectedCustomerId = form.watch('customerId');
  const selectedSiteId = form.watch('siteId');
  const impactLevel = useWatch({ control: form.control, name: 'impactLevel' });
  const urgencyLevel = useWatch({ control: form.control, name: 'urgencyLevel' });

  const derivedSeverity = deriveSeverity(impactLevel, urgencyLevel);

  useEffect(() => {
    if (derivedSeverity) {
      form.setValue('severity', derivedSeverity as 'low' | 'medium' | 'high' | 'critical');
    }
  }, [derivedSeverity, form]);

  const { data: sites } = useGetSites(
    { customerId: selectedCustomerId },
    { query: { queryKey: getGetSitesQueryKey({ customerId: selectedCustomerId }), enabled: !!selectedCustomerId } },
  );

  const { data: services } = useGetServices(
    {
      customerId: selectedCustomerId,
      siteId: selectedSiteId && selectedSiteId !== '__none__' ? selectedSiteId : undefined,
    },
    { query: { queryKey: getGetServicesQueryKey({ customerId: selectedCustomerId, siteId: selectedSiteId && selectedSiteId !== '__none__' ? selectedSiteId : undefined }), enabled: !!selectedCustomerId } },
  );

  function toNullable(val?: string): string | null {
    if (!val || val === '__none__') return null;
    return val;
  }

  function onSubmit(values: z.infer<typeof formSchema>) {
    const impact = toNullable(values.impactLevel);
    const urgency = toNullable(values.urgencyLevel);
    const computedSeverity = impact && urgency ? deriveSeverity(impact, urgency) : values.severity;

    createMutation.mutate(
      {
        data: {
          customerId: values.customerId,
          siteId: toNullable(values.siteId),
          serviceId: toNullable(values.serviceId),
          title: values.title,
          description: values.description || null,
          source: values.source,
          severity: (computedSeverity || values.severity) as 'low' | 'medium' | 'high' | 'critical',
          status: 'new',
          outageType: values.outageType,
          impactLevel: impact as 'low' | 'medium' | 'high' | null,
          urgencyLevel: urgency as 'low' | 'medium' | 'high' | null,
          vendorTicketId: values.vendorTicketId || null,
          assignedToUserId: toNullable(values.assignedToUserId),
        },
      },
      {
        onSuccess: (ticket) => {
          toast({ title: 'Ticket created successfully' });
          queryClient.invalidateQueries({ queryKey: getGetTicketsQueryKey() });
          setLocation(`/tickets/${ticket.id}`);
        },
        onError: (err: any) => {
          toast({
            title: 'Error creating ticket',
            description: err.response?.data?.message || err.message,
            variant: 'destructive',
          });
        },
      },
    );
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
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the issue" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a customer" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers?.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="siteId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedCustomerId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a site (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {sites?.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.siteName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="serviceId"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Service / Circuit</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedCustomerId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a service (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {services?.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.vendorName} - {s.serviceType}{' '}
                                {s.circuitId ? `(${s.circuitId})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* ITIL Classification */}
                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-muted-foreground">Classification</h3>
                    {derivedSeverity && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>ITIL-derived severity:</span>
                        <span
                          className={cn(
                            'px-2 py-0.5 rounded border font-semibold uppercase text-xs',
                            SEVERITY_COLOR[derivedSeverity],
                          )}
                        >
                          {derivedSeverity}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <FormField
                      control={form.control}
                      name="impactLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Impact Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="ticket-impact-select">
                                <SelectValue placeholder="Optional" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Not set</SelectItem>
                              <SelectItem value="low">
                                Low — limited scope, few users affected
                              </SelectItem>
                              <SelectItem value="medium">
                                Medium — significant degradation
                              </SelectItem>
                              <SelectItem value="high">
                                High — complete service loss / many users
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="urgencyLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Urgency Level</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="ticket-urgency-select">
                                <SelectValue placeholder="Optional" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Not set</SelectItem>
                              <SelectItem value="low">Low — can tolerate delay</SelectItem>
                              <SelectItem value="medium">
                                Medium — needs timely resolution
                              </SelectItem>
                              <SelectItem value="high">
                                High — business critical, resolve immediately
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            Severity
                            {derivedSeverity && (
                              <span className="ml-1 text-xs text-muted-foreground">
                                (auto-derived)
                              </span>
                            )}
                          </FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value}
                            disabled={!!derivedSeverity}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="ticket-severity-select">
                                <SelectValue />
                              </SelectTrigger>
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
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="outageType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Outage Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="outage">Outage</SelectItem>
                              <SelectItem value="impairment">Impairment</SelectItem>
                              <SelectItem value="informational">Informational</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="source"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Source</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="manual">Manual</SelectItem>
                              <SelectItem value="email">Email</SelectItem>
                              <SelectItem value="api">API</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground">
                    Assignments & Reference
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="assignedToUserId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assign To</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="__none__">Unassigned</SelectItem>
                              {users
                                ?.filter((u) => u.role !== 'customer')
                                .map((u) => (
                                  <SelectItem key={u.id} value={u.id}>
                                    {u.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="vendorTicketId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vendor Ticket ID</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. INC00123" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-[120px]"
                            placeholder="Detailed description of the issue..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setLocation('/tickets')}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="ticket-submit-btn"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Ticket'}
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
