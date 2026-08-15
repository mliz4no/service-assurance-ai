import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { like } from 'drizzle-orm';
import { customersTable, db, servicesTable, sitesTable, usersTable } from '@workspace/db';
import { hashPassword } from '../lib/auth';
import app from '../app';

const PASSWORD = 'vitest-inventory-password';

async function cleanup(): Promise<void> {
  await db.delete(servicesTable).where(like(servicesTable.vendorName, 'Vitest Inventory%'));
  await db.delete(sitesTable).where(like(sitesTable.siteName, 'Vitest Inventory%'));
  await db.delete(usersTable).where(like(usersTable.email, 'vitest-inventory-%@example.test'));
  await db.delete(customersTable).where(like(customersTable.name, 'Vitest Inventory%'));
}

async function login(email: string): Promise<string> {
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe.sequential('customer site and service inventory lifecycle', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('creates, enriches, scopes, updates, and deletes inventory records', async () => {
    await db.insert(usersTable).values({
      name: 'Vitest Inventory Admin', email: 'vitest-inventory-admin@example.test',
      passwordHash: hashPassword(PASSWORD), role: 'admin',
    });
    const adminToken = await login('vitest-inventory-admin@example.test');

    expect((await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Missing status' })).status).toBe(400);
    expect((await request(app).post('/api/customers').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Invalid', status: 'pending' })).status).toBe(400);
    const customer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Vitest Inventory Customer', accountNumber: 'INV-CUST-1', status: 'active', notes: 'Internal inventory test' });
    expect(customer.status).toBe(201);

    await db.insert(usersTable).values({
      name: 'Vitest Inventory Customer User', email: 'vitest-inventory-customer@example.test',
      passwordHash: hashPassword(PASSWORD), role: 'customer', customerId: customer.body.id,
    });
    const customerToken = await login('vitest-inventory-customer@example.test');
    expect((await request(app).post('/api/sites').set('Authorization', `Bearer ${customerToken}`).send({})).status).toBe(403);
    expect((await request(app).post('/api/sites').set('Authorization', `Bearer ${adminToken}`).send({ customerId: customer.body.id })).status).toBe(400);

    const site = await request(app)
      .post('/api/sites')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.body.id, siteName: 'Vitest Inventory Chicago', siteCode: 'CHI-01',
        address1: '100 Test Ave', city: 'Chicago', state: 'IL', postalCode: '60601', country: 'US',
        timezone: 'America/Chicago', latitude: 41.88, longitude: -87.63, geoSource: 'manual',
      });
    expect(site.status).toBe(201);

    expect((await request(app).post('/api/services').set('Authorization', `Bearer ${adminToken}`).send({ customerId: customer.body.id })).status).toBe(400);
    expect((await request(app).post('/api/services').set('Authorization', `Bearer ${adminToken}`).send({ customerId: customer.body.id, siteId: site.body.id, vendorName: 'Invalid', serviceType: 'Satellite', status: 'active' })).status).toBe(400);
    expect((await request(app).post('/api/services').set('Authorization', `Bearer ${adminToken}`).send({ customerId: customer.body.id, siteId: site.body.id, vendorName: 'Invalid', serviceType: 'DIA', status: 'invalid' })).status).toBe(400);

    const service = await request(app)
      .post('/api/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.body.id, siteId: site.body.id, vendorName: 'Vitest Inventory Carrier',
        serviceType: 'DIA', circuitId: 'INV-CIRCUIT-1', bandwidth: '1 Gbps', status: 'active',
        monthlyRecurringCharge: 500, supportReference: 'SUPPORT-1',
      });
    expect(service.status).toBe(201);

    const customerList = await request(app)
      .get('/api/customers?search=INV-CUST-1&status=active')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(customerList.body).toHaveLength(1);
    const sites = await request(app)
      .get(`/api/sites?customerId=${customer.body.id}&search=CHI-01`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(sites.body[0].customer.name).toBe(customer.body.name);
    const services = await request(app)
      .get(`/api/services?customerId=${customer.body.id}&siteId=${site.body.id}&status=active&vendorName=Inventory&search=INV-CIRCUIT-1`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(services.body[0].site.siteName).toBe(site.body.siteName);

    const customerDetail = await request(app).get(`/api/customers/${customer.body.id}`).set('Authorization', `Bearer ${customerToken}`);
    expect(customerDetail.body).toMatchObject({ name: customer.body.name });
    expect(customerDetail.body.sites).toHaveLength(1);
    expect(customerDetail.body.services).toHaveLength(1);
    expect((await request(app).get(`/api/sites/${site.body.id}`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(200);
    expect((await request(app).get(`/api/services/${service.body.id}`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(200);

    const updatedCustomer = await request(app).put(`/api/customers/${customer.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Vitest Inventory Customer Updated', status: 'active', accountNumber: 'INV-CUST-1' });
    expect(updatedCustomer.body.name).toContain('Updated');
    const updatedSite = await request(app).put(`/api/sites/${site.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({ city: 'Evanston', impactLevel: 'high', urgencyLevel: 'medium' });
    expect(updatedSite.body.city).toBe('Evanston');
    const updatedService = await request(app).put(`/api/services/${service.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'impaired', monthlyRecurringCharge: 525, impactLevel: 'high' });
    expect(updatedService.body.status).toBe('impaired');

    const missingId = '00000000-0000-0000-0000-000000000099';
    expect((await request(app).get(`/api/customers/${missingId}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/sites/${missingId}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);
    expect((await request(app).get(`/api/services/${missingId}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(404);

    expect((await request(app).delete(`/api/services/${service.body.id}`).set('Authorization', `Bearer ${customerToken}`)).status).toBe(403);
    expect((await request(app).delete(`/api/services/${service.body.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).delete(`/api/sites/${site.body.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
    expect((await request(app).delete(`/api/customers/${customer.body.id}`).set('Authorization', `Bearer ${adminToken}`)).status).toBe(200);
  });
});