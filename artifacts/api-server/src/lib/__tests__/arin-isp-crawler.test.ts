import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crawlArinIspList } from '../arin-isp-crawler';

describe('arin isp crawler', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ARIN_RDAP_BASE_URL;
    delete process.env.ARIN_WHOIS_BASE_URL;
    delete process.env.ARIN_ALLOWED_DOMAINS;
  });

  it('uses ARIN RDAP metadata and keeps approved ISP destinations', async () => {
    process.env.ARIN_RDAP_BASE_URL = 'https://rdap.example.test';
    process.env.ARIN_WHOIS_BASE_URL = 'https://whois.example.test/rest';

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.includes('/search?name=AT%26T')) {
        return {
          ok: true,
          json: async () => ({
            results: [
              {
                handle: 'ARIN-ORG-123',
                name: 'AT&T Services, Inc.',
                links: [{ href: 'https://www.att.com' }],
                publicIds: [{ type: 'ASN', identifier: 'AS7018' }],
              },
            ],
          }),
        } as Response;
      }

      if (url === 'https://www.att.com') {
        return {
          ok: true,
          text: async () => '<html><body>AT&T</body></html>',
        } as Response;
      }

      if (url.includes('https://whois.example.test/rest/nets;q=AS7018')) {
        return {
          ok: true,
          json: async () => ({
            nets: {
              net: [
                {
                  handle: 'NET-12-0-0-0-1',
                  name: 'ATT',
                  startAddress: '12.0.0.0',
                  endAddress: '12.255.255.255',
                  cidr0_cidrs: [{ v4prefix: '12.0.0.0', length: 8 }],
                },
              ],
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        status: 404,
      } as Response;
    });

    vi.stubGlobal('fetch', fetchMock);

    const results = await crawlArinIspList(['AT&T']);

    expect(results).toHaveLength(1);
    expect(results[0]?.ispName).toBe('AT&T');
    expect(results[0]?.organizationName).toBe('AT&T Services, Inc.');
    expect(results[0]?.domain).toBe('att.com');
    expect(results[0]?.homePageUrl).toBe('https://att.com');
    expect(results[0]?.asns).toContain('AS7018');
    expect(results[0]?.ipRanges).toEqual([
      {
        handle: 'NET-12-0-0-0-1',
        name: 'ATT',
        startAddress: '12.0.0.0',
        endAddress: '12.255.255.255',
        cidrs: ['12.0.0.0/8'],
      },
    ]);
  });
});
