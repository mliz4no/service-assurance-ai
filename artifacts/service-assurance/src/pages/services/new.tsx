import { useLocation } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCreateService,
  getGetServicesQueryKey,
  useGetCustomers,
  useGetSites,
  getGetSitesQueryKey,
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

const formSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  siteId: z.string().min(1, 'Site is required'),
  vendorName: z.string().min(1, 'Vendor name is required'),
  serviceType: z.enum(['DIA', 'Broadband', 'SD-WAN', 'Voice', 'Wireless', 'Other']),
  circuitId: z.string().optional(),
  bandwidth: z.string().optional(),
  status: z.enum(['active', 'pending', 'down', 'impaired', 'disconnected']),
  installDate: z.string().optional(),
  monthlyRecurringCharge: z.string().optional(), // Coerce to number later
  supportReference: z.string().optional(),
  notes: z.string().optional(),
});

export default function ServiceNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateService();
  const { data: customers } = useGetCustomers({ status: 'active' });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: '',
      siteId: '',
      vendorName: '',
      serviceType: 'DIA',
      circuitId: '',
      bandwidth: '',
      status: 'pending',
      installDate: '',
      monthlyRecurringCharge: '',
      supportReference: '',
      notes: '',
    },
  });

  const selectedCustomerId = form.watch('customerId');
  const { data: sites } = useGetSites(
    { customerId: selectedCustomerId },
    { query: { queryKey: getGetSitesQueryKey({ customerId: selectedCustomerId }), enabled: !!selectedCustomerId } },
  );

  function onSubmit(values: z.infer<typeof formSchema>) {
    createMutation.mutate(
      {
        data: {
          customerId: values.customerId,
          siteId: values.siteId,
          vendorName: values.vendorName,
          serviceType: values.serviceType,
          circuitId: values.circuitId || null,
          bandwidth: values.bandwidth || null,
          status: values.status,
          installDate: values.installDate ? new Date(values.installDate).toISOString() : null,
          monthlyRecurringCharge: values.monthlyRecurringCharge
            ? Number(values.monthlyRecurringCharge)
            : null,
          supportReference: values.supportReference || null,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: (service) => {
          toast({ title: 'Service created successfully' });
          queryClient.invalidateQueries({ queryKey: getGetServicesQueryKey() });
          setLocation(`/services/${service.id}`);
        },
        onError: (err: any) => {
          toast({
            title: 'Error creating service',
            description: err.response?.data?.message || err.message,
            variant: 'destructive',
          });
        },
      },
    );
  }

  return (
    <AppLayout title="New Service">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Provision Service</h2>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Service Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        <FormLabel>Site *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={!selectedCustomerId}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a site" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                    name="serviceType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Service Type *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="DIA">DIA</SelectItem>
                            <SelectItem value="Broadband">Broadband</SelectItem>
                            <SelectItem value="SD-WAN">SD-WAN</SelectItem>
                            <SelectItem value="Voice">Voice</SelectItem>
                            <SelectItem value="Wireless">Wireless</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vendorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. AT&T, Lumen" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground">
                    Circuit Attributes
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="circuitId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Circuit ID</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="down">Down</SelectItem>
                              <SelectItem value="impaired">Impaired</SelectItem>
                              <SelectItem value="disconnected">Disconnected</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bandwidth"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bandwidth</FormLabel>
                          <FormControl>
                            <Input placeholder="100Mbps" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="monthlyRecurringCharge"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>MRC ($)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="installDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Install Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="supportReference"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Support Reference / Phone</FormLabel>
                          <FormControl>
                            <Input {...field} />
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
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setLocation('/services')}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Provisioning...' : 'Provision Service'}
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
