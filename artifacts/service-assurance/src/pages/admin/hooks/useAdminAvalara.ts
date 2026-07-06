import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export function useAvalaraStatus() {
  return useQuery({
    queryKey: ['avalara-status'],
    queryFn: () => apiFetch('/avalara/status'),
    refetchInterval: 30_000,
  });
}

export function useAvalaraConfig() {
  return useQuery({
    queryKey: ['avalara-config'],
    queryFn: () => apiFetch('/avalara/config'),
  });
}

export function useSaveAvalaraConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) =>
      apiFetch('/avalara/config', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['avalara-config'] });
      qc.invalidateQueries({ queryKey: ['avalara-status'] });
    },
  });
}

export function useAvalaraTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch('/avalara/test', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['avalara-status'] }),
  });
}
