import { pgTable, text, timestamp, uuid, integer, jsonb, uniqueIndex } from 'drizzle-orm/pg-core';

export const integrationIdempotencyKeysTable = pgTable(
  'integration_idempotency_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    integrationSource: text('integration_source').notNull(),
    resourceType: text('resource_type').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    requestHash: text('request_hash').notNull(),
    statusCode: integer('status_code').notNull(),
    resourceId: uuid('resource_id'),
    responseBody: jsonb('response_body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('integration_idempotency_source_key_resource_uidx').on(
      table.integrationSource,
      table.idempotencyKey,
      table.resourceType,
    ),
  ],
);

export type IntegrationIdempotencyKey = typeof integrationIdempotencyKeysTable.$inferSelect;
