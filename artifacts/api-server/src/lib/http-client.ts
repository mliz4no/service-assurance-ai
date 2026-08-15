const DEFAULT_RETRY_STATUSES = [429, 502, 503, 504] as const;

export type HttpRetryOptions = {
  maxAttempts?: number;
  timeoutMs?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  retryStatuses?: readonly number[];
  fetchImpl?: typeof fetch;
  sleep?: (delayMs: number) => Promise<void>;
};

function retryAfterMs(response: Response, now = Date.now()): number | undefined {
  const value = response.headers.get('retry-after');
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function defaultSleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function fetchWithRetry(
  input: string | URL,
  init: RequestInit = {},
  options: HttpRetryOptions = {},
): Promise<Response> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const timeoutMs = Math.max(1, options.timeoutMs ?? 10_000);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 250);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 5_000);
  const retryStatuses = options.retryStatuses ?? DEFAULT_RETRY_STATUSES;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort(init.signal?.reason);
    init.signal?.addEventListener('abort', abortFromCaller, { once: true });

    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      if (!retryStatuses.includes(response.status) || attempt === maxAttempts) return response;

      const delayMs = retryAfterMs(response)
        ?? Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      await sleep(delayMs);
    } catch (error) {
      if (init.signal?.aborted || attempt === maxAttempts) throw error;
      await sleep(Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timeout);
      init.signal?.removeEventListener('abort', abortFromCaller);
    }
  }

  throw new Error('HTTP request exhausted retry attempts');
}