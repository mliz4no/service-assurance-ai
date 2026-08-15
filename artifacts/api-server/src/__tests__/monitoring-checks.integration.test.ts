import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq, like } from 'drizzle-orm';
import {
  db,
  monitoredTargetsTable,
  monitoringChecksTable,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../lib/auth';

vi.mock('../lib/monitoring-checks', () => ({
  runProbe: vi.fn(async () => ({
    checkType: 'http',
    status: 'up',
    responseTimeMs: 123,
    payload: { mocked: true },
  })),
  toTargetStatusUpdate: vi.fn(() => {
    const now = new Date();
    return {
      status: 'up' as const,
      statusSource: 'synthetic' as const,
      lastCheckedAt: now,
      lastSuccessAt: now,
    };
  }),
}));

import app from '../app';

const API_KEY = 'vitest-monitoring-checks-api-key';
const OPS_EMAIL = 'vitest-monitoring-ops@example.test';
const OPS_PASSWORD = 'vitest-monitoring-password';

function integrationHeaders(): Record<string, string> {
  return {
    'x-api-key': API_KEY,
  };
}

async function cleanup(): Promise<void> {
  await db
    .delete(monitoredTargetsTable)
    .where(and(like(monitoredTargetsTable.name, 'vitest-check-target-%')));

  await db.delete(usersTable).where(eq(usersTable.email, OPS_EMAIL));
}

async function getOpsToken(): Promise<string> {
  await db.insert(usersTable).values({
    name: 'Vitest Monitoring Ops',
    email: OPS_EMAIL,
    passwordHash: hashPassword(OPS_PASSWORD),
    role: 'ops',
  });

  const login = await request(app).post('/api/auth/login').send({
    email: OPS_EMAIL,
    password: OPS_PASSWORD,
  });

  expect(login.status).toBe(200);
  expect(login.body.token).toBeTruthy();
  return login.body.token as string;
}

describe.sequential('monitoring checks endpoints', () => {
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

  it('rejects integration credentials on manual checks execution', async () => {
    const response = await request(app)
      .post('/api/monitoring/checks/run')
      .set(integrationHeaders())
      .send({});

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('creates, updates, lists, and deletes monitoring targets', async () => {
    const token = await getOpsToken();
    const created = await request(app)
      .post('/api/monitoring/targets')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'vitest-check-target-crud',
        hostOrIp: '198.51.100.88',
        targetType: 'ip',
        publicLabel: 'VT-CRUD',
        isPublic: false,
      });

    expect(created.status).toBe(201);
    expect(created.body.name).toBe('vitest-check-target-crud');

    const updated = await request(app)
      .put(`/api/monitoring/targets/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ isPublic: true });
    expect(updated.status).toBe(200);
    expect(updated.body.isPublic).toBe(true);

    const listed = await request(app)
      .get('/api/monitoring/targets?search=crud')
      .set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(created.body.id);

    const deleted = await request(app)
      .delete(`/api/monitoring/targets/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body.success).toBe(true);
  });

  it('runs a manual check, persists it, and updates target status timestamps', async () => {
    const token = await getOpsToken();
    const [target] = await db
      .insert(monitoredTargetsTable)
      .values({
        name: 'vitest-check-target-run',
        publicLabel: 'VT-CHECK-TARGET',
        hostOrIp: '198.51.100.55',
        targetType: 'ip',
        status: 'unknown',
        statusSource: 'manual',
        isPublic: false,
      })
      .returning();

    const response = await request(app)
      .post('/api/monitoring/checks/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetId: target.id });

    expect(response.status).toBe(200);
    expect(response.body.processed).toBe(1);
    expect(response.body.results[0].targetId).toBe(target.id);
    expect(response.body.results[0].status).toBe('up');
    expect(response.body.results[0].checkType).toBe('http');
    expect(response.body.results[0].enrichment.provider).toBe('Documentation/Test Network');

    const [persistedCheck] = await db
      .select()
      .from(monitoringChecksTable)
      .where(eq(monitoringChecksTable.targetId, target.id));
    expect(persistedCheck).toBeTruthy();
    expect(persistedCheck.source).toBe('manual');
    expect(persistedCheck.status).toBe('up');
    expect(persistedCheck.responseTimeMs).toBe(123);

    const [updatedTarget] = await db
      .select()
      .from(monitoredTargetsTable)
      .where(eq(monitoredTargetsTable.id, target.id));
    expect(updatedTarget.status).toBe('up');
    expect(updatedTarget.statusSource).toBe('synthetic');
    expect(updatedTarget.lastCheckedAt).toBeTruthy();
    expect(updatedTarget.lastSuccessAt).toBeTruthy();
    expect(updatedTarget.provider).toBe('Documentation/Test Network');
  });

  it('supports enrichment lookup by raw host value', async () => {
    const token = await getOpsToken();

    const response = await request(app)
      .post('/api/monitoring/enrichment/lookup')
      .set('Authorization', `Bearer ${token}`)
      .send({ hostOrIp: 'att.edge.example.us' });

    expect(response.status).toBe(200);
    expect(response.body.enrichment).toBeTruthy();
    expect(response.body.enrichment.provider).toBe('AT&T');
    expect(response.body.enrichment.region).toBe('NA');
    expect(response.body.enrichment.ipType).toBe('hostname');
  });

  it('previews external outage signals for internal users', async () => {
    const token = await getOpsToken();

    const response = await request(app)
      .get('/api/monitoring/external-outage-signal/preview?region=north-east&provider=Carrier%20A')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.configured).toBe(false);
    expect(response.body.query.region).toBe('north-east');
    expect(response.body.query.provider).toBe('Carrier A');
    expect(response.body.signal).toBeNull();
  });

  it('lists monitoring checks for internal users and supports target filtering', async () => {
    const token = await getOpsToken();
    const [targetA] = await db
      .insert(monitoredTargetsTable)
      .values({
        name: 'vitest-check-target-a',
        hostOrIp: '198.51.100.61',
        targetType: 'ip',
      })
      .returning();
    const [targetB] = await db
      .insert(monitoredTargetsTable)
      .values({
        name: 'vitest-check-target-b',
        hostOrIp: '198.51.100.62',
        targetType: 'ip',
      })
      .returning();

    await request(app)
      .post('/api/monitoring/checks/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetIds: [targetA.id, targetB.id] });

    const allResponse = await request(app)
      .get('/api/monitoring/checks?limit=10')
      .set('Authorization', `Bearer ${token}`);
    expect(allResponse.status).toBe(200);
    expect(Array.isArray(allResponse.body)).toBe(true);
    expect(allResponse.body.length).toBeGreaterThanOrEqual(2);

    const filteredResponse = await request(app)
      .get(`/api/monitoring/checks?targetId=${targetA.id}&limit=10`)
      .set('Authorization', `Bearer ${token}`);
    expect(filteredResponse.status).toBe(200);
    expect(Array.isArray(filteredResponse.body)).toBe(true);
    expect(filteredResponse.body.length).toBe(1);
    expect(filteredResponse.body[0].targetId).toBe(targetA.id);
  });
});