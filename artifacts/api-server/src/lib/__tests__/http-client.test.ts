import { describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '../http-client';

describe('fetchWithRetry', () => {
  it('honors Retry-After and preserves request options on a successful retry', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const sleep = vi.fn(async () => undefined);
    const init = { method: 'POST', headers: { Authorization: 'Bearer token' }, body: '{}' };

    const response = await fetchWithRetry('https://provider.test/events', init, { fetchImpl, sleep });

    expect(response.status).toBe(200);
    expect(sleep).toHaveBeenCalledWith(2_000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1][1]).toMatchObject(init);
  });

  it('retries transient server and network failures with bounded backoff', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('connection reset'))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const sleep = vi.fn(async () => undefined);

    const response = await fetchWithRetry('https://provider.test/status', {}, {
      fetchImpl, sleep, baseDelayMs: 10, maxDelayMs: 15,
    });

    expect(response.status).toBe(204);
    expect(sleep.mock.calls).toEqual([[10], [15]]);
  });

  it('returns non-retryable and exhausted HTTP responses without extra calls', async () => {
    const badRequestFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 400 }));
    expect((await fetchWithRetry('https://provider.test', {}, { fetchImpl: badRequestFetch })).status).toBe(400);
    expect(badRequestFetch).toHaveBeenCalledTimes(1);

    const unavailableFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const response = await fetchWithRetry('https://provider.test', {}, {
      fetchImpl: unavailableFetch, maxAttempts: 2, sleep: async () => undefined,
    });
    expect(response.status).toBe(503);
    expect(unavailableFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting network retries', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    await expect(fetchWithRetry('https://provider.test', {}, {
      fetchImpl, maxAttempts: 2, sleep: async () => undefined,
    })).rejects.toThrow('offline');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});