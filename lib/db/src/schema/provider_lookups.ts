import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const providerLookupsTable = pgTable('provider_lookups', {
  ipAddress: text('ip_address').primaryKey(),
  provider: text('provider'),
  region: text('region'),
  asn: text('asn'),
  country: text('country'),
  city: text('city'),
  source: text('source').notNull(),
  cachedAt: timestamp('cached_at', { withTimezone: true }).notNull().defaultNow(),
});