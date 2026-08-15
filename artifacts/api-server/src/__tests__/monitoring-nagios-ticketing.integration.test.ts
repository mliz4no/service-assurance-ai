import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import {
  db,
  customersTable,
  monitoredTargetsTable,
  servicesTable,
  sitesTable,
  ticketUpdatesTable,
  ticketsTable,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../lib/auth';

const { mockLookupExternalOutageSignal } = vi.hoisted(() => ({
  mockLookupExternalOutageSignal: vi.fn(async (): Promise<Record<string, unknown> | null> => null),
}));

vi.mock('../lib/nagios', () => ({
  syncNagiosChecks: vi.fn(async (targets: Array<{ id: string }>) =>
    targets.map((target) => ({
      targetId: target.id,
      source: 'nagios' as const,
      checkType: 'tcp' as const,
      status: 'down' as const,
      responseTimeMs: 88,
      payload: { kind: 'host', pluginOutput: 'CRITICAL - host unreachable' },
    })),
  ),
}));

vi.mock('../lib/external-outage-signal', () => ({
  lookupExternalOutageSignal: mockLookupExternalOutageSignal,
}));

import app from '../app';

const OPS_EMAIL = 'vitest-nagios-ops@example.test';
const OPS_PASSWORD = 'vitest-nagios-password';

async function cleanup(): Promise<void> {
  await db
    .delete(monitoredTargetsTable)
    .where(and(like(monitoredTargetsTable.name, 'vitest-nagios-target-%')));

  await db
    .delete(ticketsTable)
    .where(like(ticketsTable.vendorTicketId, 'monitoring-target:%'));

  await db
    .delete(servicesTable)
    .where(and(like(servicesTable.vendorName, 'Vitest Nagios%')));

  await db
    .delete(sitesTable)
    .where(and(like(sitesTable.siteName, 'Vitest Nagios Site%')));

  await db
    .delete(customersTable)
    .where(and(like(customersTable.name, 'Vitest Nagios Customer%')));

  await db.delete(usersTable).where(eq(usersTable.email, OPS_EMAIL));
}

async function getOpsToken(): Promise<string> {
  await db.insert(usersTable).values({
    name: 'Vitest Nagios Ops',
    email: OPS_EMAIL,
    passwordHash: hashPassword(OPS_PASSWORD),
    role: 'ops',
  });

  const login = await request(app).post('/api/auth/login').send({
    email: OPS_EMAIL,
    password: OPS_PASSWORD,
  });

  expect(login.status).toBe(200);
  return login.body.token as string;
}

describe.sequential('monitoring Nagios sync and ticket dedupe', () => {
  beforeAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
    mockLookupExternalOutageSignal.mockReset();
    mockLookupExternalOutageSignal.mockResolvedValue(null);
  });

  afterAll(async () => {
    await cleanup();
  });

  it('creates one ticket on first Nagios failure and reuses it on repeat sync', async () => {
    const token = await getOpsToken();

    const [customer] = await db
      .insert(customersTable)
      .values({
        name: 'Vitest Nagios Customer A',
        status: 'active',
      })
      .returning();

    const [site] = await db
      .insert(sitesTable)
      .values({
        customerId: customer.id,
        siteName: 'Vitest Nagios Site A',
      })
      .returning();

    const [service] = await db
      .insert(servicesTable)
      .values({
        customerId: customer.id,
        siteId: site.id,
        vendorName: 'Vitest Nagios Carrier',
        serviceType: 'DIA',
        status: 'active',
      })
      .returning();

    const [target] = await db
      .insert(monitoredTargetsTable)
      .values({
        name: 'vitest-nagios-target-a',
        hostOrIp: '198.51.100.201',
        targetType: 'ip',
        customerId: customer.id,
        siteId: site.id,
        serviceId: service.id,
      })
      .returning();

    await db.insert(monitoredTargetsTable).values({
      name: 'vitest-nagios-target-sibling-down',
      hostOrIp: '198.51.100.202',
      targetType: 'ip',
      customerId: customer.id,
      siteId: site.id,
      serviceId: service.id,
      status: 'down',
      statusSource: 'nagios',
    });

    const first = await request(app)
      .post('/api/monitoring/checks/nagios-sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetIds: [target.id] });

    expect(first.status).toBe(200);
    expect(first.body.processed).toBe(1);
    expect(first.body.createdTickets).toBe(1);
    expect(first.body.updatedTickets).toBe(0);
    expect(first.body.results[0].ticketAction).toBe('created');
    expect(first.body.results[0].outageClassification).toBe('shared_outage');

    const ticketsAfterFirst = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.vendorTicketId, `monitoring-target:${target.id}`));
    expect(ticketsAfterFirst).toHaveLength(1);
    expect(ticketsAfterFirst[0].customerId).toBe(customer.id);
    expect(ticketsAfterFirst[0].siteId).toBe(site.id);
    expect(ticketsAfterFirst[0].serviceId).toBe(service.id);
    expect(ticketsAfterFirst[0].status).toBe('new');

    const second = await request(app)
      .post('/api/monitoring/checks/nagios-sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetIds: [target.id] });

    expect(second.status).toBe(200);
    expect(second.body.createdTickets).toBe(0);
    expect(second.body.updatedTickets).toBe(1);
    expect(second.body.results[0].ticketAction).toBe('updated');
    expect(second.body.results[0].outageClassification).toBe('shared_outage');

    const ticketsAfterSecond = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.vendorTicketId, `monitoring-target:${target.id}`));
    expect(ticketsAfterSecond).toHaveLength(1);

    const updates = await db
      .select()
      .from(ticketUpdatesTable)
      .where(eq(ticketUpdatesTable.ticketId, ticketsAfterSecond[0].id));
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(
      updates.some((u: typeof ticketUpdatesTable.$inferSelect) => u.rawText.includes('shared_outage')),
    ).toBe(true);

    const listResponse = await request(app)
      .get(`/api/tickets?customerId=${customer.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(listResponse.status).toBe(200);
    const listed = (listResponse.body as Array<{ id: string; monitoringContext: { classification: string } | null }>).find(
      (t) => t.id === ticketsAfterSecond[0].id,
    );
    expect(listed?.monitoringContext?.classification).toBe('shared_outage');

    const detailResponse = await request(app)
      .get(`/api/tickets/${ticketsAfterSecond[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.monitoringContext?.classification).toBe('shared_outage');
  });

  it('classifies target failure as isolated_issue when siblings are healthy', async () => {
    const token = await getOpsToken();

    const [customer] = await db
      .insert(customersTable)
      .values({
        name: 'Vitest Nagios Customer B',
        status: 'active',
      })
      .returning();

    const [site] = await db
      .insert(sitesTable)
      .values({
        customerId: customer.id,
        siteName: 'Vitest Nagios Site B',
      })
      .returning();

    const [service] = await db
      .insert(servicesTable)
      .values({
        customerId: customer.id,
        siteId: site.id,
        vendorName: 'Vitest Nagios Carrier B',
        serviceType: 'DIA',
        status: 'active',
      })
      .returning();

    const [target] = await db
      .insert(monitoredTargetsTable)
      .values({
        name: 'vitest-nagios-target-isolated',
        hostOrIp: '198.51.100.211',
        targetType: 'ip',
        customerId: customer.id,
        siteId: site.id,
        serviceId: service.id,
      })
      .returning();

    await db.insert(monitoredTargetsTable).values({
      name: 'vitest-nagios-target-sibling-up',
      hostOrIp: '198.51.100.212',
      targetType: 'ip',
      customerId: customer.id,
      siteId: site.id,
      serviceId: service.id,
      status: 'up',
      statusSource: 'manual',
    });

    const sync = await request(app)
      .post('/api/monitoring/checks/nagios-sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetIds: [target.id] });

    expect(sync.status).toBe(200);
    expect(sync.body.processed).toBe(1);
    expect(sync.body.results[0].outageClassification).toBe('isolated_issue');

    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.vendorTicketId, `monitoring-target:${target.id}`));
    expect(ticket).toBeTruthy();
    if (!ticket) {
      throw new Error('Expected ticket to be created for isolated classification scenario');
    }

    const detailResponse = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.monitoringContext?.classification).toBe('isolated_issue');
  });

  it('classifies target failure as regional_outage when external signal is active', async () => {
    mockLookupExternalOutageSignal.mockResolvedValueOnce({
      active: true,
      source: 'poweroutage',
      incidentId: 'out-500',
      summary: 'Regional utility outage',
      region: 'north-east',
      provider: 'Vitest Provider',
    });

    const token = await getOpsToken();

    const [customer] = await db
      .insert(customersTable)
      .values({
        name: 'Vitest Nagios Customer C',
        status: 'active',
      })
      .returning();

    const [site] = await db
      .insert(sitesTable)
      .values({
        customerId: customer.id,
        siteName: 'Vitest Nagios Site C',
      })
      .returning();

    const [service] = await db
      .insert(servicesTable)
      .values({
        customerId: customer.id,
        siteId: site.id,
        vendorName: 'Vitest Nagios Carrier C',
        serviceType: 'DIA',
        status: 'active',
      })
      .returning();

    const [target] = await db
      .insert(monitoredTargetsTable)
      .values({
        name: 'vitest-nagios-target-regional',
        hostOrIp: '198.51.100.221',
        targetType: 'ip',
        customerId: customer.id,
        siteId: site.id,
        serviceId: service.id,
        region: 'north-east',
        provider: 'Vitest Provider',
      })
      .returning();

    const sync = await request(app)
      .post('/api/monitoring/checks/nagios-sync')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetIds: [target.id] });

    expect(sync.status).toBe(200);
    expect(sync.body.processed).toBe(1);
    expect(sync.body.results[0].outageClassification).toBe('regional_outage');

    const [ticket] = await db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.vendorTicketId, `monitoring-target:${target.id}`));
    expect(ticket).toBeTruthy();
    if (!ticket) {
      throw new Error('Expected ticket to be created for regional classification scenario');
    }

    const detailResponse = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.body.monitoringContext?.classification).toBe('regional_outage');
  });
});