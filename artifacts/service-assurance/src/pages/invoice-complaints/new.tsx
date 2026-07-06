import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { useGetCustomers } from '@workspace/api-client-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useCreateInvoiceComplaint } from './hooks';

const schema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  complaintType: z.enum([
    'tax_mismatch',
    'rate_mismatch',
    'duplicate_charge',
    'missing_exemption',
    'other',
  ]),
  priority: z.enum(['low', 'medium', 'high']),
  invoiceNumber: z.string().min(1, 'Invoice number is required'),
  customerAccountNumber: z.string().min(1, 'Customer account number is required'),
  companyCode: z.string().optional(),
  documentCode: z.string().optional(),
});

export default function NewInvoiceComplaint() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: customers } = useGetCustomers({ status: 'active' });
  const create = useCreateInvoiceComplaint();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      customerId: '',
      title: '',
      description: '',
      complaintType: 'tax_mismatch',
      priority: 'medium',
      invoiceNumber: '',
      customerAccountNumber: '',
      companyCode: '',
      documentCode: '',
    },
  });

  function onSubmit(values: z.infer<typeof schema>) {
    create.mutate(values, {
      onSuccess: (created) => {
        toast({ title: 'Invoice complaint created' });
        setLocation(`/invoice-complaints/${created.id}`);
      },
      onError: (error: any) => {
        toast({
          title: 'Failed to create complaint',
          description: error.message,
          variant: 'destructive',
        });
      },
    });
  }

  return (
    <AppLayout title="New Invoice Complaint">
      <div className="max-w-4xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Open Invoice Complaint</h2>

        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Complaint Details</CardTitle>
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
                          <Input placeholder="Short complaint summary" {...field} />
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select customer" />
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
                    name="complaintType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="tax_mismatch">Tax mismatch</SelectItem>
                            <SelectItem value="rate_mismatch">Rate mismatch</SelectItem>
                            <SelectItem value="duplicate_charge">Duplicate charge</SelectItem>
                            <SelectItem value="missing_exemption">Missing exemption</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="INV-2026-0001" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerAccountNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Account Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="ACC-44912" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="companyCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avalara Company Code</FormLabel>
                        <FormControl>
                          <Input placeholder="DEFAULT" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="documentCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avalara Document Code</FormLabel>
                        <FormControl>
                          <Input placeholder="Optional override" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea rows={5} placeholder="Explain what is wrong on the invoice" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setLocation('/invoice-complaints')}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={create.isPending}>
                    {create.isPending ? 'Creating...' : 'Create Complaint'}
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
