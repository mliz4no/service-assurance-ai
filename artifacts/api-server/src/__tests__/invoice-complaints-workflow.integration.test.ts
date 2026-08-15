import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import {
  customersTable,
  db,
  invoiceComplaintEventsTable,
  invoiceComplaintsTable,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../lib/auth';

const avalara = vi.hoisted(() => ({
  validateInvoice: vi.fn(),
}));

vi.mock('../connectors/avalara', () => avalara);

import app from '../app';

const PASSWORD = 'vitest-invoice-password';

async function cleanup(): Promise<void> {
  const complaints = await db
    .select({ id: invoiceComplaintsTable.id })
    .from(invoiceComplaintsTable)
    .where(like(invoiceComplaintsTable.title, 'Vitest Invoice%'));
  for (const complaint of complaints) {
    await db
      .delete(invoiceComplaintEventsTable)
      .where(eq(invoiceComplaintEventsTable.complaintId, complaint.id));
  }
  await db
    .delete(invoiceComplaintsTable)
    .where(like(invoiceComplaintsTable.title, 'Vitest Invoice%'));
  await db.delete(usersTable).where(like(usersTable.email, 'vitest-invoice-%@example.test'));
  await db.delete(customersTable).where(like(customersTable.name, 'Vitest Invoice%'));
  avalara.validateInvoice.mockReset();
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
      { name: 'Vitest Invoice Customer', accountNumber: 'CUST-100', status: 'active' },
      { name: 'Vitest Invoice Other Customer', accountNumber: 'CUST-200', status: 'active' },
    ])
    .returning();
  const users = await db
    .insert(usersTable)
    .values([
      { name: 'Vitest Invoice Admin', email: 'vitest-invoice-admin@example.test', passwordHash: hashPassword(PASSWORD), role: 'admin' },
      { name: 'Vitest Invoice Assignee', email: 'vitest-invoice-assignee@example.test', passwordHash: hashPassword(PASSWORD), role: 'ops' },
      { name: 'Vitest Invoice Customer User', email: 'vitest-invoice-customer@example.test', passwordHash: hashPassword(PASSWORD), role: 'customer', customerId: customer.id },
      { name: 'Vitest Invoice Other User', email: 'vitest-invoice-other@example.test', passwordHash: hashPassword(PASSWORD), role: 'customer', customerId: otherCustomer.id },
    ])
    .returning();
  return {
    customer,
    otherCustomer,
    assignee: users[1],
    adminToken: await login('vitest-invoice-admin@example.test'),
    customerToken: await login('vitest-invoice-customer@example.test'),
    otherToken: await login('vitest-invoice-other@example.test'),
  };
}

async function createComplaint(token: string, customerId: string, extras: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/invoice-complaints')
    .set('Authorization', `Bearer ${token}`)
    .send({
      customerId,
      title: 'Vitest Invoice Tax Mismatch',
      description: 'Tax charged does not match the expected amount.',
      invoiceNumber: 'INV-100',
      customerAccountNumber: 'CUST-100',
      complaintType: 'tax_mismatch',
      priority: 'high',
      invoiceAmount: 125,
      companyCode: 'COMPANY',
      ...extras,
    });
}

