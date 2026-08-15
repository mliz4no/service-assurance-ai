import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import {
  db,
  customersTable,
  ticketUpdatesTable,
  ticketsTable,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../lib/auth';
import app from '../app';

const OPS_EMAIL = 'vitest-dashboard-ops@example.test';
const CUSTOMER_EMAIL = 'vitest-dashboard-customer@example.test';
const PASSWORD = 'vitest-dashboard-password';

async function cleanup(): Promise<void> {
  await db.delete(ticketUpdatesTable).where(like(ticketUpdatesTable.rawText, 'Vitest dashboard context%'));
  await db.delete(ticketsTable).where(like(ticketsTable.title, 'Vitest dashboard ticket%'));
  await db.delete(customersTable).where(like(customersTable.name, 'Vitest Dashboard Customer%'));
  await db.delete(usersTable).where(eq(usersTable.email, OPS_EMAIL));
  await db.delete(usersTable).where(eq(usersTable.email, CUSTOMER_EMAIL));
}

async function login(email: string, password: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe.sequential('dashboard outage context summary', () => {
  beforeAll(async () => {
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('aggregates monitoring and controller context counts for internal users', async () => {
    await db.insert(usersTable).values({
      name: 'Vitest Dashboard Ops',
      email: OPS_EMAIL,
      passwordHash: hashPassword(PASSWORD),
      role: 'ops',
    });

    const [customer] = await db
      .insert(customersTable)
      .values({ name: 'Vitest Dashboard Customer A', status: 'active' })
      .returning();

    const [monitoringTicket] = await db
      .insert(ticketsTable)
      .values({
        ticketNumber: 'SA-9101',
        customerId: customer.id,
        title: 'Vitest dashboard ticket monitoring',
        source: 'api',
        severity: 'high',
        status: 'new',
        outageType: 'outage',
      })
      .returning();

    const [controllerTicket] = await db
      .insert(ticketsTable)
      .values({
        ticketNumber: 'SA-9102',
        customerId: customer.id,
        title: 'Vitest dashboard ticket controller',
        source: 'controller',
        severity: 'high',
        status: 'investigating',
        outageType: 'outage',
      })
      .returning();

    await db.insert(ticketUpdatesTable).values([
      {
        ticketId: monitoringTicket.id,
        updateType: 'system_event',
        rawText:
          'Vitest dashboard context monitoring Classified as shared_outage; confidence=high; reason=sibling_outage; siblings=2, healthy=0, impaired=2.',
        visibility: 'internal',
      },
      {
        ticketId: controllerTicket.id,
        updateType: 'system_event',
        rawText:
          'Vitest dashboard context controller Controller incident classification: controller_outage; confidence=high; reason=event_type_outage.',
        visibility: 'internal',
      },
    ]);

    const token = await login(OPS_EMAIL, PASSWORD);
    const response = await request(app)
      .get('/api/dashboard/outage-context-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.totals.monitoring).toBe(1);
    expect(response.body.totals.controller).toBe(1);
    expect(response.body.monitoring.byClassification.shared_outage).toBe(1);
    expect(response.body.monitoring.byConfidence.high).toBe(1);
    expect(response.body.monitoring.byReasonCode.sibling_outage).toBe(1);
    expect(response.body.controller.byClassification.controller_outage).toBe(1);
    expect(response.body.controller.byConfidence.high).toBe(1);
    expect(response.body.controller.byReasonCode.event_type_outage).toBe(1);
  });

  it('scopes summary to the authenticated customer', async () => {
    const [customerA] = await db
      .insert(customersTable)
      .values({ name: 'Vitest Dashboard Customer A', status: 'active' })
      .returning();
    const [customerB] = await db
      .insert(customersTable)
      .values({ name: 'Vitest Dashboard Customer B', status: 'active' })
      .returning();

    await db.insert(usersTable).values({
      name: 'Vitest Dashboard Customer User',
      email: CUSTOMER_EMAIL,
      passwordHash: hashPassword(PASSWORD),
      role: 'customer',
      customerId: customerA.id,
    });

    const [ticketA] = await db
      .insert(ticketsTable)
      .values({
        ticketNumber: 'SA-9201',
        customerId: customerA.id,
        title: 'Vitest dashboard ticket customer-a',
        source: 'api',
        severity: 'high',
        status: 'new',
        outageType: 'outage',
      })
      .returning();

    const [ticketB] = await db
      .insert(ticketsTable)
      .values({
        ticketNumber: 'SA-9202',
        customerId: customerB.id,
        title: 'Vitest dashboard ticket customer-b',
        source: 'api',
        severity: 'high',
        status: 'new',
        outageType: 'outage',
      })
      .returning();

    await db.insert(ticketUpdatesTable).values([
      {
        ticketId: ticketA.id,
        updateType: 'system_event',
        rawText:
          'Vitest dashboard context monitoring Classified as isolated_issue; confidence=medium; reason=localized_failure; siblings=1, healthy=1, impaired=0.',
        visibility: 'internal',
      },
      {
        ticketId: ticketB.id,
        updateType: 'system_event',
        rawText:
          'Vitest dashboard context monitoring Classified as shared_outage; confidence=high; reason=sibling_outage; siblings=2, healthy=0, impaired=2.',
        visibility: 'internal',
      },
    ]);

    const token = await login(CUSTOMER_EMAIL, PASSWORD);
    const response = await request(app)
      .get('/api/dashboard/outage-context-summary')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.totals.monitoring).toBe(1);
    expect(response.body.monitoring.byClassification.isolated_issue).toBe(1);
    expect(response.body.monitoring.byClassification.shared_outage ?? 0).toBe(0);
  });

  it('returns drilldown ticket rows for a classification filter', async () => {
    await db.insert(usersTable).values({
      name: 'Vitest Dashboard Ops',
      email: OPS_EMAIL,
      passwordHash: hashPassword(PASSWORD),
      role: 'ops',
    });

    const [customer] = await db
      .insert(customersTable)
      .values({ name: 'Vitest Dashboard Customer Drilldown', status: 'active' })
      .returning();

    const [ticketA] = await db
      .insert(ticketsTable)
      .values({
        ticketNumber: 'SA-9301',
        customerId: customer.id,
        title: 'Vitest dashboard ticket drilldown-a',
        source: 'api',
        severity: 'high',
        status: 'new',
        outageType: 'outage',
      })
      .returning();

    const [ticketB] = await db
      .insert(ticketsTable)
      .values({
        ticketNumber: 'SA-9302',
        customerId: customer.id,
        title: 'Vitest dashboard ticket drilldown-b',
        source: 'api',
        severity: 'high',
        status: 'new',
        outageType: 'outage',
      })
      .returning();

    await db.insert(ticketUpdatesTable).values([
      {
        ticketId: ticketA.id,
        updateType: 'system_event',
        rawText:
          'Vitest dashboard context monitoring Classified as regional_outage; confidence=high; reason=external_signal_active; siblings=2, healthy=0, impaired=2.',
        visibility: 'internal',
      },
      {
        ticketId: ticketB.id,
        updateType: 'system_event',
        rawText:
          'Vitest dashboard context monitoring Classified as isolated_issue; confidence=medium; reason=localized_failure; siblings=1, healthy=1, impaired=0.',
        visibility: 'internal',
      },
    ]);

    const token = await login(OPS_EMAIL, PASSWORD);
    const response = await request(app)
      .get('/api/dashboard/outage-context-report?source=monitoring&classification=regional_outage')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].ticketNumber).toBe('SA-9301');
    expect(response.body[0].context.classification).toBe('regional_outage');
    expect(response.body[0].context.reasonCode).toBe('external_signal_active');
  });
});
