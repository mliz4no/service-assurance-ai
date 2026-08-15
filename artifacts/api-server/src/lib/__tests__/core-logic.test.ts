import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('core utility modules', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it('hashes and verifies passwords correctly', async () => {
    const { hashPassword, verifyPassword } = await import('../auth');

    const hashed = hashPassword('secret123');

    expect(hashed).toContain(':');
    expect(verifyPassword('secret123', hashed)).toBe(true);
    expect(verifyPassword('wrong', hashed)).toBe(false);
  });

  it('generates a token with the expected format', async () => {
    const { generateToken } = await import('../auth');

    const token = generateToken();

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[a-f0-9]+$/);
  });

  it('extracts strings and throws for missing values', async () => {
    const { getStringParam } = await import('../params');

    expect(getStringParam('abc', 'name')).toBe('abc');
    expect(getStringParam(['first', 'second'], 'name')).toBe('first');
    expect(() => getStringParam(undefined, 'name')).toThrow('Missing required parameter: name');
  });

  it('calculates severity and threshold checks correctly', async () => {
    const { calculateSeverity, severityMeetsThreshold, buildDefaultMatrix } = await import('../severity');

    expect(calculateSeverity('high', 'high')).toBe('critical');
    expect(calculateSeverity('medium', 'low')).toBe('low');
    expect(buildDefaultMatrix().high.high).toBe('critical');
    expect(severityMeetsThreshold('high', 'medium')).toBe(true);
    expect(severityMeetsThreshold('medium', 'high')).toBe(false);
  });

  it('summarizes a ticket using the OpenAI JSON response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Carrier confirmed an outage on the affected circuit.',
                confidence: 92,
                keyDetails: {
                  impactedService: 'DIA circuit 1001',
                  currentAction: 'Investigating with carrier',
                  vendorStatus: 'Carrier confirmed ticket',
                },
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);
    process.env.OPENAI_API_KEY = 'test-key';

    const { summarizeTicket } = await import('../ai');

    const result = await summarizeTicket({
      title: 'Circuit outage',
      severity: 'critical',
      status: 'investigating',
      outageType: 'outage',
      description: 'Service interruption',
      vendorTicketId: 'V-123',
      circuitId: 'C-1001',
      vendorName: 'Carrier A',
      updates: [],
    });

    expect(result.summary).toContain('Carrier');
    expect(result.confidence).toBe(92);
    expect(result.keyDetails.impactedService).toBe('DIA circuit 1001');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back gracefully when the AI response fails validation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary":"ok"}' } }],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);
    process.env.OPENAI_API_KEY = 'test-key';

    const { summarizeTicket } = await import('../ai');

    const result = await summarizeTicket({
      title: 'Test ticket',
      severity: 'high',
      status: 'new',
      outageType: 'impairment',
      description: null,
      vendorTicketId: null,
      circuitId: null,
      vendorName: null,
      updates: [],
    });

    expect(result.summary).toContain('AI summary unavailable');
    expect(result.confidence).toBe(0);
  });

  it('normalizes and generates customer-facing updates', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                status: 'vendor_engaged',
                confidence: 87,
                reasoning: 'Vendor acknowledged the incident.',
              }),
            },
          },
        ],
      }),
    });

    vi.stubGlobal('fetch', fetchMock);
    process.env.OPENAI_API_KEY = 'test-key';

    const { normalizeStatus, generateCustomerUpdate } = await import('../ai');

    const normalized = await normalizeStatus({ text: 'Vendor acknowledged the issue' });
    expect(normalized.status).toBe('vendor_engaged');

    const update = await generateCustomerUpdate({
      title: 'Customer outage',
      severity: 'high',
      currentStatus: 'investigating',
      aiNormalizedStatus: 'vendor_engaged',
      updates: [{ updateType: 'customer', rawText: 'Carrier is reviewing the issue', visibility: 'public', createdAt: new Date() }],
    });

    expect(update.update).toContain('actively investigating');
    expect(update.containsETA).toBe(false);
  });
});
