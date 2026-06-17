import { clearToken, getToken } from '@/lib/token';

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
const API_PREFIX = `${BASE_URL}/api`;

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers ?? {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
    throw new Error('Session expired — redirecting to login…');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || res.statusText);
  }

  return res.json();
}
