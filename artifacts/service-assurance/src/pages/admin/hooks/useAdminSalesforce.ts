import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useSalesforceStatus() {
  return useQuery({
    queryKey: ['salesforce-status'],
    queryFn: () => apiFetch('/salesforce/status'),
    refetchInterval: 30_000,
  });
}

export function useSalesforceConfig() {
  return useQuery({
    queryKey: ['salesforce-config'],
    queryFn: () => apiFetch('/salesforce/config'),
  });
}

export function useSaveConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch('/salesforce/config', { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['salesforce-config'] });
      qc.invalidateQueries({ queryKey: ['salesforce-status'] });
    },
  });
}

export function useSalesforceTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/salesforce/test', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salesforce-status'] }),
  });
}

export function useSalesforceSync(type: 'accounts' | 'contacts' | 'full') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch(`/salesforce/sync/${type}`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['salesforce-status'] }),
  });
}
