import { createInsertSchema } from 'drizzle-zod';
import { pgTable, timestamp, text, uuid, uniqueIndex, integer, boolean } from 'drizzle-orm/pg-core';
import { z } from 'zod/v4';

export const dnsCandidatesTable = pgTable(
  'dns_candidates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    providerName: text('provider_name').notNull(),
    address: text('address').notNull(),
    transport: text('transport', { enum: ['udp', 'tcp', 'dot', 'doh'] }).notNull(),
    port: integer('port').notNull().default(53),
    country: text('country').notNull().default('US'),
    source: text('source').notNull(),
    sourceUrl: text('source_url'),
    asn: text('asn'),
    dnssecSupported: boolean('dnssec_supported'),
    status: text('status', { enum: ['pending', 'validated', 'rejected', 'promoted'] })
      .notNull()
      .default('pending'),
    lastValidatedAt: timestamp('last_validated_at', { withTimezone: true }),
    validationMessage: text('validation_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('dns_candidates_address_transport_uidx').on(table.address, table.transport)],
);

export const insertDnsCandidateSchema = createInsertSchema(dnsCandidatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDnsCandidateApiSchema = insertDnsCandidateSchema.extend({
  port: z.number().int().min(1).max(65535).optional(),
});

export type DnsCandidate = typeof dnsCandidatesTable.$inferSelect;