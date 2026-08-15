import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveTargetEnrichment, resolveTargetEnrichmentWithProvider } from '../target-enrichment';

describe('target enrichment', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete process.env.IPINFO_TOKEN;
    delete process.env.IPINFO_BASE_URL;
    delete process.env.IP_ENRICHMENT_PROVIDER;
  });

  it('classifies RFC1918 and documentation IPv4 ranges', () => {
    const privateResult = resolveTargetEnrichment('10.2.3.4');
    expect(privateResult.ipType).toBe('ipv4');
    expect(privateResult.provider).toBe('Private Network');
    expect(privateResult.confidence).toBe('high');

    const docRangeResult = resolveTargetEnrichment('198.51.100.77');
    expect(docRangeResult.provider).toBe('Documentation/Test Network');
    expect(docRangeResult.confidence).toBe('high');
  });

  it('classifies provider and region from hostname patterns', () => {
    const result = resolveTargetEnrichment('att.edge.example.us');
    expect(result.ipType).toBe('hostname');
    expect(result.provider).toBe('AT&T');
    expect(result.region).toBe('NA');
    expect(result.confidence).toBe('medium');
  });

  it('enriches public IPs from provider-backed lookup when configured', async () => {
    process.env.IPINFO_TOKEN = 'test-token';
    process.env.IPINFO_BASE_URL = 'https://ipinfo.example.test';
    process.env.IP_ENRICHMENT_PROVIDER = 'ipinfo';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        org: 'AS15169 Google LLC',
        country: 'US',
        region: 'California',
        city: 'Mountain View',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await resolveTargetEnrichmentWithProvider('8.8.8.8');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('Google LLC');
    expect(result.asn).toBe('AS15169');
    expect(result.country).toBe('US');
    expect(result.city).toBe('Mountain View');
    expect(result.region).toBe('NA');
    expect(result.source).toBe('ipinfo');
  });

  it('keeps heuristic result when provider lookup is unavailable', async () => {
    const result = await resolveTargetEnrichmentWithProvider('198.51.100.25');

    expect(result.provider).toBe('Documentation/Test Network');
    expect(result.source).toBe('heuristic');
  });
});
