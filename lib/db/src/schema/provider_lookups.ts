import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const providerLookupsTable = pgTable('provider_lookups', {
  ipAddress: text('ip_address').primaryKey(),
  provider: text('provider'),
  region: text('region'),
  asn: text('asn'),
  country: text('country'),
  city: text('city'),
  /** Raw state/province name from the enrichment provider (not collapsed into a continent bucket) */
  state: text('state'),
  source: text('source').notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
});