import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type InvoiceComplaintStatus =
  | 'new'
  | 'triaged'
  | 'awaiting_customer'
  | 'resolved'
  | 'closed';

export interface InvoiceComplaint {
  id: string;
  complaintNumber: string;
  customerId: string;
  title: string;
  description: string | null;
  source: 'manual' | 'api';
  status: InvoiceComplaintStatus;
  priority: 'low' | 'medium' | 'high';
  complaintType:
    | 'tax_mismatch'
    | 'rate_mismatch'
    | 'duplicate_charge'
    | 'missing_exemption'
    | 'other';
  invoiceNumber: string;
  customerAccountNumber: string;
  currencyCode: string;
  invoiceAmount: string | null;
  companyCode: string | null;
  documentCode: string | null;
  avalaraValidationStatus: 'not_validated' | 'validated' | 'failed';
  avalaraValidatedAt: string | null;
  avalaraSummary: string | null;
  assignedToUserId: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; name: string } | null;
}

export interface InvoiceComplaintEvent {
  id: string;
  complaintId: string;
  eventType:
    | 'created'
    | 'status_changed'
    | 'assignment_changed'
    | 'note'
    | 'validation_requested'
    | 'validation_succeeded'
    | 'validation_failed';
  message: string;
  metadata: Record<string, unknown> | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface InvoiceComplaintDetail extends InvoiceComplaint {
  events: InvoiceComplaintEvent[];
}

export function useInvoiceComplaints(params: {
  search?: string;
  status?: string;
  customerId?: string;
  priority?: string;
  complaintType?: string;
}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) qs.set(k, v);
  }

  return useQuery({
    queryKey: ['invoice-complaints', params],
    queryFn: () =>
      apiFetch<InvoiceComplaint[]>(`/invoice-complaints${qs.toString() ? `?${qs}` : ''}`),
  });
}

export function useInvoiceComplaint(id?: string) {
  return useQuery({
    queryKey: ['invoice-complaint', id],
    queryFn: () => apiFetch<InvoiceComplaintDetail>(`/invoice-complaints/${id}`),
    enabled: !!id,
  });
}

export function useCreateInvoiceComplaint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<InvoiceComplaint>('/invoice-complaints', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-complaints'] });
    },
  });
}

export function usePatchInvoiceComplaint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch<InvoiceComplaint>(`/invoice-complaints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-complaints'] });
      qc.invalidateQueries({ queryKey: ['invoice-complaint', id] });
    },
  });
}

export function useAddInvoiceComplaintNote(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (message: string) =>
      apiFetch<InvoiceComplaintEvent>(`/invoice-complaints/${id}/events`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-complaint', id] });
    },
  });
}

export function useValidateInvoiceComplaint(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ complaint: InvoiceComplaint; validation: Record<string, unknown> }>(
        `/invoice-complaints/${id}/validate`,
        {
          method: 'POST',
        },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoice-complaints'] });
      qc.invalidateQueries({ queryKey: ['invoice-complaint', id] });
    },
  });
}
