import { describe, expect, it, vi } from 'vitest';
import {
  geolocateCandidates,
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
    expect(candidates[0]).toMatchObject({ prefix: '8.8.8.0/24', candidateIp: '8.8.8.8' });

    const largeBlockCandidate = selectPingCandidates([{
      ...prefixes[0],
      prefix: '70.248.0.0/15',
      numAddresses: '131072',
    }], { maxCandidates: 1 });
    expect(largeBlockCandidate[0]?.candidateIp).toBe('70.248.128.1');
  });

  it('skips excluded IPs (already promoted/monitored) and picks the next distinct address instead', () => {
    const prefixes = [{
      isp: 'Example ISP',
      asn: 'AS64500',
      prefix: '8.8.8.0/24',
      addressFamily: 'ipv4' as const,
      numAddresses: '256',
    }];

    const baseline = selectPingCandidates(prefixes, { perPrefix: 2, minimumPrefixLength: 24, maxCandidates: 5 });
    expect(baseline.map((candidate) => candidate.candidateIp)).toEqual(['8.8.8.36', '8.8.8.73']);

    const withExclusion = selectPingCandidates(prefixes, {
      perPrefix: 2,
      minimumPrefixLength: 24,
      maxCandidates: 5,
      excludeIps: ['8.8.8.36'],
    });
    expect(withExclusion.map((candidate) => candidate.candidateIp)).toEqual(['8.8.8.73', '8.8.8.109']);
  });

  it('geolocates candidates via RIPEstat maxmind-geo-lite without an API key', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      expect(url).toContain('/maxmind-geo-lite/');
      expect(url).toContain('resource=8.8.8.8');
      return new Response(JSON.stringify({
        data: {
          located_resources: [{
            resource: '8.8.8.8',
            locations: [{ country: 'US', city: 'Mountain View', latitude: 37.40599, longitude: -122.078514 }],
          }],
        },
      }));
    });

    const candidates = [{ isp: 'Example ISP', asn: 'AS64500', prefix: '8.8.8.0/24', candidateIp: '8.8.8.8' }];
    const geolocated = await geolocateCandidates(candidates, { fetchImpl: fetchMock, requestDelayMs: 0 });

    expect(geolocated).toEqual([{
      isp: 'Example ISP',
      asn: 'AS64500',
      prefix: '8.8.8.0/24',
      candidateIp: '8.8.8.8',
      latitude: 37.40599,
      longitude: -122.078514,
      country: 'US',
      city: 'Mountain View',
    }]);
  });
});