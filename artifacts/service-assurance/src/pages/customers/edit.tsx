import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateCustomer, useGetCustomer, getGetCustomerQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useRef } from "react";
import { Activity } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  accountNumber: z.string().optional(),
  status: z.enum(["active", "inactive"]),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  primaryContactPhone: z.string().optional(),
  notes: z.string().optional(),
});

export default function CustomerEdit() {
  const params = useParams();
  const id = params.id as string;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: customer, isLoading } = useGetCustomer(id, {
    query: { enabled: !!id, queryKey: getGetCustomerQueryKey(id) }
  });
  const updateMutation = useUpdateCustomer();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      accountNumber: "",
      status: "active",
      primaryContactName: "",
      primaryContactEmail: "",
      primaryContactPhone: "",
      notes: "",
    },
  });

  const initializedForId = useRef<string | null>(null);

  useEffect(() => {
    if (customer && initializedForId.current !== id) {
      initializedForId.current = id;
      form.reset({
        name: customer.name,
        accountNumber: customer.accountNumber || "",
        status: customer.status as "active" | "inactive",
        primaryContactName: customer.primaryContactName || "",
        primaryContactEmail: customer.primaryContactEmail || "",
        primaryContactPhone: customer.primaryContactPhone || "",
        notes: customer.notes || "",
      });
    }
  }, [customer, id, form]);

  function onSubmit(values: z.infer<typeof formSchema>) {
    updateMutation.mutate({ 
      id,
      data: {
        name: values.name,
        accountNumber: values.accountNumber || null,
        status: values.status,
        primaryContactName: values.primaryContactName || null,
        primaryContactEmail: values.primaryContactEmail || null,
        primaryContactPhone: values.primaryContactPhone || null,
        notes: values.notes || null,
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Customer updated successfully" });
        queryClient.invalidateQueries({ queryKey: getGetCustomerQueryKey(id) });
        setLocation(`/customers/${id}`);
      },
      onError: (err: any) => {
        toast({ title: "Error updating customer", description: err.response?.data?.message || err.message, variant: "destructive" });
      }
    });
  }

  if (isLoading) {
    return (
      <AppLayout title="Edit Customer">
        <div className="flex justify-center py-12"><Activity className="w-8 h-8 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Edit ${customer?.name}`}>
      <div className="max-w-3xl mx-auto space-y-6">
        <Card className="shadow-sm border-border/50">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Customer Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="accountNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Account Number</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="pt-4 border-t border-border/50">
                  <h3 className="text-sm font-semibold mb-4 text-muted-foreground">Primary Contact</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="primaryContactName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="primaryContactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="primaryContactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </div>

                <div className="pt-4 border-t border-border/50">
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl><Textarea className="min-h-[100px]" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setLocation(`/customers/${id}`)}>Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Saving..." : "Save Changes"}
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