describe.sequential('invoice complaint workflow', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('validates creation and enforces write permissions', async () => {
    const { customer, adminToken, customerToken } = await setup();
    expect((await createComplaint(customerToken, customer.id)).status).toBe(403);
    expect((await request(app).post('/api/invoice-complaints').set('Authorization', `Bearer ${adminToken}`).send({ title: 'Incomplete' })).status).toBe(400);
    expect((await createComplaint(adminToken, customer.id, { complaintType: 'unsupported' })).status).toBe(400);
    expect((await createComplaint(adminToken, customer.id, { priority: 'urgent' })).status).toBe(400);

    const created = await createComplaint(adminToken, customer.id);
    expect(created.status).toBe(201);
    expect(created.body.complaintNumber).toMatch(/^IC-/);
    const second = await createComplaint(adminToken, customer.id, { title: 'Vitest Invoice Duplicate Charge', invoiceNumber: 'INV-101', complaintType: 'duplicate_charge', priority: 'medium' });
    expect(Number(second.body.complaintNumber.slice(3))).toBe(Number(created.body.complaintNumber.slice(3)) + 1);
  });

  it('filters and scopes complaint lists and details to customers', async () => {
    const { customer, otherCustomer, adminToken, customerToken, otherToken } = await setup();
    const first = await createComplaint(adminToken, customer.id);
    await createComplaint(adminToken, otherCustomer.id, { title: 'Vitest Invoice Other Account', invoiceNumber: 'INV-200', customerAccountNumber: 'CUST-200', priority: 'low', complaintType: 'other' });

    const filtered = await request(app)
      .get(`/api/invoice-complaints?customerId=${customer.id}&status=new&priority=high&complaintType=tax_mismatch&search=INV-100`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].customer.name).toBe(customer.name);

    const customerList = await request(app)
      .get('/api/invoice-complaints')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(customerList.body).toHaveLength(1);

    const detail = await request(app)
      .get(`/api/invoice-complaints/${first.body.id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.events[0].eventType).toBe('created');
    expect((await request(app).get(`/api/invoice-complaints/${first.body.id}`).set('Authorization', `Bearer ${otherToken}`)).status).toBe(403);
    expect((await request(app).get('/api/invoice-complaints/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
  });

  it('records status, assignment, and note timeline events', async () => {
    const { customer, assignee, adminToken, customerToken, otherToken } = await setup();
    const created = await createComplaint(adminToken, customer.id);

    expect((await request(app).patch(`/api/invoice-complaints/${created.body.id}`).set('Authorization', `Bearer ${customerToken}`).send({ status: 'triaged' })).status).toBe(403);
    const updated = await request(app)
      .patch(`/api/invoice-complaints/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'triaged', assignedToUserId: assignee.id, description: 'Triaged by operations' });
    expect(updated.body).toMatchObject({ status: 'triaged', assignedToUserId: assignee.id });

    expect((await request(app).post(`/api/invoice-complaints/${created.body.id}/events`).set('Authorization', `Bearer ${customerToken}`).send({})).status).toBe(400);
    expect((await request(app).post(`/api/invoice-complaints/${created.body.id}/events`).set('Authorization', `Bearer ${otherToken}`).send({ message: 'Forbidden note' })).status).toBe(403);
    const note = await request(app)
      .post(`/api/invoice-complaints/${created.body.id}/events`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ message: 'Customer supplied supporting invoice.', metadata: { attachmentCount: 1 } });
    expect(note.status).toBe(201);

    const detail = await request(app)
      .get(`/api/invoice-complaints/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.events.map((event: { eventType: string }) => event.eventType)).toEqual(expect.arrayContaining(['created', 'status_changed', 'assignment_changed', 'note']));
    expect((await request(app).patch('/api/invoice-complaints/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`).send({ status: 'closed' })).status).toBe(404);
    expect((await request(app).post('/api/invoice-complaints/00000000-0000-0000-0000-000000000099/events').set('Authorization', `Bearer ${adminToken}`).send({ message: 'Missing' })).status).toBe(404);
  });

  it('persists successful and failed Avalara validation outcomes', async () => {
    const { customer, adminToken, customerToken } = await setup();
    const created = await createComplaint(adminToken, customer.id);
    expect((await request(app).post(`/api/invoice-complaints/${created.body.id}/validate`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);

    avalara.validateInvoice.mockResolvedValueOnce({
      companyCode: 'COMPANY', documentCode: 'INV-100', customerCode: 'CUST-100', totalAmount: 125,
      totalTax: 10, currencyCode: 'USD', status: 'Posted', matchesInvoiceNumber: true,
      matchesCustomerAccountNumber: true,
    });
    const validated = await request(app)
      .post(`/api/invoice-complaints/${created.body.id}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(validated.status).toBe(200);
    expect(validated.body.complaint.avalaraValidationStatus).toBe('validated');

    avalara.validateInvoice.mockRejectedValueOnce(new Error('Avalara temporarily unavailable'));
    const failed = await request(app)
      .post(`/api/invoice-complaints/${created.body.id}/validate`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(failed.status).toBe(502);
    expect(failed.body.complaint.avalaraValidationStatus).toBe('failed');
    expect((await request(app).post('/api/invoice-complaints/00000000-0000-0000-0000-000000000099/validate').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
  });
});