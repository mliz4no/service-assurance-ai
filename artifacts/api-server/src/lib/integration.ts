import { and, eq } from 'drizzle-orm';
import {
  db,
  integrationIdempotencyKeysTable,
  type Customer,
  type Site,
  type Service,
  type Ticket,
} from '@workspace/db';
import type { Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from './logger';
import { sendBadRequest, sendConflict } from './http';

type IntegrationEntity = 'customers' | 'sites' | 'services' | 'tickets';

type IdempotentResult<T> = {
  statusCode: number;
  body: T;
  resourceId?: string;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function getCorrelationId(req: Request): string | undefined {
  const cid = req.headers['x-correlation-id'];
  if (Array.isArray(cid)) return cid[0];
  if (typeof cid === 'string') return cid;
  return String(req.id);
}

export function getIntegrationExternalSource(req: Request): string | undefined {
  return req.integration?.source;
}

export function normalizeServiceType(input: string): string | null {
  const raw = input.trim().toUpperCase();
  const mapped: Record<string, string> = {
    DIA: 'DIA',
    'SD-WAN': 'SD-WAN',
    SDWAN: 'SD-WAN',
    VOICE: 'Voice',
    OTHER: 'Other',
  };
  return mapped[raw] ?? null;
}

export function validateRequiredFields(
  payload: Record<string, unknown>,
  required: string[],
): Record<string, string> {
  const details: Record<string, string> = {};
  for (const field of required) {
    const value = payload[field];
    if (value === undefined || value === null || value === '') {
      details[field] = 'This field is required';
    }
  }
  return details;
}

export async function handleIdempotentCreate<T extends Customer | Site | Service | Ticket>(
  req: Request,
  res: Response,
  entity: IntegrationEntity,
  action: () => Promise<IdempotentResult<T>>,
): Promise<IdempotentResult<T> | null> {
  if (!req.integration) {
    return action();
  }

  const idempotencyKey = req.headers['idempotency-key'];
  const key = Array.isArray(idempotencyKey) ? idempotencyKey[0] : idempotencyKey;
  if (!key) {
    sendBadRequest(res, 'Idempotency-Key header is required for integration requests');
    return null;
  }

  const requestHash = sha256(stableStringify(req.body ?? {}));

  const [existing] = await db
    .select()
    .from(integrationIdempotencyKeysTable)
    .where(
      and(
        eq(integrationIdempotencyKeysTable.integrationSource, req.integration.source),
        eq(integrationIdempotencyKeysTable.idempotencyKey, key),
        eq(integrationIdempotencyKeysTable.resourceType, entity),
      ),
    );

  if (existing) {
    if (existing.requestHash !== requestHash) {
      sendConflict(res, 'Idempotency key already used with a different payload');
      return null;
    }

    logger.info(
      {
        correlationId: getCorrelationId(req),
        idempotencyKey: key,
        resourceType: entity,
        actorType: 'integration',
        source: req.integration.source,
        replay: true,
      },
      'integration_idempotency_replay',
    );

    return {
      statusCode: existing.statusCode,
      body: existing.responseBody as T,
      resourceId: existing.resourceId ?? undefined,
    };
  }

  const result = await action();

  await db.insert(integrationIdempotencyKeysTable).values({
    integrationSource: req.integration.source,
    resourceType: entity,
    idempotencyKey: key,
    requestHash,
    statusCode: result.statusCode,
    resourceId: result.resourceId ?? null,
    responseBody: result.body,
  });

  logger.info(
    {
      correlationId: getCorrelationId(req),
      idempotencyKey: key,
      resourceType: entity,
      actorType: 'integration',
      source: req.integration.source,
      replay: false,
    },
    'integration_idempotency_recorded',
  );

  return result;
}

export function logIntegrationMutation(
  req: Request,
  action: 'create' | 'update' | 'upsert',
  entity: IntegrationEntity,
  resourceId: string,
): void {
  const key = req.headers['idempotency-key'];
  const idempotencyKey = Array.isArray(key) ? key[0] : key;

  logger.info(
    {
      correlationId: getCorrelationId(req),
      idempotencyKey,
      actorType: req.integration ? 'integration' : 'user',
      source: req.integration?.source,
      action,
      entity,
      resourceId,
      audit: {
        actorType: req.integration ? 'integration' : 'user',
        source: req.integration?.source ?? 'internal',
      },
    },
    'entity_mutation',
  );
}
