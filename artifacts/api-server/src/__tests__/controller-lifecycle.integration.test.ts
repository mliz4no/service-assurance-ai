import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, like } from 'drizzle-orm';
import {
  controllerSyncLogsTable,
  controllersTable,
  db,
  deviceEventsTable,
  managedDevicesTable,
  networkLinksTable,
  usersTable,
} from '@workspace/db';
import { hashPassword } from '../lib/auth';

const fullSync = vi.fn(async () => ({
  devices: [
    {
      controllerDeviceId: 'vitest-edge-1',
      hostname: 'vitest-branch-edge',
      deviceType: 'sdwan_edge' as const,
      vendor: 'Vitest SD-WAN',
      serialNumber: 'VITEST-EDGE-1',
      model: 'Edge 1000',
      mgmtIp: '192.0.2.10',
      status: 'degraded' as const,
      haState: 'standalone' as const,
      networkName: 'Vitest Network',
      lastSeenAt: new Date(),
      metadataJson: { source: 'vitest' },
    },
    {
      controllerDeviceId: 'vitest-edge-2',
      hostname: 'vitest-backup-edge',
      deviceType: 'gateway' as const,
      vendor: 'Vitest SD-WAN',
      status: 'online' as const,
      lastSeenAt: new Date(),
    },
  ],
  links: [
    {
      controllerDeviceId: 'vitest-edge-1',
      linkName: 'Vitest Primary MPLS',
      linkType: 'mpls' as const,
      providerName: 'Vitest Carrier',
      circuitId: 'VITEST-CIRCUIT-1',
      role: 'primary' as const,
      status: 'down' as const,
      latencyMs: 80,
      jitterMs: 12,
      packetLossPct: 4,
    },
    {
      controllerDeviceId: 'vitest-edge-1',
      linkName: 'Vitest Backup Broadband',
      linkType: 'broadband' as const,
      role: 'backup' as const,
      status: 'up' as const,
      failoverActive: true,
    },
  ],
  events: [
    {
      rawEventId: 'vitest-controller-event-1',
      eventSource: 'vitest_sdwan',
      severity: 'high' as const,
      eventType: 'transport_down',
      title: 'Vitest primary transport down',
      description: 'Primary MPLS transport is unavailable',
      occurredAt: new Date(),
      controllerDeviceId: 'vitest-edge-1',
      category: 'transport',
      rawPayloadJson: { source: 'vitest' },
    },
    {
      rawEventId: 'vitest-controller-event-2',
      eventSource: 'vitest_sdwan',
      severity: 'informational' as const,
      eventType: 'status',
      title: 'Vitest controller status',
      occurredAt: new Date(),
    },
  ],
  errors: [],
}));

vi.mock('../connectors', () => ({
  createConnector: vi.fn((controller: { vendor: string }) =>
    controller.vendor === 'unsupported'
      ? null
      : {
          testConnection: vi.fn(async () => ({ ok: true, message: 'Vitest connection successful' })),
          fullSync,
        },
  ),
}));

vi.mock('../lib/incident-correlator', () => ({ correlateEvent: vi.fn(async () => null) }));

vi.mock('../lib/ai', async () => {
  const actual = await vi.importActual<typeof import('../lib/ai')>('../lib/ai');
  return {
    ...actual,
    summarizeControllerEvent: vi.fn(async () => ({
      summary: 'Vitest AI summary',
      confidence: 0.92,
      normalizedStatus: 'down',
    })),
    inferProbableImpact: vi.fn(async () => ({ probableImpact: 'Branch traffic is on backup.' })),
  };
});

import app from '../app';

const ADMIN_EMAIL = 'vitest-controller-admin@example.test';
const PASSWORD = 'vitest-controller-password';

async function cleanup(): Promise<void> {
  await db
    .delete(deviceEventsTable)
    .where(like(deviceEventsTable.rawEventId, 'vitest-controller-event-%'));
  const mockDevices = await db
    .select({ id: managedDevicesTable.id })
    .from(managedDevicesTable)
    .where(like(managedDevicesTable.controllerDeviceId, 'vitest-edge-%'));
  for (const device of mockDevices) {
    await db.delete(networkLinksTable).where(eq(networkLinksTable.managedDeviceId, device.id));
  }
  await db
    .delete(managedDevicesTable)
    .where(like(managedDevicesTable.controllerDeviceId, 'vitest-edge-%'));

  const controllers = await db
    .select({ id: controllersTable.id })
    .from(controllersTable)
    .where(like(controllersTable.name, 'Vitest Controller%'));
  for (const controller of controllers) {
    await db.delete(deviceEventsTable).where(eq(deviceEventsTable.controllerId, controller.id));
    const devices = await db
      .select({ id: managedDevicesTable.id })
      .from(managedDevicesTable)
      .where(eq(managedDevicesTable.controllerId, controller.id));
    for (const device of devices) {
      await db.delete(networkLinksTable).where(eq(networkLinksTable.managedDeviceId, device.id));
    }
    await db.delete(managedDevicesTable).where(eq(managedDevicesTable.controllerId, controller.id));
    await db.delete(controllerSyncLogsTable).where(eq(controllerSyncLogsTable.controllerId, controller.id));
    await db.delete(controllersTable).where(eq(controllersTable.id, controller.id));
  }
  await db.delete(usersTable).where(eq(usersTable.email, ADMIN_EMAIL));
  fullSync.mockClear();
}

