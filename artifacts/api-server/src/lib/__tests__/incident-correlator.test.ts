import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
};

const mockTicketsTable = { ticketNumber: 'ticketNumber', customerId: 'customerId', status: 'status', siteId: 'siteId', serviceId: 'serviceId', id: 'id' };
const mockIncidentCorrelationsTable = {};
const mockDeviceEventsTable = {};
const mockManagedDevicesTable = {};
const mockNetworkLinksTable = {};
const mockTicketUpdatesTable = {};

vi.mock('@workspace/db', () => ({
  db: mockDb,
  ticketsTable: mockTicketsTable,
  incidentCorrelationsTable: mockIncidentCorrelationsTable,
  deviceEventsTable: mockDeviceEventsTable,
  managedDevicesTable: mockManagedDevicesTable,
  networkLinksTable: mockNetworkLinksTable,
  ticketUpdatesTable: mockTicketUpdatesTable,
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock('../ticket-number', () => ({
  getNextTicketNumber: vi.fn().mockResolvedValue('SA-1001'),
}));

describe('incident correlator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.select.mockImplementation((...args: unknown[]) => {
      if (args.length === 0) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        };
      }
      return {
        from: vi.fn().mockResolvedValue([{ ticketNumber: 'SA-1000' }]),
      };
    });
    mockDb.insert.mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'new-ticket-id' }]) }) });
  });

  it('skips informational events', async () => {
    const { correlateEvent } = await import('../incident-correlator');

    const result = await correlateEvent({
      eventId: 'event-1',
      controllerId: 'ctrl-1',
      customerId: 'cust-1',
      siteId: null,
      serviceId: null,
      managedDeviceId: null,
      severity: 'informational',
      eventType: 'device_checkin',
      title: 'Checkin',
      description: 'Device checkin',
    });

    expect(result.action).toBe('skipped');
    expect(result.reason).toContain('Informational');
  });

  it('creates a ticket when no matching open ticket exists', async () => {
    const { correlateEvent } = await import('../incident-correlator');

    const result = await correlateEvent({
      eventId: 'event-2',
      controllerId: 'ctrl-1',
      customerId: 'cust-1',
      siteId: 'site-1',
      serviceId: 'svc-1',
      managedDeviceId: 'device-1',
      severity: 'high',
      eventType: 'link_down',
      title: 'WAN link down',
      description: 'Primary link down',
    });

    expect(result.action).toBe('created');
    expect(result.ticketId).toBe('new-ticket-id');
    expect(result.ticketNumber).toBe('SA-1001');
  });

  it('attaches the event to an existing open ticket', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: 'existing-ticket', ticketNumber: 'SA-2001', siteId: 'site-1', serviceId: null }]),
        }),
      }),
    });

    const { correlateEvent } = await import('../incident-correlator');

    const result = await correlateEvent({
      eventId: 'event-3',
      controllerId: 'ctrl-1',
      customerId: 'cust-1',
      siteId: 'site-1',
      serviceId: null,
      managedDeviceId: null,
      severity: 'critical',
      eventType: 'router_offline',
      title: 'Router offline',
      description: 'Router is offline',
    });

    expect(result.action).toBe('attached');
    expect(result.ticketNumber).toBe('SA-2001');
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('writes controller classification context for failover-active events', async () => {
    const insertedPayloads: Array<Record<string, unknown>> = [];
    mockDb.insert.mockReturnValue({
      values: vi.fn((payload: Record<string, unknown>) => {
        insertedPayloads.push(payload);
        return { returning: vi.fn().mockResolvedValue([{ id: 'new-ticket-id' }]) };
      }),
    });

    const { correlateEvent } = await import('../incident-correlator');

    const result = await correlateEvent({
      eventId: 'event-4',
      controllerId: 'ctrl-1',
      customerId: 'cust-1',
      siteId: 'site-1',
      serviceId: null,
      managedDeviceId: 'device-1',
      severity: 'high',
      eventType: 'ha_failover',
      title: 'HA failover active',
      description: 'Primary down and backup active',
      failoverActive: true,
    });

    expect(result.action).toBe('created');
    expect(insertedPayloads.some((payload) => String(payload.rawText).includes('Controller incident classification: controller_impairment'))).toBe(true);
  });
});
