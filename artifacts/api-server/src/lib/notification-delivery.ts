export type AlertDeliveryInput = {
  to: string;
  subject: string;
  message: string;
  ticketId: string;
  ticketNumber: string;
  severity: string;
};

export type AlertDeliveryResult = {
  status: 'simulated' | 'sent' | 'failed';
  channel: 'email' | 'webhook';
  error?: string;
};

async function postJson(url: string, payload: Record<string, unknown>, token?: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, Number(process.env.ALERT_DELIVERY_TIMEOUT_MS ?? '10000'));
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function deliverAlert(input: AlertDeliveryInput): Promise<AlertDeliveryResult> {
  const emailUrl = process.env.ALERT_EMAIL_API_URL?.trim();
  const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
  const token = process.env.ALERT_DELIVERY_TOKEN?.trim();

  if (!emailUrl && !webhookUrl) {
    return { status: 'simulated', channel: 'email' };
  }

  const channel = emailUrl ? 'email' : 'webhook';
  const url = emailUrl ?? webhookUrl as string;
  const payload = emailUrl
    ? {
        to: input.to,
        subject: input.subject,
        text: input.message,
        metadata: {
          ticketId: input.ticketId,
          ticketNumber: input.ticketNumber,
          severity: input.severity,
        },
      }
    : {
        event: 'service_assurance.alert',
        recipient: input.to,
        subject: input.subject,
        message: input.message,
        ticket: {
          id: input.ticketId,
          number: input.ticketNumber,
          severity: input.severity,
        },
      };

  try {
    const response = await postJson(url, payload, token);
    if (!response.ok) {
      return { status: 'failed', channel, error: `Delivery provider returned ${response.status}` };
    }
    return { status: 'sent', channel };
  } catch (error) {
    return {
      status: 'failed',
      channel,
      error: error instanceof Error ? error.message : 'Unknown delivery error',
    };
  }
}