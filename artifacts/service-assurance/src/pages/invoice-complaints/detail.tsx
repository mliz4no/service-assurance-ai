import { useState } from 'react';
import { useRoute } from 'wouter';
import { Activity, RefreshCw, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  useAddInvoiceComplaintNote,
  useInvoiceComplaint,
  usePatchInvoiceComplaint,
  useValidateInvoiceComplaint,
} from './hooks';

export default function InvoiceComplaintDetail() {
  const [, params] = useRoute<{ id: string }>('/invoice-complaints/:id');
  const id = params ? params.id : '';
  const { toast } = useToast();
  const { data, isLoading } = useInvoiceComplaint(id);
  const patch = usePatchInvoiceComplaint(id);
  const validate = useValidateInvoiceComplaint(id);
  const addNote = useAddInvoiceComplaintNote(id);

  const [status, setStatus] = useState<string>('');
  const [note, setNote] = useState('');

  if (isLoading) {
    return (
      <AppLayout title="Invoice Complaint">
        <div className="h-64 flex items-center justify-center">
          <Activity className="w-7 h-7 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!data) {
    return (
      <AppLayout title="Invoice Complaint">
        <div className="text-muted-foreground">Complaint not found.</div>
      </AppLayout>
    );
  }

  const effectiveStatus = status || data.status;

  function saveStatus() {
    patch.mutate(
      { status: effectiveStatus },
      {
        onSuccess: () => toast({ title: 'Status updated' }),
        onError: (error: any) =>
          toast({ title: 'Failed to update', description: error.message, variant: 'destructive' }),
      },
    );
  }

  function runValidation() {
    validate.mutate(undefined, {
      onSuccess: () => toast({ title: 'Avalara validation complete' }),
      onError: (error: any) =>
        toast({
          title: 'Validation failed',
          description: error.message,
          variant: 'destructive',
        }),
    });
  }

  function submitNote() {
    if (!note.trim()) return;
    addNote.mutate(note.trim(), {
      onSuccess: () => {
        setNote('');
        toast({ title: 'Note added' });
      },
      onError: (error: any) =>
        toast({ title: 'Failed to add note', description: error.message, variant: 'destructive' }),
    });
  }

  return (
    <AppLayout title={`Complaint ${data.complaintNumber}`}>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold">Complaint Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Title</p>
                <p className="font-medium">{data.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium">{data.customer?.name || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invoice Number</p>
                <p className="font-medium">{data.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Account Number</p>
                <p className="font-medium">{data.customerAccountNumber}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Type</p>
                <p className="font-medium">{data.complaintType.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Priority</p>
                <p className="font-medium">{data.priority}</p>
              </div>
            </div>

            {data.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="whitespace-pre-wrap">{data.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold">Actions</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <Select value={effectiveStatus} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="triaged">Triaged</SelectItem>
                  <SelectItem value="awaiting_customer">Awaiting Customer</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Button className="mt-2 w-full" onClick={saveStatus} disabled={patch.isPending}>
                <Save className="w-4 h-4 mr-2" />
                {patch.isPending ? 'Saving...' : 'Save Status'}
              </Button>
            </div>

            <div className="rounded-md border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Avalara Validation</p>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{data.avalaraValidationStatus.replace('_', ' ')}</Badge>
                {data.avalaraValidatedAt && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(data.avalaraValidatedAt).toLocaleString()}
                  </span>
                )}
              </div>
              {data.avalaraSummary && (
                <p className="text-xs text-muted-foreground mb-2">{data.avalaraSummary}</p>
              )}
              <Button variant="outline" className="w-full" onClick={runValidation} disabled={validate.isPending}>
                <RefreshCw className={`w-4 h-4 mr-2 ${validate.isPending ? 'animate-spin' : ''}`} />
                {validate.isPending ? 'Validating...' : 'Validate with Avalara'}
              </Button>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1">Add Note</p>
              <Textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button className="mt-2 w-full" onClick={submitNote} disabled={addNote.isPending}>
                {addNote.isPending ? 'Adding...' : 'Add Note'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-3 border-border/50 shadow-sm">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-semibold">Timeline</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              data.events.map((event) => (
                <div key={event.id} className="rounded border border-border/50 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{event.message}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(event.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{event.eventType.replace('_', ' ')}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
