import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupExternalOutageSignal } from '../external-outage-signal';

describe('external outage signal lookup', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete process.env.POWER_OUTAGE_API_BASE_URL;
    delete process.env.POWER_OUTAGE_API_TOKEN;
  });

  it('returns null when external outage endpoint is not configured', async () => {
    const result = await lookupExternalOutageSignal({ region: 'north-east', provider: 'Carrier A' });
    expect(result).toBeNull();
  });

  it('parses active signal payload', async () => {
    process.env.POWER_OUTAGE_API_BASE_URL = 'https://power.example.test';
    process.env.POWER_OUTAGE_API_TOKEN = 'token-123';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        active: true,
        incidentId: 'out-77',
        summary: 'Regional utility outage',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupExternalOutageSignal({ region: 'north-east', provider: 'Carrier A' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      active: true,
      source: 'poweroutage',
      incidentId: 'out-77',
      summary: 'Regional utility outage',
      region: 'north-east',
      provider: 'Carrier A',
    });
  });

  it('parses incident list payload format', async () => {
    process.env.POWER_OUTAGE_API_BASE_URL = 'https://power.example.test';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        incidents: [
          { id: 'old-1', summary: 'Resolved incident', active: false },
          { id: 'active-2', summary: 'Active regional outage', status: 'active' },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await lookupExternalOutageSignal({ region: 'west', provider: null });

    expect(result?.active).toBe(true);
    expect(result?.incidentId).toBe('active-2');
    expect(result?.summary).toBe('Active regional outage');
    expect(result?.provider).toBeNull();
  });
});
