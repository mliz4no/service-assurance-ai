import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { customFetch } from './custom-fetch';
import type {
  CustomerContact,
  CreateCustomerContactRequest,
  UpdateCustomerContactRequest,
  EscalationNotification,
  EscalationMatrixResponse,
  UpsertEscalationMatrixRequest,
  MatrixScopeType,
} from './generated/api.schemas';

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const getGetCustomerContactsQueryKey = (customerId: string) =>
  ['customers', customerId, 'contacts'] as const;

export const getGetTicketNotificationsQueryKey = (ticketId: string) =>
  ['tickets', ticketId, 'notifications'] as const;

// ─── Customer Contacts ───────────────────────────────────────────────────────

export function useGetCustomerContacts(customerId: string) {
  return useQuery<CustomerContact[]>({
    queryKey: getGetCustomerContactsQueryKey(customerId),
    queryFn: () => customFetch<CustomerContact[]>(`/api/customers/${customerId}/contacts`),
    enabled: !!customerId,
  });
}

export function useCreateCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation<CustomerContact, Error, { data: CreateCustomerContactRequest }>({
    mutationFn: ({ data }) =>
      customFetch<CustomerContact>(`/api/customers/${customerId}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetCustomerContactsQueryKey(customerId) });
    },
  });
}

export function useUpdateCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    CustomerContact,
    Error,
    { contactId: string; data: UpdateCustomerContactRequest }
  >({
    mutationFn: ({ contactId, data }) =>
      customFetch<CustomerContact>(`/api/customers/${customerId}/contacts/${contactId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetCustomerContactsQueryKey(customerId) });
    },
  });
}

export function useDeleteCustomerContact(customerId: string) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, { contactId: string }>({
    mutationFn: ({ contactId }) =>
      customFetch<{ success: boolean }>(`/api/customers/${customerId}/contacts/${contactId}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGetCustomerContactsQueryKey(customerId) });
    },
  });
}

// ─── Escalation Notifications ────────────────────────────────────────────────

export function useGetTicketNotifications(ticketId: string) {
  return useQuery<EscalationNotification[]>({
    queryKey: getGetTicketNotificationsQueryKey(ticketId),
    queryFn: () => customFetch<EscalationNotification[]>(`/api/tickets/${ticketId}/notifications`),
    enabled: !!ticketId,
  });
}

export function useEvaluateEscalation() {
  return useMutation<
    {
      notified: number;
      contacts: Array<{ name: string; email: string; role: string; reason: string }>;
    },
    Error,
    { ticketId: string }
  >({
    mutationFn: ({ ticketId }) =>
      customFetch(`/api/tickets/${ticketId}/evaluate-escalation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
  });
}

// ─── Escalation Matrix ───────────────────────────────────────────────────────

export const getEscalationMatrixQueryKey = (scopeType: string, scopeId?: string | null) =>
  ['escalation-matrix', scopeType, scopeId ?? null] as const;

export function useGetEscalationMatrix(scopeType: MatrixScopeType, scopeId?: string | null) {
  const params = new URLSearchParams({ scopeType });
  if (scopeId) params.set('scopeId', scopeId);
  return useQuery<EscalationMatrixResponse>({
    queryKey: getEscalationMatrixQueryKey(scopeType, scopeId),
    queryFn: () =>
      customFetch<EscalationMatrixResponse>(`/api/escalation-matrix?${params.toString()}`),
  });
}

export function useUpsertEscalationMatrix() {
  const queryClient = useQueryClient();
  return useMutation<EscalationMatrixResponse, Error, UpsertEscalationMatrixRequest>({
    mutationFn: (data) =>
      customFetch<EscalationMatrixResponse>('/api/escalation-matrix', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: getEscalationMatrixQueryKey(variables.scopeType, variables.scopeId),
      });
    },
  });
}

export function useDeleteMatrixOverride() {
  const queryClient = useQueryClient();
  return useMutation<
    { success: boolean },
    Error,
    { overrideId: string; scopeType: MatrixScopeType; scopeId?: string | null }
  >({
    mutationFn: ({ overrideId }) =>
      customFetch<{ success: boolean }>(`/api/escalation-matrix/override/${overrideId}`, {
        method: 'DELETE',
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: getEscalationMatrixQueryKey(variables.scopeType, variables.scopeId),
      });
    },
  });
}
