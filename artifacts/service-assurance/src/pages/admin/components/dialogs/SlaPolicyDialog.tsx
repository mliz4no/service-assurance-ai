import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateSlaPolicy,
  useUpdateSlaPolicy,
  getGetSlaPoliciesQueryKey,
  type SlaPolicy,
} from '@workspace/api-client-react';
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

const slaPolicySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  initialResponseMinutes: z.coerce.number().int().min(1, 'Must be at least 1 minute'),
  escalationMinutes: z.coerce.number().int().min(1, 'Must be at least 1 minute'),
  resolutionTargetMinutes: z.coerce.number().int().min(1, 'Must be at least 1 minute'),
  isDefault: z.boolean(),
});

type SlaPolicyForm = z.infer<typeof slaPolicySchema>;

export function SlaPolicyDialog({
  open,
  onOpenChange,
  policy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  policy?: SlaPolicy | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateSlaPolicy();
  const updateMutation = useUpdateSlaPolicy();
  const isEdit = !!policy;

  const form = useForm<SlaPolicyForm>({
    resolver: zodResolver(slaPolicySchema),
    defaultValues: {
      name: '',
      severity: 'medium',
      initialResponseMinutes: 60,
      escalationMinutes: 240,
      resolutionTargetMinutes: 480,
      isDefault: false,
    },
  });

  useEffect(() => {
    if (!open) return;
    if (policy) {
      form.reset({
        name: policy.name,
        severity: policy.severity as SlaPolicyForm['severity'],
        initialResponseMinutes: policy.initialResponseMinutes,
        escalationMinutes: policy.escalationMinutes,
        resolutionTargetMinutes: policy.resolutionTargetMinutes,
        isDefault: policy.isDefault ?? false,
      });
    } else {
      form.reset({
        name: '',
        severity: 'medium',
        initialResponseMinutes: 60,
        escalationMinutes: 240,
        resolutionTargetMinutes: 480,
        isDefault: false,
      });
    }
  }, [open, policy, form]);

  function onSubmit(values: SlaPolicyForm) {
    const data = {
      name: values.name,
      severity: values.severity as any,
      initialResponseMinutes: values.initialResponseMinutes,
      escalationMinutes: values.escalationMinutes,
      resolutionTargetMinutes: values.resolutionTargetMinutes,
      isDefault: values.isDefault,
    };

    if (isEdit && policy) {
      updateMutation.mutate(
        { id: policy.id, data },
        {
          onSuccess: () => {
            toast({ title: 'SLA policy updated' });
            queryClient.invalidateQueries({ queryKey: getGetSlaPoliciesQueryKey() });
            onOpenChange(false);
          },
          onError: (err: any) => {
            toast({
              title: 'Error updating SLA policy',
              description: err.message,
              variant: 'destructive',
            });
          },
        },
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            toast({ title: 'SLA policy created' });
            queryClient.invalidateQueries({ queryKey: getGetSlaPoliciesQueryKey() });
            onOpenChange(false);
          },
          onError: (err: any) => {
            toast({
              title: 'Error creating SLA policy',
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
      <DialogContent className="sm:max-w-[500px]" data-testid="sla-policy-dialog">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit SLA Policy' : 'Create SLA Policy'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input data-testid="sla-name-input" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="sla-severity-select">
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

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="initialResponseMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Initial Response (min)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="escalationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Escalation (min)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="resolutionTargetMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resolution Target (min)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isDefault"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 space-y-0 pt-1">
                  <FormControl>
                    <input
                      type="checkbox"
                      checked={field.value}
                      onChange={field.onChange}
                      className="w-4 h-4 rounded border-input accent-primary"
                      data-testid="sla-default-checkbox"
                    />
                  </FormControl>
                  <FormLabel className="font-normal cursor-pointer">
                    Set as default policy for this severity
                  </FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="sla-submit-btn">
                {isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Policy'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
