import { afterEach, describe, expect, it, vi } from 'vitest';
import { deliverAlert } from '../notification-delivery';

const ALERT = {
  to: 'noc@example.test',
  subject: 'Critical outage',
  message: 'Circuit unavailable',
  ticketId: 'ticket-1',
  ticketNumber: 'SA-1001',
  severity: 'critical',
};

describe('notification delivery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.ALERT_EMAIL_API_URL;
    delete process.env.ALERT_WEBHOOK_URL;
    delete process.env.ALERT_DELIVERY_TOKEN;
    delete process.env.ALERT_DELIVERY_MAX_ATTEMPTS;
    delete process.env.ALERT_DELIVERY_RETRY_DELAY_MS;
  });

  it('simulates delivery when no provider is configured', async () => {
    await expect(deliverAlert(ALERT)).resolves.toEqual({ status: 'simulated', channel: 'email' });
  });

  it('sends email payloads through the configured provider', async () => {
    process.env.ALERT_EMAIL_API_URL = 'https://alerts.example.test/email';
    process.env.ALERT_DELIVERY_TOKEN = 'secret-token';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal('fetch', fetchMock);

    await expect(deliverAlert(ALERT)).resolves.toEqual({ status: 'sent', channel: 'email' });
    expect(fetchMock).toHaveBeenCalledWith(
      process.env.ALERT_EMAIL_API_URL,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' }),
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      to: ALERT.to,
      subject: ALERT.subject,
    });
  });

  it('reports webhook delivery failures', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://alerts.example.test/webhook';
    process.env.ALERT_DELIVERY_RETRY_DELAY_MS = '0';
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deliverAlert(ALERT)).resolves.toEqual({
      status: 'failed',
      channel: 'webhook',
      error: 'Delivery provider returned 503',
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('recovers from a transient provider failure', async () => {
    process.env.ALERT_WEBHOOK_URL = 'https://alerts.example.test/webhook';
    process.env.ALERT_DELIVERY_RETRY_DELAY_MS = '0';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deliverAlert(ALERT)).resolves.toEqual({ status: 'sent', channel: 'webhook' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1].headers['Idempotency-Key']).toBe(
      fetchMock.mock.calls[1][1].headers['Idempotency-Key'],
    );
  });
});