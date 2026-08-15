import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import {
  customerContactsTable,
  customersTable,
  db,
  escalationNotificationsTable,
  slaPoliciesTable,
  ticketUpdatesTable,
  ticketsTable,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../lib/auth';

const delivery = vi.hoisted(() => ({
  deliverAlert: vi.fn(async () => ({ status: 'sent' as const, channel: 'email' as const })),
}));

vi.mock('../lib/notification-delivery', () => delivery);
vi.mock('../lib/ai', async () => {
  const actual = await vi.importActual<typeof import('../lib/ai')>('../lib/ai');
  return {
    ...actual,
    summarizeTicket: vi.fn(async () => ({ summary: 'Vitest ticket summary', confidence: 88, keyDetails: ['Primary circuit down'], sourceText: 'source' })),
    normalizeStatus: vi.fn(async () => ({ status: 'monitoring', confidence: 91, reasoning: 'Service restored and under observation', sourceText: 'vendor restored' })),
    generateCustomerUpdate: vi.fn(async () => ({ update: 'Service is restored and being monitored.', confidence: 90, containsETA: false, sourceText: 'source' })),
  };
});

import app from '../app';

const PASSWORD = 'vitest-ticket-workflow-password';

async function cleanup(): Promise<void> {
  const tickets = await db
    .select({ id: ticketsTable.id })
    .from(ticketsTable)
    .where(like(ticketsTable.title, 'Vitest Ticket Workflow%'));
  for (const ticket of tickets) {
    await db.delete(escalationNotificationsTable).where(eq(escalationNotificationsTable.ticketId, ticket.id));
    await db.delete(ticketUpdatesTable).where(eq(ticketUpdatesTable.ticketId, ticket.id));
  }
  await db.delete(ticketsTable).where(like(ticketsTable.title, 'Vitest Ticket Workflow%'));
  const customers = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(like(customersTable.name, 'Vitest Ticket Workflow%'));
  for (const customer of customers) {
    await db.delete(customerContactsTable).where(eq(customerContactsTable.customerId, customer.id));
  }
  await db.delete(usersTable).where(like(usersTable.email, 'vitest-ticket-%@example.test'));
  await db.delete(customersTable).where(like(customersTable.name, 'Vitest Ticket Workflow%'));
  await db.delete(slaPoliciesTable).where(like(slaPoliciesTable.name, 'Vitest Ticket Workflow%'));
  delivery.deliverAlert.mockClear();
}

async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

async function setup() {
  const [customer, otherCustomer] = await db
    .insert(customersTable)
    .values([
      { name: 'Vitest Ticket Workflow Customer', status: 'active' },
      { name: 'Vitest Ticket Workflow Other Customer', status: 'active' },
    ])
    .returning();
  const [admin, customerUser, otherUser] = await db
    .insert(usersTable)
    .values([
      { name: 'Vitest Ticket Admin', email: 'vitest-ticket-admin@example.test', passwordHash: hashPassword(PASSWORD), role: 'admin' },
      { name: 'Vitest Ticket Customer', email: 'vitest-ticket-customer@example.test', passwordHash: hashPassword(PASSWORD), role: 'customer', customerId: customer.id },
      { name: 'Vitest Ticket Other', email: 'vitest-ticket-other@example.test', passwordHash: hashPassword(PASSWORD), role: 'customer', customerId: otherCustomer.id },
    ])
    .returning();
  await db.insert(slaPoliciesTable).values({
    name: 'Vitest Ticket Workflow Critical SLA', severity: 'critical', initialResponseMinutes: 5,
    escalationMinutes: 10, resolutionTargetMinutes: 60, isDefault: true,
  });
  return {
    customer,
    admin,
    adminToken: await login(admin.email),
    customerToken: await login(customerUser.email),
    otherToken: await login(otherUser.email),
  };
}

async function createTicket(token: string, customerId: string, extras: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/tickets')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId,
      title: 'Vitest Ticket Workflow Circuit Outage',
      description: 'Primary circuit is unavailable.',
      source: 'manual',
      severity: 'high',
      outageType: 'outage',
      impactLevel: 'high',
      urgencyLevel: 'high',
      ...extras,
    });
}

