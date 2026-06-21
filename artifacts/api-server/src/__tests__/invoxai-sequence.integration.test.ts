import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app';
import {
  customersTable,
  db,
  integrationIdempotencyKeysTable,
  servicesTable,
  sitesTable,
  ticketsTable,
} from '@workspace/db';
import { and, eq, like } from 'drizzle-orm';

const API_KEY = 'vitest-invoxai-sequence-api-key';

function headers(idempotencyKey?: string): Record<string, string> {
  return {
    'x-api-key': API_KEY,
    ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
  };
}

async function cleanup(): Promise<void> {
  await db
    .delete(integrationIdempotencyKeysTable)
    .where(
      and(
        eq(integrationIdempotencyKeysTable.integrationSource, 'invoxai'),
        like(integrationIdempotencyKeysTable.idempotencyKey, 'vitest-seq-%'),
      ),
    );

  await db
    .delete(ticketsTable)
    .where(and(eq(ticketsTable.externalSource, 'invoxai'), like(ticketsTable.externalId, 'vitest-seq-%')));
  await db
    .delete(servicesTable)
    .where(
      and(eq(servicesTable.externalSource, 'invoxai'), like(servicesTable.externalId, 'vitest-seq-%')),
    );
  await db
    .delete(sitesTable)
    .where(and(eq(sitesTable.externalSource, 'invoxai'), like(sitesTable.externalId, 'vitest-seq-%')));
  await db
    .delete(customersTable)
    .where(
      and(eq(customersTable.externalSource, 'invoxai'), like(customersTable.externalId, 'vitest-seq-%')),
    );
}

