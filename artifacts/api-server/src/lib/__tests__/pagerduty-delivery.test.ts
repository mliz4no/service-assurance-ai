import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  deliverPagerDutyEvent,
  pagerDutyDedupKey,
  pagerDutyActionForStatusChange,
  shouldTriggerPagerDuty,
} from '../pagerduty-delivery';

const INPUT = {
  action: 'trigger' as const,
  ticketId: 'ticket-123',
  ticketNumber: 'SA-123',
  title: 'Primary circuit unavailable',
  severity: 'critical' as const,
  status: 'investigating',
};

describe('PagerDuty delivery', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('uses a stable ticket deduplication key and severity gate', () => {
    expect(pagerDutyDedupKey('ticket-123')).toBe('service-assurance:ticket:ticket-123');
    expect(shouldTriggerPagerDuty('medium')).toBe(false);
    expect(shouldTriggerPagerDuty('high')).toBe(true);
    vi.stubEnv('PAGERDUTY_SEVERITY_GATE', 'critical');
    expect(shouldTriggerPagerDuty('high')).toBe(false);
    expect(shouldTriggerPagerDuty('critical')).toBe(true);
  });

  it('maps ticket status transitions to PagerDuty lifecycle actions', () => {
    expect(pagerDutyActionForStatusChange('new', 'investigating')).toBe('acknowledge');
    expect(pagerDutyActionForStatusChange('monitoring', 'resolved')).toBe('resolve');
    expect(pagerDutyActionForStatusChange('resolved', 'closed')).toBe('resolve');
    expect(pagerDutyActionForStatusChange('new', 'new')).toBeNull();
    expect(pagerDutyActionForStatusChange('investigating', 'new')).toBeNull();
  });

  it('sends a valid Events API v2 trigger payload', async () => {
    vi.stubEnv('PAGERDUTY_ROUTING_KEY', 'routing-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deliverPagerDutyEvent(INPUT)).resolves.toEqual({
      status: 'sent',
      action: 'trigger',
      dedupKey: 'service-assurance:ticket:ticket-123',
    });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://events.pagerduty.com/v2/enqueue');
    expect(JSON.parse(options.body)).toMatchObject({
      routing_key: 'routing-key',
      event_action: 'trigger',
      dedup_key: 'service-assurance:ticket:ticket-123',
      payload: { severity: 'critical', source: 'Service Assurance AI' },
    });
  });

  it('uses the same deduplication key for resolution', async () => {
    vi.stubEnv('PAGERDUTY_ROUTING_KEY', 'routing-key');
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await deliverPagerDutyEvent({ ...INPUT, action: 'resolve' });
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload).toEqual({
      routing_key: 'routing-key',
      event_action: 'resolve',
      dedup_key: 'service-assurance:ticket:ticket-123',
    });
  });
});