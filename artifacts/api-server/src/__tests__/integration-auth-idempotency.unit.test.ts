import request from 'supertest';
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app';
import { db, customersTable, integrationIdempotencyKeysTable } from '@workspace/db';
import { and, eq, like } from 'drizzle-orm';

const API_KEY = 'vitest-invoxai-api-key';

function integrationHeaders(idempotencyKey?: string): Record<string, string> {
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
        like(integrationIdempotencyKeysTable.idempotencyKey, 'vitest-%'),
      ),
    );

  await db
    .delete(customersTable)
    .where(
      and(eq(customersTable.externalSource, 'invoxai'), like(customersTable.externalId, 'vitest-%')),
    );
}

describe.sequential('integration auth and idempotency unit cases', () => {
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

  it('replays same idempotency key and payload with original success response', async () => {
    const payload = {
      name: 'Vitest Customer A',
      status: 'active',
      externalSource: 'invoxai',
      externalId: 'vitest-customer-idempotent',
    };

    const first = await request(app)
      .post('/api/customers')
      .set(integrationHeaders('vitest-customer-replay-key'))
      .send(payload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/customers')
      .set(integrationHeaders('vitest-customer-replay-key'))
      .send(payload);
    expect(second.status).toBe(201);
    expect(second.body.id).toBe(first.body.id);
    expect(second.body.name).toBe(first.body.name);
  });

  it('returns 409 when idempotency key is replayed with different payload', async () => {
    const firstPayload = {
      name: 'Vitest Customer B',
      status: 'active',
      externalSource: 'invoxai',
      externalId: 'vitest-customer-conflict',
    };

    const secondPayload = {
      ...firstPayload,
      name: 'Vitest Customer B Changed',
    };

    const first = await request(app)
      .post('/api/customers')
      .set(integrationHeaders('vitest-customer-conflict-key'))
      .send(firstPayload);
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/customers')
      .set(integrationHeaders('vitest-customer-conflict-key'))
      .send(secondPayload);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('upsert endpoint creates then updates on same external identity', async () => {
    const createResp = await request(app)
      .post('/api/integrations/invoxai/customers/upsert')
      .set(integrationHeaders('vitest-upsert-create-key'))
      .send({
        externalId: 'vitest-upsert-customer',
        name: 'Vitest Upsert Customer',
        status: 'active',
      });

    expect(createResp.status).toBe(201);

    const updateResp = await request(app)
      .post('/api/integrations/invoxai/customers/upsert')
      .set(integrationHeaders('vitest-upsert-update-key'))
      .send({
        externalId: 'vitest-upsert-customer',
        name: 'Vitest Upsert Customer Updated',
        status: 'active',
      });

    expect(updateResp.status).toBe(200);
    expect(updateResp.body.id).toBe(createResp.body.id);
    expect(updateResp.body.name).toBe('Vitest Upsert Customer Updated');
  });
});
