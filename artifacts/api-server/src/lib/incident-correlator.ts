/**
 * Incident Correlation Engine
 *
 * Evaluates normalized controller events and device/link state transitions
 * to decide whether to:
 * - Create a new ticket
 * - Attach to an existing open ticket (via IncidentCorrelation)
 * - Do nothing (informational event)
 */

import {
  db,
  ticketsTable,
  incidentCorrelationsTable,
  deviceEventsTable,
  managedDevicesTable,
  networkLinksTable,
} from '@workspace/db';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { logger } from './logger';

export interface CorrelationResult {
  action: 'created' | 'attached' | 'skipped';
  ticketId?: string;
  ticketNumber?: string;
  reason: string;
}

/** Rules for when to auto-create a ticket from a device event */
function shouldCreateTicket(event: { severity: string; eventType: string }): boolean {
  if (event.severity === 'informational') return false;
  if (event.eventType === 'device_checkin') return false;
  return ['high', 'critical', 'medium'].includes(event.severity);
}

/** Map controller event severity to ticket severity */
function mapSeverity(eventSeverity: string): 'low' | 'medium' | 'high' | 'critical' {
  switch (eventSeverity) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'medium':
      return 'medium';
    default:
      return 'low';
  }
}

/** Determine outage type from event */
function mapOutageType(eventType: string): 'outage' | 'impairment' | 'informational' | 'unknown' {
  if (eventType.includes('down') || eventType.includes('offline')) return 'outage';
  if (
    eventType.includes('degrad') ||
    eventType.includes('quality') ||
    eventType.includes('failover') ||
    eventType.includes('ha_')
  )
    return 'impairment';
  if (eventType.includes('checkin') || eventType.includes('info')) return 'informational';
  return 'unknown';
}

/** Generate a unique ticket number by scanning all existing tickets */
async function getNextTicketNumber(): Promise<string> {
  const allNumbers = await db
    .select({ ticketNumber: ticketsTable.ticketNumber })
    .from(ticketsTable);
  if (allNumbers.length === 0) return 'SA-1001';
  let max = 1000;
  for (const row of allNumbers) {
    const match = row.ticketNumber.match(/SA-(\d+)/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return `SA-${max + 1}`;
}

/**
 * Main correlation function.
 * Called after saving a new DeviceEvent to determine ticket action.
 */
export async function correlateEvent(params: {
  eventId: string;
  controllerId: string;
  customerId: string | null;
  siteId: string | null;
  serviceId: string | null;
  managedDeviceId: string | null;
  severity: string;
  eventType: string;
  title: string;
  description: string | null;
  failoverActive?: boolean;
}): Promise<CorrelationResult> {
  // Skip informational events
  if (!shouldCreateTicket(params)) {
    return { action: 'skipped', reason: 'Informational event — no ticket needed' };
  }

  // Skip if no customer context
  if (!params.customerId) {
    return { action: 'skipped', reason: 'No customer context — cannot create or correlate ticket' };
  }

  // Look for an existing open ticket for the same customer/site/service
  const openStatuses = [
    'new',
    'investigating',
    'vendor_engaged',
    'dispatch_scheduled',
    'monitoring',
  ];

  let existingTickets = await db
    .select()
    .from(ticketsTable)
    .where(
      and(
        eq(ticketsTable.customerId, params.customerId),
        inArray(ticketsTable.status, openStatuses),
      ),
    )
    .limit(5);

  // Prefer matching by siteId then serviceId for closer correlation
  let matchedTicket =
    existingTickets.find(
      (t) =>
        (params.siteId && t.siteId === params.siteId) ||
        (params.serviceId && t.serviceId === params.serviceId),
    ) ??
    existingTickets[0] ??
    null;

  if (matchedTicket) {
    // Attach event to existing ticket
    await db.insert(incidentCorrelationsTable).values({
      ticketId: matchedTicket.id,
      deviceEventId: params.eventId,
      correlationType: 'related',
    });

    logger.info(
      { ticketId: matchedTicket.id, eventId: params.eventId },
      'Controller event correlated to existing ticket',
    );
    return {
      action: 'attached',
      ticketId: matchedTicket.id,
      ticketNumber: matchedTicket.ticketNumber,
      reason: `Correlated to existing open ticket ${matchedTicket.ticketNumber}`,
    };
  }

  // Create a new ticket
  const ticketNumber = await getNextTicketNumber();
  const severity = mapSeverity(params.severity);
  const outageType = mapOutageType(params.eventType);
  const failoverActive = params.failoverActive ?? false;

  const [newTicket] = await db
    .insert(ticketsTable)
    .values({
      ticketNumber,
      customerId: params.customerId,
      siteId: params.siteId ?? null,
      serviceId: params.serviceId ?? null,
      title: params.title,
      description: params.description ?? null,
      source: 'controller',
      severity,
      status: 'new',
      outageType,
      incidentSource: 'controller',
      impactedDeviceId: params.managedDeviceId ?? null,
      failoverActive,
    })
    .returning();

  // Link event to ticket
  await db.insert(incidentCorrelationsTable).values({
    ticketId: newTicket.id,
    deviceEventId: params.eventId,
    correlationType: 'trigger',
  });

  logger.info(
    { ticketId: newTicket.id, ticketNumber, eventId: params.eventId },
    'Controller event created new ticket',
  );
  return {
    action: 'created',
    ticketId: newTicket.id,
    ticketNumber,
    reason: `New ticket ${ticketNumber} created from controller event`,
  };
}