describe.sequential('InvoxAI integration sequence', () => {
  beforeAll(async () => {
    process.env.INVOXAI_API_KEY = API_KEY;
    process.env.INVOXAI_API_SCOPES = 'integrations:create,integrations:read';
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('runs customer->site->service->ticket sequence and retries deterministically', async () => {
    const customerExternalId = 'vitest-seq-customer';
    const siteExternalId = 'vitest-seq-site';
    const serviceExternalId = 'vitest-seq-service';
    const ticketExternalId = 'vitest-seq-ticket';

    const customerResp = await request(app)
      .post('/api/customers')
      .set(headers('vitest-seq-customer-key'))
      .send({
        name: 'Vitest Sequence Customer',
        status: 'active',
        externalSource: 'invoxai',
        externalId: customerExternalId,
      });
    expect(customerResp.status).toBe(201);

    const customerId = customerResp.body.id as string;

    const siteResp = await request(app)
      .post('/api/sites')
      .set(headers('vitest-seq-site-key'))
      .send({
        customerId,
        siteName: 'Vitest Sequence Site',
        externalSource: 'invoxai',
        externalId: siteExternalId,
      });
    expect(siteResp.status).toBe(201);

    const siteId = siteResp.body.id as string;

    const serviceResp = await request(app)
      .post('/api/services')
      .set(headers('vitest-seq-service-key'))
      .send({
        customerId,
        siteId,
        vendorName: 'Carrier X',
        serviceType: 'DIA',
        status: 'active',
        externalSource: 'invoxai',
        externalId: serviceExternalId,
      });
    expect(serviceResp.status).toBe(201);

    const serviceId = serviceResp.body.id as string;

    const ticketResp = await request(app)
      .post('/api/tickets')
      .set(headers('vitest-seq-ticket-key'))
      .send({
        customerId,
        siteId,
        serviceId,
        title: 'Quote missing detail',
        source: 'api',
        severity: 'medium',
        outageType: 'informational',
        externalSource: 'invoxai',
        externalId: ticketExternalId,
      });
    expect(ticketResp.status).toBe(201);

    for (let run = 0; run < 2; run += 1) {
      const customerRetry = await request(app)
        .post('/api/customers')
        .set(headers('vitest-seq-customer-key'))
        .send({
          name: 'Vitest Sequence Customer',
          status: 'active',
          externalSource: 'invoxai',
          externalId: customerExternalId,
        });
      expect(customerRetry.status).toBe(201);
      expect(customerRetry.body.id).toBe(customerId);

      const siteRetry = await request(app)
        .post('/api/sites')
        .set(headers('vitest-seq-site-key'))
        .send({
          customerId,
          siteName: 'Vitest Sequence Site',
          externalSource: 'invoxai',
          externalId: siteExternalId,
        });
      expect(siteRetry.status).toBe(201);
      expect(siteRetry.body.id).toBe(siteId);

      const serviceRetry = await request(app)
        .post('/api/services')
        .set(headers('vitest-seq-service-key'))
        .send({
          customerId,
          siteId,
          vendorName: 'Carrier X',
          serviceType: 'DIA',
          status: 'active',
          externalSource: 'invoxai',
          externalId: serviceExternalId,
        });
      expect(serviceRetry.status).toBe(201);
      expect(serviceRetry.body.id).toBe(serviceId);

      const ticketRetry = await request(app)
        .post('/api/tickets')
        .set(headers('vitest-seq-ticket-key'))
        .send({
          customerId,
          siteId,
          serviceId,
          title: 'Quote missing detail',
          source: 'api',
          severity: 'medium',
          outageType: 'informational',
          externalSource: 'invoxai',
          externalId: ticketExternalId,
        });
      expect(ticketRetry.status).toBe(201);
      expect(ticketRetry.body.id).toBe(ticketResp.body.id);
    }

    const customersLookup = await request(app)
      .get(`/api/customers?externalSource=invoxai&externalId=${customerExternalId}&compact=true`)
      .set(headers());
    expect(customersLookup.status).toBe(200);
    expect(customersLookup.body).toHaveLength(1);

    const sitesLookup = await request(app)
      .get(`/api/sites?externalSource=invoxai&externalId=${siteExternalId}&compact=true`)
      .set(headers());
    expect(sitesLookup.status).toBe(200);
    expect(sitesLookup.body).toHaveLength(1);

    const servicesLookup = await request(app)
      .get(`/api/services?externalSource=invoxai&externalId=${serviceExternalId}&compact=true`)
      .set(headers());
    expect(servicesLookup.status).toBe(200);
    expect(servicesLookup.body).toHaveLength(1);

    const ticketsLookup = await request(app)
      .get(`/api/tickets?externalSource=invoxai&externalId=${ticketExternalId}&compact=true`)
      .set(headers());
    expect(ticketsLookup.status).toBe(200);
    expect(ticketsLookup.body).toHaveLength(1);
  });

  it('does not duplicate records across repeated upsert sync runs', async () => {
    const externalCustomerId = 'vitest-seq-upsert-customer';

    for (let run = 0; run < 3; run += 1) {
      const response = await request(app)
        .post('/api/integrations/invoxai/customers/upsert')
        .set(headers(`vitest-seq-upsert-customer-key-${run}`))
        .send({
          externalId: externalCustomerId,
          name: 'Upsert Customer',
          status: 'active',
        });

      expect([200, 201]).toContain(response.status);
    }

    const lookup = await request(app)
      .get(`/api/customers?externalSource=invoxai&externalId=${externalCustomerId}&compact=true`)
      .set(headers());

    expect(lookup.status).toBe(200);
    expect(lookup.body).toHaveLength(1);
  });

  it('returns auth and permission errors for missing or insufficient integration credentials', async () => {
    const unauthorized = await request(app).post('/api/customers').send({
      name: 'No Auth Customer',
      status: 'active',
    });

    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body.error.code).toBe('UNAUTHORIZED');

    process.env.INVOXAI_API_SCOPES = 'integrations:read';

    const forbidden = await request(app)
      .post('/api/customers')
      .set(headers('vitest-seq-forbidden-key'))
      .send({
        name: 'Read Only Scope',
        status: 'active',
      });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    process.env.INVOXAI_API_SCOPES = 'integrations:create,integrations:read';
  });

  it('requires Idempotency-Key on integration upsert routes', async () => {
    const response = await request(app)
      .post('/api/integrations/invoxai/customers/upsert')
      .set({ 'x-api-key': API_KEY })
      .send({
        externalId: 'vitest-seq-upsert-no-key',
        name: 'Missing Key Customer',
        status: 'active',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });
});