async function adminToken(): Promise<string> {
  await db.insert(usersTable).values({
    name: 'Vitest Controller Admin',
    email: ADMIN_EMAIL,
    passwordHash: hashPassword(PASSWORD),
    role: 'admin',
  });
  const response = await request(app).post('/api/auth/login').send({ email: ADMIN_EMAIL, password: PASSWORD });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

async function createController(token: string, overrides: Record<string, unknown> = {}) {
  return request(app)
    .post('/api/controllers')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: 'Vitest Controller SD-WAN',
      vendor: 'sdwan',
      type: 'sdwan',
      baseUrl: 'https://controller.example.test',
      apiKeyEncryptedOrPlaceholder: 'placeholder',
      pollingEnabled: true,
      ...overrides,
    });
}

async function waitForSync(controllerId: string): Promise<void> {
  await vi.waitFor(async () => {
    const [controller] = await db
      .select()
      .from(controllersTable)
      .where(eq(controllersTable.id, controllerId));
    expect(controller.lastPollStatus).toBe('success');
  }, { timeout: 3_000 });
}

describe.sequential('controller lifecycle endpoints', () => {
  beforeEach(cleanup);
  afterAll(cleanup);

  it('covers controller CRUD, validation, connection, and missing records', async () => {
    const token = await adminToken();
    expect((await request(app).post('/api/controllers').set('Authorization', `Bearer ${token}`).send({ name: 'Incomplete' })).status).toBe(400);

    const created = await createController(token);
    expect(created.status).toBe(201);
    expect((await request(app).get('/api/controllers').set('Authorization', `Bearer ${token}`)).status).toBe(200);

    const detail = await request(app)
      .get(`/api/controllers/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.deviceCount).toBe(0);

    const updated = await request(app)
      .put(`/api/controllers/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Vitest Controller Updated', pollingIntervalSeconds: 120 });
    expect(updated.body.name).toContain('Updated');

    const tested = await request(app)
      .post(`/api/controllers/${created.body.id}/test`)
      .set('Authorization', `Bearer ${token}`);
    expect(tested.body.ok).toBe(true);

    const missingId = '00000000-0000-0000-0000-000000000099';
    expect((await request(app).get(`/api/controllers/${missingId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).put(`/api/controllers/${missingId}`).set('Authorization', `Bearer ${token}`).send({ name: 'Missing' })).status).toBe(404);
    expect((await request(app).post(`/api/controllers/${missingId}/test`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).delete(`/api/controllers/${missingId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);

    expect((await request(app).delete(`/api/controllers/${created.body.id}`).set('Authorization', `Bearer ${token}`)).status).toBe(200);
  });

  it('syncs inserted and updated records and exposes device, link, and event details', async () => {
    const token = await adminToken();
    const created = await createController(token);

    const sync = await request(app)
      .post(`/api/controllers/${created.body.id}/sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(sync.status).toBe(200);
    await waitForSync(created.body.id);

    const devices = await request(app)
      .get(`/api/devices?controllerId=${created.body.id}&status=degraded&search=branch`)
      .set('Authorization', `Bearer ${token}`);
    expect(devices.body).toHaveLength(1);
    const deviceId = devices.body[0].id as string;

    const deviceDetail = await request(app)
      .get(`/api/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(deviceDetail.body.links).toHaveLength(2);
    expect(deviceDetail.body.recentEvents).toHaveLength(1);

    const deviceUpdate = await request(app)
      .put(`/api/devices/${deviceId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hostname: 'vitest-branch-edge-updated', status: 'online' });
    expect(deviceUpdate.body.status).toBe('online');

    const links = await request(app)
      .get('/api/network-links?status=down&role=primary&search=carrier')
      .set('Authorization', `Bearer ${token}`);
    expect(links.body).toHaveLength(1);
    const linkDetail = await request(app)
      .get(`/api/network-links/${links.body[0].id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(linkDetail.body.device.id).toBe(deviceId);

    const events = await request(app)
      .get(`/api/device-events?controllerId=${created.body.id}&severity=high&search=transport`)
      .set('Authorization', `Bearer ${token}`);
    expect(events.body).toHaveLength(1);
    const eventId = events.body[0].id as string;
    expect((await request(app).get(`/api/device-events/${eventId}`).set('Authorization', `Bearer ${token}`)).status).toBe(200);

    const analyzed = await request(app)
      .post(`/api/device-events/${eventId}/ai-analyze`)
      .set('Authorization', `Bearer ${token}`);
    expect(analyzed.status).toBe(500);
    expect(analyzed.body.error).toBe('AI analysis failed');

    const secondSync = await request(app)
      .post(`/api/controllers/${created.body.id}/sync`)
      .set('Authorization', `Bearer ${token}`);
    expect(secondSync.status).toBe(200);
    await vi.waitFor(() => expect(fullSync).toHaveBeenCalledTimes(2), { timeout: 3_000 });

    const controllerDetail = await request(app)
      .get(`/api/controllers/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(controllerDetail.body).toMatchObject({ deviceCount: 2, linkCount: 2, eventCount: 2 });

    const missingId = '00000000-0000-0000-0000-000000000099';
    expect((await request(app).get(`/api/devices/${missingId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).put(`/api/devices/${missingId}`).set('Authorization', `Bearer ${token}`).send({})).status).toBe(404);
    expect((await request(app).get(`/api/network-links/${missingId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).get(`/api/device-events/${missingId}`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
    expect((await request(app).post(`/api/device-events/${missingId}/ai-analyze`).set('Authorization', `Bearer ${token}`)).status).toBe(404);
  });

  it('rejects unsupported controller vendors', async () => {
    const token = await adminToken();
    const [unsupported] = await db
      .insert(controllersTable)
      .values({
        name: 'Vitest Controller Unsupported',
        vendor: 'unsupported' as 'sdwan',
        type: 'network_manager',
        baseUrl: 'https://unsupported.example.test',
      })
      .returning();
    const result = await request(app)
      .post(`/api/controllers/${unsupported.id}/test`)
      .set('Authorization', `Bearer ${token}`);
    expect(result.status).toBe(400);
  });
});