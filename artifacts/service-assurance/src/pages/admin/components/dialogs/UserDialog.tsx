import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateUser,
  useGetCustomers,
  useUpdateUser,
  getGetUsersQueryKey,
} from '@workspace/api-client-react';
import { usePartners } from '@/pages/admin/hooks/useAdminPartners';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

const userFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .optional()
    .or(z.literal('')),
  role: z.enum(['admin', 'ops', 'customer', 'telecom_services_partner']),
  customerId: z.string().optional(),
  telecomServicesPartnerId: z.string().optional(),
});

type UserFormData = z.infer<typeof userFormSchema>;

export function UserDialog({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const { data: customers } = useGetCustomers();
  const { data: partners } = usePartners();
  const isEdit = !!user;

  const form = useForm<UserFormData>({
    resolver: zodResolver(
      isEdit
        ? userFormSchema.extend({ password: z.string().optional().or(z.literal('')) })
        : userFormSchema.extend({
            password: z.string().min(6, 'Password must be at least 6 characters'),
          }),
    ),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'ops',
      customerId: '__none__',
      telecomServicesPartnerId: '__none__',
    },
  });

  const watchedRole = form.watch('role');

  useEffect(() => {
    if (!open) return;
    if (user) {
      form.reset({
        name: user.name,
        email: user.email,
        password: '',
        role: user.role,
        customerId: (user as any).customerId || '__none__',
        telecomServicesPartnerId: (user as any).telecomServicesPartnerId || '__none__',
      });
    } else {
      form.reset({
        name: '',
        email: '',
        password: '',
        role: 'ops',
        customerId: '__none__',
        telecomServicesPartnerId: '__none__',
      });
    }
  }, [open, user, form]);

  function onSubmit(values: UserFormData) {
    const custId = values.customerId && values.customerId !== '__none__' ? values.customerId : null;
    const tspId =
      values.telecomServicesPartnerId && values.telecomServicesPartnerId !== '__none__'
        ? values.telecomServicesPartnerId
        : null;

    if (isEdit && user) {
      const data: any = {
        name: values.name,
        email: values.email,
        role: values.role,
        customerId: values.role === 'customer' ? custId : null,
        telecomServicesPartnerId: values.role === 'telecom_services_partner' ? tspId : null,
      };
      if (values.password) data.password = values.password;

      updateMutation.mutate(
        { id: user.id, data },
        {
          onSuccess: () => {
            toast({ title: 'User updated' });
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
            onOpenChange(false);
          },
          onError: (err: any) => {
            toast({
              title: 'Error updating user',
              description: err.message,
              variant: 'destructive',
            });
          },
        },
      );
    } else {
      createMutation.mutate(
        {
          name: values.name,
          email: values.email,
          password: values.password || '',
          role: values.role,
          customerId: values.role === 'customer' ? custId : null,
          telecomServicesPartnerId: values.role === 'telecom_services_partner' ? tspId : null,
        },
        {
          onSuccess: () => {
            toast({ title: 'User created' });
            queryClient.invalidateQueries({ queryKey: getGetUsersQueryKey() });
            onOpenChange(false);
          },
          onError: (err: any) => {
            toast({
              title: 'Error creating user',
              description: err.message,
              variant: 'destructive',
            });
          },
        },
      );
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]" data-testid="user-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit User' : 'Create User'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl>
                    <Input data-testid="user-name-input" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" data-testid="user-email-input" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isEdit ? 'Password (leave blank to keep current)' : 'Password *'}
                  </FormLabel>
                  <FormControl>
                    <Input type="password" data-testid="user-password-input" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="user-role-select">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="ops">Ops</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="telecom_services_partner">
                        Telecom Services Partner
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {watchedRole === 'customer' && (
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Account</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {customers?.map((c: any) => (
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
            )}

            {watchedRole === 'telecom_services_partner' && (
              <FormField
                control={form.control}
                name="telecomServicesPartnerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Partner Organisation</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select partner" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {partners?.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.companyName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="user-submit-btn">
                {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
