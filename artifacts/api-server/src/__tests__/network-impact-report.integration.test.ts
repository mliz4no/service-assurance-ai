import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, monitoredTargetsTable, monitoringChecksTable, usersTable } from '@workspace/db';
import app from '../app';
import { hashPassword } from '../lib/auth';

const EMAIL = 'vitest-network-impact@example.test';
const PASSWORD = 'vitest-network-impact-password';

async function cleanup() {
  await db.delete(monitoredTargetsTable).where(eq(monitoredTargetsTable.name, 'vitest-network-impact-target'));
  await db.delete(usersTable).where(eq(usersTable.email, EMAIL));
}

describe.sequential('network impact report', () => {
  beforeAll(async () => {
    await cleanup();
    await db.insert(usersTable).values({
      name: 'Vitest Network Impact Ops',
      email: EMAIL,
      passwordHash: hashPassword(PASSWORD),
      role: 'ops',
    });
  });

  afterAll(cleanup);

  it('aggregates provider, region, and device impact and exports CSV', async () => {
    const [target] = await db.insert(monitoredTargetsTable).values({
      name: 'vitest-network-impact-target',
      hostOrIp: '198.51.100.99',
      targetType: 'ip',
      provider: 'Vitest Carrier',
      region: 'north-test',
    }).returning();

    await db.insert(monitoringChecksTable).values([
      { targetId: target.id, source: 'synthetic', checkType: 'tcp', status: 'up', responseTimeMs: 20 },
      { targetId: target.id, source: 'synthetic', checkType: 'tcp', status: 'down', responseTimeMs: 40 },
      { targetId: target.id, source: 'nagios', checkType: 'tcp', status: 'degraded', responseTimeMs: 30 },
    ]);

    const login = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    const token = login.body.token as string;
    const from = new Date(Date.now() - 60_000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();

    const json = await request(app)
      .get(`/api/dashboard/network-impact-report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(json.status).toBe(200);
    expect(json.body.totals).toEqual({ checks: 3, outages: 1, degraded: 1, devices: 1 });
    expect(json.body.byProvider[0]).toMatchObject({ key: 'Vitest Carrier', totalChecks: 3, outages: 1 });
    expect(json.body.byRegion[0].key).toBe('north-test');
    expect(json.body.byDevice[0]).toMatchObject({ name: target.name, availabilityPct: 66.67 });

    const csv = await request(app)
      .get(`/api/dashboard/network-impact-report?format=csv&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
      .set('Authorization', `Bearer ${token}`);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('Vitest Carrier');
    expect(csv.text).toContain('availabilityPct');
  });
});