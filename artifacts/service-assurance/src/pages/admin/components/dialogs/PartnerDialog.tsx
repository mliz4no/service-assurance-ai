import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreatePartner, useUpdatePartner } from '@/pages/admin/hooks/useAdminPartners';
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
import { Textarea } from '@/components/ui/textarea';
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

const partnerFormSchema = z.object({
  name: z.string().min(1, 'Contact name required'),
  companyName: z.string().min(1, 'Company name required'),
  email: z.string().email('Invalid email'),
  phone: z.string().optional(),
  status: z.enum(['active', 'inactive']),
  notes: z.string().optional(),
});

type PartnerFormData = z.infer<typeof partnerFormSchema>;

export function PartnerDialog({
  open,
  onOpenChange,
  partner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: any | null;
}) {
  const { toast } = useToast();
  const createMutation = useCreatePartner();
  const updateMutation = useUpdatePartner();
  const isEdit = !!partner;

  const form = useForm<PartnerFormData>({
    resolver: zodResolver(partnerFormSchema),
    defaultValues: { name: '', companyName: '', email: '', phone: '', status: 'active', notes: '' },
  });

  useEffect(() => {
    if (!open) return;
    if (partner) {
      form.reset({
        name: partner.name,
        companyName: partner.companyName,
        email: partner.email,
        phone: partner.phone || '',
        status: partner.status,
        notes: partner.notes || '',
      });
    } else {
      form.reset({ name: '', companyName: '', email: '', phone: '', status: 'active', notes: '' });
    }
  }, [open, partner, form]);

  function onSubmit(values: PartnerFormData) {
    const payload = { ...values, phone: values.phone || null, notes: values.notes || null };
    if (isEdit) {
      updateMutation.mutate(
        { id: partner.id, data: payload },
        {
          onSuccess: () => {
            toast({ title: 'Partner updated' });
            onOpenChange(false);
          },
          onError: (err: any) =>
            toast({ title: 'Error', description: err.message, variant: 'destructive' }),
        },
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          toast({ title: 'Partner created' });
          onOpenChange(false);
        },
        onError: (err: any) =>
          toast({ title: 'Error', description: err.message, variant: 'destructive' }),
      });
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Partner' : 'New Partner'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact *</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Partner'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
