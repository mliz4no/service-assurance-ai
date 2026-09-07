import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import { controllersTable, db, deviceEventsTable, usersTable } from '@workspace/db';
import { hashPassword } from '../lib/auth';
import app from '../app';

const ADMIN_EMAIL = 'vitest-purge-admin@example.test';
const OPS_EMAIL = 'vitest-purge-ops@example.test';
const PASSWORD = 'vitest-purge-password';
const EVENT_PREFIX = 'vitest-purge-event-';
const CONTROLLER_NAME = 'Vitest Purge Controller';

async function cleanup(): Promise<void> {
  await db.delete(deviceEventsTable).where(like(deviceEventsTable.rawEventId, `${EVENT_PREFIX}%`));
  await db.delete(controllersTable).where(eq(controllersTable.name, CONTROLLER_NAME));
  await db.delete(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
  await db.delete(usersTable).where(eq(usersTable.email, OPS_EMAIL));
}

async function tokenFor(role: 'admin' | 'ops'): Promise<string> {
  const email = role === 'admin' ? ADMIN_EMAIL : OPS_EMAIL;
  await db.insert(usersTable).values({
    name: `Vitest Purge ${role}`,
    email,
    passwordHash: hashPassword(PASSWORD),
    role,
  });
  const response = await request(app).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe.sequential('device event retention purge', () => {
  beforeAll(async () => {
    vi.stubEnv('EVENT_PURGE_ENABLED', 'true');
    vi.stubEnv('EVENT_PURGE_RETENTION_DEFAULT_HOURS', '24');
    vi.stubEnv('EVENT_PURGE_BATCH_SIZE', '1');
    await cleanup();
  });

  beforeEach(cleanup);

  afterAll(async () => {
    await cleanup();
    vi.unstubAllEnvs();
  });

  it('previews, dry-runs, and deletes eligible events while preserving holds', async () => {
    const token = await tokenFor('admin');
    const [controller] = await db
      .insert(controllersTable)
      .values({
        name: CONTROLLER_NAME,
        vendor: 'sdwan',
        type: 'sdwan',
        baseUrl: 'https://purge-controller.example.test',
      })
      .returning();
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000);
    await db.insert(deviceEventsTable).values([
      {
        controllerId: controller.id,
        rawEventId: `${EVENT_PREFIX}eligible`,
        eventSource: 'vitest',
        eventType: 'retention_test',
        title: 'Eligible purge event',
        occurredAt: old,
      },
      {
        controllerId: controller.id,
        rawEventId: `${EVENT_PREFIX}held`,
        eventSource: 'vitest',
        eventType: 'retention_test',
        title: 'Held purge event',
        legalHold: true,
        occurredAt: old,
      },
    ]);

    const preview = await request(app)
      .get('/api/device-events/purge/preview')
      .set('Authorization', `Bearer ${token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.enabled).toBe(true);
    expect(preview.body.eligibleCountPerCategory.default).toBeGreaterThanOrEqual(1);
    expect(preview.body.heldCount.totalHolds).toBeGreaterThanOrEqual(1);

    const dryRun = await request(app)
      .post('/api/device-events/purge/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: true });
    expect(dryRun.status).toBe(200);
    expect(dryRun.body.deletedTotal).toBeGreaterThanOrEqual(1);
    expect(
      await db.select().from(deviceEventsTable).where(like(deviceEventsTable.rawEventId, `${EVENT_PREFIX}%`)),
    ).toHaveLength(2);

    const run = await request(app)
      .post('/api/device-events/purge/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: false });
    expect(run.status).toBe(200);
    expect(run.body.deletedTotal).toBeGreaterThanOrEqual(1);
    const remaining = await db
      .select()
      .from(deviceEventsTable)
      .where(like(deviceEventsTable.rawEventId, `${EVENT_PREFIX}%`));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].rawEventId).toBe(`${EVENT_PREFIX}held`);
  });

  it('allows ops previews but forbids ops purge runs', async () => {
    const token = await tokenFor('ops');
    const preview = await request(app)
      .get('/api/device-events/purge/preview')
      .set('Authorization', `Bearer ${token}`);
    expect(preview.status).toBe(200);

    const run = await request(app)
      .post('/api/device-events/purge/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ dryRun: false });
    expect(run.status).toBe(403);
  });
});