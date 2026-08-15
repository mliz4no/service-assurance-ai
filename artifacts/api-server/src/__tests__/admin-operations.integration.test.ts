import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, like } from 'drizzle-orm';
import {
  customerContactsTable,
  customersTable,
  db,
  escalationMatrixOverridesTable,
  slaPoliciesTable,
  telecomServicesPartnersTable,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../lib/auth';
import app from '../app';

const ADMIN_EMAIL = 'vitest-admin-operations@example.test';
const CUSTOMER_EMAIL = 'vitest-admin-customer@example.test';
const PASSWORD = 'vitest-admin-operations-password';

async function cleanup(): Promise<void> {
  const customers = await db
    .select({ id: customersTable.id })
    .from(customersTable)
    .where(like(customersTable.name, 'Vitest Admin Operations%'));
  for (const customer of customers) {
    await db
      .delete(escalationMatrixOverridesTable)
      .where(eq(escalationMatrixOverridesTable.scopeId, customer.id));
    await db.delete(customerContactsTable).where(eq(customerContactsTable.customerId, customer.id));
  }

  await db.delete(usersTable).where(like(usersTable.email, 'vitest-admin-%@example.test'));
  await db.delete(customersTable).where(like(customersTable.name, 'Vitest Admin Operations%'));
  await db
    .delete(telecomServicesPartnersTable)
    .where(like(telecomServicesPartnersTable.email, 'vitest-admin-%@example.test'));
  await db.delete(slaPoliciesTable).where(like(slaPoliciesTable.name, 'Vitest Admin Operations%'));
}

async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

async function setupUsers(): Promise<{ adminToken: string; customerToken: string; customerId: string }> {
  const [customer] = await db
    .insert(customersTable)
    .values({ name: 'Vitest Admin Operations Customer', status: 'active' })
    .returning();
  await db.insert(usersTable).values([
    {
      name: 'Vitest Admin Operations Admin',
      email: ADMIN_EMAIL,
      passwordHash: hashPassword(PASSWORD),
      role: 'admin',
    },
    {
      name: 'Vitest Admin Operations Customer User',
      email: CUSTOMER_EMAIL,
      passwordHash: hashPassword(PASSWORD),
      role: 'customer',
      customerId: customer.id,
    },
  ]);
  return {
    adminToken: await login(ADMIN_EMAIL),
    customerToken: await login(CUSTOMER_EMAIL),
    customerId: customer.id,
  };
}

describe.sequential('admin operations endpoints', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('manages users and enforces admin-only writes', async () => {
    const { adminToken, customerToken } = await setupUsers();
    const denied = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ name: 'Denied', email: 'denied@example.test', password: PASSWORD, role: 'ops' });
    expect(denied.status).toBe(403);

    const invalid = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Incomplete' });
    expect(invalid.status).toBe(400);

    const created = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Vitest Admin Managed User',
        email: 'vitest-admin-managed@example.test',
        password: PASSWORD,
        role: 'ops',
      });
    expect(created.status).toBe(201);
    expect(created.body).not.toHaveProperty('passwordHash');

    const listed = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    expect(listed.status).toBe(200);
    expect(listed.body.some((user: { id: string }) => user.id === created.body.id)).toBe(true);

    const updated = await request(app)
      .put(`/api/users/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Vitest Admin Managed User Updated', email: created.body.email, password: 'new-password', role: 'ops' });
    expect(updated.status).toBe(200);
    expect(updated.body.name).toContain('Updated');

    expect((await request(app).delete('/api/users/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
    expect((await request(app).delete(`/api/users/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });

  it('manages telecom partners and returns associated records', async () => {
    const { adminToken } = await setupUsers();
    expect((await request(app).post('/api/partners').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Missing fields' })).status).toBe(400);

    const created = await request(app)
      .post('/api/partners')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Vitest Partner Contact',
        companyName: 'Vitest Admin Operations Telecom',
        email: 'vitest-admin-partner@example.test',
        phone: '555-0100',
      });
    expect(created.status).toBe(201);

    await db.insert(customersTable).values({
      name: 'Vitest Admin Operations Partner Customer',
      status: 'active',
      telecomServicesPartnerId: created.body.id,
    });
    await db.insert(usersTable).values({
      name: 'Vitest Partner User',
      email: 'vitest-admin-partner-user@example.test',
      passwordHash: hashPassword(PASSWORD),
      role: 'partner',
      telecomServicesPartnerId: created.body.id,
    });

    const detail = await request(app)
      .get(`/api/partners/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.customers).toHaveLength(1);
    expect(detail.body.users).toHaveLength(1);

    expect((await request(app).get('/api/partners').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    const updated = await request(app)
      .put(`/api/partners/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...created.body, companyName: 'Vitest Admin Operations Telecom Updated', status: 'inactive' });
    expect(updated.body.status).toBe('inactive');
    expect((await request(app).get('/api/partners/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
  });

  it('manages customer contacts and enforces customer scope', async () => {
    const { adminToken, customerToken, customerId } = await setupUsers();
    expect((await request(app).post(`/api/customers/${customerId}/contacts`).set('Authorization', `Bearer ${customerToken}`).send({})).status).toBe(403);
    expect((await request(app).post(`/api/customers/${customerId}/contacts`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Incomplete' })).status).toBe(400);

    const created = await request(app)
      .post(`/api/customers/${customerId}/contacts`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Vitest NOC', email: 'noc@example.test', role: 'noc', notifyOnSeverity: 'high' });
    expect(created.status).toBe(201);

    const listed = await request(app)
      .get(`/api/customers/${customerId}/contacts`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(listed.body).toHaveLength(1);
    expect((await request(app).get('/api/customers/00000000-0000-0000-0000-000000000099/contacts').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);

    const updated = await request(app)
      .put(`/api/customers/${customerId}/contacts/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...created.body, role: 'manager', notifyOnSeverity: 'critical', notificationChannels: 'email,webhook' });
    expect(updated.body.role).toBe('manager');
    expect((await request(app).delete(`/api/customers/${customerId}/contacts/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });

  it('manages SLA policies including validation and missing records', async () => {
    const { adminToken, customerToken } = await setupUsers();
    expect((await request(app).post('/api/sla-policies').set('Authorization', `Bearer ${customerToken}`).send({})).status).toBe(403);
    expect((await request(app).post('/api/sla-policies').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Missing severity' })).status).toBe(400);

    const created = await request(app)
      .post('/api/sla-policies')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Vitest Admin Operations Critical SLA', severity: 'critical', initialResponseMinutes: 5, escalationMinutes: 15, resolutionTargetMinutes: 60, isDefault: false });
    expect(created.status).toBe(201);
    expect((await request(app).get('/api/sla-policies').set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);

    const updated = await request(app)
      .put(`/api/sla-policies/${created.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...created.body, escalationMinutes: 10, isDefault: true });
    expect(updated.body.escalationMinutes).toBe(10);
    expect((await request(app).delete('/api/sla-policies/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
    expect((await request(app).delete(`/api/sla-policies/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });

  it('validates and persists customer escalation matrix overrides', async () => {
    const { adminToken, customerToken, customerId } = await setupUsers();
    expect((await request(app).get('/api/escalation-matrix').set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    expect((await request(app).get('/api/escalation-matrix?scopeType=invalid').set('Authorization', `Bearer ${adminToken}`)).status).toBe(400);
    expect((await request(app).get('/api/escalation-matrix?scopeType=customer').set('Authorization', `Bearer ${adminToken}`)).status).toBe(400);
    expect((await request(app).put('/api/escalation-matrix').set('Authorization', `Bearer ${adminToken}`).send({ scopeType: 'customer', scopeId: customerId, cells: [] })).status).toBe(400);

    const saved = await request(app)
      .put('/api/escalation-matrix')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        scopeType: 'customer',
        scopeId: customerId,
        cells: [{ impactLevel: 'low', urgencyLevel: 'low', derivedSeverity: 'critical' }],
      });
    expect(saved.status).toBe(200);
    expect(saved.body.cells.find((cell: { impactLevel: string; urgencyLevel: string }) => cell.impactLevel === 'low' && cell.urgencyLevel === 'low').derivedSeverity).toBe('critical');

    const [override] = await db
      .select()
      .from(escalationMatrixOverridesTable)
      .where(eq(escalationMatrixOverridesTable.scopeId, customerId));
    expect((await request(app).delete(`/api/escalation-matrix/override/${override.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).delete('/api/escalation-matrix/override/00000000-0000-0000-0000-000000000099').set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
  });
});