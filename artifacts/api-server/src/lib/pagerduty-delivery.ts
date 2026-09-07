import { fetchWithRetry } from './http-client';
import { severityMeetsThreshold, type SeverityLevel } from './severity';

export type PagerDutyEventAction = 'trigger' | 'acknowledge' | 'resolve';

export type PagerDutyDeliveryInput = {
  action: PagerDutyEventAction;
  ticketId: string;
  ticketNumber: string;
  title: string;
  severity: SeverityLevel;
  status: string;
};

export type PagerDutyDeliveryResult = {
  status: 'sent' | 'failed';
  action: PagerDutyEventAction;
  dedupKey: string;
  error?: string;
};

export function pagerDutyActionForStatusChange(
  previousStatus: string,
  nextStatus: string,
): PagerDutyEventAction | null {
  if (previousStatus === nextStatus) return null;
  if (nextStatus === 'resolved' || nextStatus === 'closed') return 'resolve';
  if (nextStatus !== 'new') return 'acknowledge';
  return null;
}

export function pagerDutyDedupKey(ticketId: string): string {
  return `service-assurance:ticket:${ticketId}`;
}

export function isPagerDutyConfigured(): boolean {
  return Boolean(process.env.PAGERDUTY_ROUTING_KEY?.trim());
}

export function shouldTriggerPagerDuty(severity: SeverityLevel): boolean {
  const configured = process.env.PAGERDUTY_SEVERITY_GATE?.trim().toLowerCase() as
    | SeverityLevel
    | undefined;
  const threshold: SeverityLevel = ['low', 'medium', 'high', 'critical'].includes(configured ?? '')
    ? configured!
    : 'high';
  return severityMeetsThreshold(severity, threshold);
}

function mapSeverity(severity: SeverityLevel): 'info' | 'warning' | 'error' | 'critical' {
  return { low: 'info', medium: 'warning', high: 'error', critical: 'critical' }[severity] as
    | 'info'
    | 'warning'
    | 'error'
    | 'critical';
}

export async function deliverPagerDutyEvent(
  input: PagerDutyDeliveryInput,
): Promise<PagerDutyDeliveryResult> {
  const routingKey = process.env.PAGERDUTY_ROUTING_KEY?.trim();
  const dedupKey = pagerDutyDedupKey(input.ticketId);
  if (!routingKey) {
    return { status: 'failed', action: input.action, dedupKey, error: 'PagerDuty is not configured' };
  }

  const endpoint = process.env.PAGERDUTY_EVENTS_URL?.trim() || 'https://events.pagerduty.com/v2/enqueue';
  const payload: Record<string, unknown> = {
    routing_key: routingKey,
    event_action: input.action,
    dedup_key: dedupKey,
  };
  if (input.action === 'trigger') {
    payload.payload = {
      summary: `${input.ticketNumber}: ${input.title}`,
      source: 'Service Assurance AI',
      severity: mapSeverity(input.severity),
      custom_details: {
        ticketId: input.ticketId,
        ticketNumber: input.ticketNumber,
        ticketStatus: input.status,
        serviceAssuranceSeverity: input.severity,
      },
    };
  }

  try {
    const response = await fetchWithRetry(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
      {
        timeoutMs: Math.max(1_000, Number(process.env.PAGERDUTY_DELIVERY_TIMEOUT_MS ?? 10_000)),
        maxAttempts: Math.max(1, Number(process.env.PAGERDUTY_DELIVERY_MAX_ATTEMPTS ?? 3)),
        baseDelayMs: Math.max(0, Number(process.env.PAGERDUTY_DELIVERY_RETRY_DELAY_MS ?? 250)),
      },
    );
    if (!response.ok) {
      return {
        status: 'failed',
        action: input.action,
        dedupKey,
        error: `PagerDuty returned ${response.status}`,
      };
    }
    return { status: 'sent', action: input.action, dedupKey };
  } catch (error) {
    return {
      status: 'failed',
      action: input.action,
      dedupKey,
      error: error instanceof Error ? error.message : 'Unknown PagerDuty delivery error',
    };
  }
}