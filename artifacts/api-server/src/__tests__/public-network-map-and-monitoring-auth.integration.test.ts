import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import app from '../app';
import { and, eq, like } from 'drizzle-orm';
import { db, monitoredTargetsTable } from '@workspace/db';

const API_KEY = 'vitest-public-map-api-key';

function integrationHeaders(): Record<string, string> {
  return {
    'x-api-key': API_KEY,
  };
}

async function cleanup(): Promise<void> {
  await db
    .delete(monitoredTargetsTable)
    .where(and(like(monitoredTargetsTable.name, 'vitest-monitoring-%')));
}

describe.sequential('public network map and monitoring auth boundaries', () => {
  beforeAll(async () => {
    process.env.INVOXAI_API_KEY = API_KEY;
    process.env.INVOXAI_API_SCOPES = 'integrations:create,integrations:read';
    await cleanup();
  });

  beforeEach(async () => {
    await cleanup();

    await db.insert(monitoredTargetsTable).values([
      {
        name: 'vitest-monitoring-private',
        publicLabel: 'VT-PUBLIC-PRIVATE-FLAG',
        hostOrIp: '198.51.100.10',
        targetType: 'ip',
        provider: 'Carrier A',
        region: 'north-east',
        latitude: 40.7128,
        longitude: -74.006,
        status: 'down',
        statusSource: 'manual',
        isPublic: false,
      },
      {
        name: 'vitest-monitoring-public',
        publicLabel: 'VT-PUBLIC-1',
        hostOrIp: '198.51.100.11',
        targetType: 'ip',
        provider: 'Carrier B',
        region: 'north-east',
        latitude: 40.713,
        longitude: -74.007,
        status: 'degraded',
        statusSource: 'nagios',
        isPublic: true,
      },
      {
        name: 'vitest-monitoring-public-missing-label',
        publicLabel: null,
        hostOrIp: '198.51.100.12',
        targetType: 'ip',
        provider: 'Carrier C',
        region: 'west',
        latitude: 34.0522,
        longitude: -118.2437,
        status: 'up',
        statusSource: 'manual',
        isPublic: true,
      },
    ]);
  });

  afterAll(async () => {
    await cleanup();
  });

  it('allows anonymous public map access and returns only public-safe fields', async () => {
    const response = await request(app).get('/api/public/network-map');

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    const point = response.body[0] as Record<string, unknown>;
    expect(Object.keys(point).sort()).toEqual(
      [
        'id',
        'label',
        'lastSeenAt',
        'latitude',
        'longitude',
        'provider',
        'region',
        'source',
        'status',
      ].sort(),
    );
    expect(point.label).toBe('VT-PUBLIC-1');
    expect(point.status).toBe('degraded');
    expect(point).not.toHaveProperty('hostOrIp');
    expect(point).not.toHaveProperty('name');
  });

  it('returns public summary without authentication', async () => {
    const response = await request(app).get('/api/public/network-map/summary');

    expect(response.status).toBe(200);
    expect(response.body.totalAssets).toBe(1);
    expect(response.body.activeOutages).toBe(0);
    expect(response.body.degradedServices).toBe(1);
    expect(response.body.unknownServices).toBe(0);
  });

  it('classifies affected public regions without exposing private targets', async () => {
    const response = await request(app).get('/api/public/network-map/regions');

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      expect.objectContaining({
        region: 'north-east',
        classification: 'degraded',
        totalAssets: 1,
        affectedAssets: 1,
        downAssets: 0,
        degradedAssets: 1,
        affectedPercentage: 100,
        providers: ['Carrier B'],
      }),
    ]);
  });

  it('rejects integration credentials on monitoring targets endpoints', async () => {
    const response = await request(app).get('/api/monitoring/targets').set(integrationHeaders());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('keeps monitoring targets protected from anonymous access', async () => {
    const response = await request(app).get('/api/monitoring/targets');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });
});
