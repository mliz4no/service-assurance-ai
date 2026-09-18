import { describe, expect, it, vi } from 'vitest';
import {
  getAnnouncedPrefixes,
  selectPingCandidates,
  verifyIspAsns,
} from '@workspace/scripts/isp-prefixes';

describe('ISP prefix discovery', () => {
  it('verifies ASN ownership and reads currently announced prefixes from RIPEstat', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/as-overview/')) {
        return new Response(JSON.stringify({ data: { holder: 'ATT-INTERNET4' } }));
      }
      return new Response(JSON.stringify({
        data: {
          prefixes: [{ prefix: '12.0.0.0/8' }, { prefix: '2001:1890::/29' }],
        },
      }));
    });
    const entries = [{ isp: 'AT&T', asn: '7018', category: 'tier1' }];

    const verified = await verifyIspAsns(entries, { fetchImpl: fetchMock, requestDelayMs: 0 });
    const prefixes = await getAnnouncedPrefixes(entries, { fetchImpl: fetchMock, requestDelayMs: 0 });

    expect(verified).toEqual([{
      isp: 'AT&T',
      asn: 'AS7018',
      category: 'tier1',
      holder: 'ATT-INTERNET4',
      matchesListedIsp: true,
      lookupSucceeded: true,
    }]);
    expect(prefixes).toEqual([{
      isp: 'AT&T',
      asn: 'AS7018',
      category: 'tier1',
      prefix: '12.0.0.0/8',
      addressFamily: 'ipv4',
      numAddresses: '16777216',
    }]);
  });

  it('only generates a bounded candidate list and never scans a prefix', () => {
    const prefixes = [{
      isp: 'Example ISP',
      asn: 'AS64500',
      prefix: '8.8.8.0/24',
      addressFamily: 'ipv4' as const,
      numAddresses: '256',
    }];

    const candidates = selectPingCandidates(prefixes, {
      perPrefix: 50,
      minimumPrefixLength: 24,
      maxCandidates: 1,
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ prefix: '8.8.8.0/24', candidateIp: '8.8.8.85' });

    const largeBlockCandidate = selectPingCandidates([{
      ...prefixes[0],
      prefix: '70.248.0.0/15',
      numAddresses: '131072',
    }], { maxCandidates: 1 });
    expect(largeBlockCandidate[0]?.candidateIp).toBe('70.249.0.1');
  });
});