describe.sequential('ticket and escalation workflow', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('validates creation, derives severity, applies SLA, and filters lists', async () => {
    const { customer, adminToken, customerToken } = await setup();
    expect((await createTicket(customerToken, customer.id)).status).toBe(403);
    expect((await request(app).post('/api/tickets').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Incomplete' })).status).toBe(400);
    expect((await createTicket(adminToken, customer.id, { severity: 'invalid', impactLevel: null, urgencyLevel: null })).status).toBe(400);
    expect((await createTicket(adminToken, customer.id, { source: 'invalid' })).status).toBe(400);
    expect((await createTicket(adminToken, customer.id, { outageType: 'invalid' })).status).toBe(400);

    const created = await createTicket(adminToken, customer.id, { vendorTicketId: 'VENDOR-100' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ severity: 'critical', slaTargetMinutes: 60 });
    expect(created.body.nextEscalationAt).toBeTruthy();

    const list = await request(app)
      .get(`/api/tickets?customerId=${customer.id}&status=new&severity=critical&search=VENDOR-100&sortBy=nextEscalationAt&sortOrder=asc`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.body).toHaveLength(1);

    const customerList = await request(app).get('/api/tickets').set('Authorization', `Bearer ${customerToken}`);
    expect(customerList.body).toHaveLength(1);
  });

  it('enforces detail visibility and manages customer-safe updates', async () => {
    const { customer, adminToken, customerToken, otherToken } = await setup();
    const created = await createTicket(adminToken, customer.id);
    const id = created.body.id as string;

    expect((await request(app).get(`/api/tickets/${id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(403);
    expect((await request(app).get('/api/tickets/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
    expect((await request(app).post(`/api/tickets/${id}/updates`).set('Authorization', `Bearer ${adminToken}`).send({ rawText: 'Incomplete' })).status).toBe(400);
    expect((await request(app).post(`/api/tickets/${id}/updates`).set('Authorization', `Bearer ${customerToken}`).send({ updateType: 'internal_note', rawText: 'Private', visibility: 'internal' })).status).toBe(403);

    await request(app)
      .post(`/api/tickets/${id}/updates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ updateType: 'internal_note', rawText: 'Internal investigation detail', visibility: 'internal' });
    await request(app)
      .post(`/api/tickets/${id}/updates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ updateType: 'vendor_update', rawText: 'Carrier restored service', normalizedStatus: 'monitoring', visibility: 'customer' });

    const customerUpdates = await request(app)
      .get(`/api/tickets/${id}/updates`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customerUpdates.body).toHaveLength(1);
    expect(customerUpdates.body[0].visibility).toBe('customer');

    const detail = await request(app).get(`/api/tickets/${id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.updates.length).toBeGreaterThanOrEqual(3);
    expect(detail.body.customer.name).toBe(customer.name);
  });

  it('runs all ticket AI operations and resolves the ticket', async () => {
    const { customer, adminToken, customerToken } = await setup();
    const created = await createTicket(adminToken, customer.id);
    const id = created.body.id as string;
    await request(app)
      .post(`/api/tickets/${id}/updates`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ updateType: 'vendor_update', rawText: 'Carrier restored service', visibility: 'customer' });

    expect((await request(app).post(`/api/tickets/${id}/ai/summarize`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    const summary = await request(app).post(`/api/tickets/${id}/ai/summarize`).set('Authorization', `Bearer ${adminToken}`);
    expect(summary.body).toMatchObject({ summary: 'Vitest ticket summary', confidence: 88 });

    const normalized = await request(app).post(`/api/tickets/${id}/ai/normalize-latest-update`).set('Authorization', `Bearer ${adminToken}`);
    expect(normalized.body.normalizedStatus).toBe('monitoring');
    const customerUpdate = await request(app).post(`/api/tickets/${id}/ai/generate-customer-update`).set('Authorization', `Bearer ${adminToken}`);
    expect(customerUpdate.body.customerUpdate).toContain('restored');

    const resolved = await request(app)
      .put(`/api/tickets/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'resolved', severity: 'high', impactLevel: 'medium', urgencyLevel: 'medium' });
    expect(resolved.body).toMatchObject({ status: 'resolved', severity: 'medium' });
    expect(resolved.body.resolvedAt).toBeTruthy();
    expect((await request(app).put(`/api/tickets/${id}`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'closed' })).status).toBe(403);
    expect((await request(app).put('/api/tickets/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`).send({ status: 'closed' })).status).toBe(404);
  });

  it('delivers and deduplicates severity and duration escalation notifications', async () => {
    const { customer, adminToken, customerToken } = await setup();
    const created = await createTicket(adminToken, customer.id, { severity: 'high', impactLevel: null, urgencyLevel: null });
    const id = created.body.id as string;
    await db.update(ticketsTable).set({ openedAt: new Date(Date.now() - 120_000) }).where(eq(ticketsTable.id, id));
    await db.insert(customerContactsTable).values([
      { customerId: customer.id, name: 'Critical NOC', email: 'noc@example.test', role: 'noc', notifyOnSeverity: 'high', notificationChannels: 'email' },
      { customerId: customer.id, name: 'Duration Manager', email: 'manager@example.test', role: 'manager', notifyOnSeverity: 'critical', notifyOnDurationMinutes: 1, notificationChannels: 'email' },
    ]);

    expect((await request(app).post(`/api/tickets/${id}/evaluate-escalation`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    const evaluated = await request(app).post(`/api/tickets/${id}/evaluate-escalation`).set('Authorization', `Bearer ${adminToken}`);
    expect(evaluated.body.notified).toBe(2);
    expect(delivery.deliverAlert).toHaveBeenCalledTimes(2);

    const repeated = await request(app).post(`/api/tickets/${id}/evaluate-escalation`).set('Authorization', `Bearer ${adminToken}`);
    expect(repeated.body.notified).toBe(0);
    const notifications = await request(app).get(`/api/tickets/${id}/notifications`).set('Authorization', `Bearer ${adminToken}`);
    expect(notifications.body).toHaveLength(2);
    expect(notifications.body.every((item: { status: string }) => item.status === 'sent')).toBe(true);

    await db.update(ticketsTable).set({ status: 'closed' }).where(eq(ticketsTable.id, id));
    const closed = await request(app).post(`/api/tickets/${id}/evaluate-escalation`).set('Authorization', `Bearer ${adminToken}`);
    expect(closed.body.message).toContain('resolved/closed');
    expect((await request(app).post('/api/tickets/00000000-0000-0000-0000-000000000099/evaluate-escalation').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
  });
});