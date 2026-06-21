import { doublePrecision, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { customersTable } from './customers';

export const sitesTable = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customersTable.id, { onDelete: 'cascade' }),
  siteName: text('site_name').notNull(),
  address1: text('address1'),
  address2: text('address2'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country'),
  timezone: text('timezone'),
  siteCode: text('site_code'),
  notes: text('notes'),
  /** Local Contact on Network (LCON) — on-site point of contact for dispatch and physical access */
  lconName: text('lcon_name'),
  lconPhone: text('lcon_phone'),
  lconEmail: text('lcon_email'),
  /** WGS-84 latitude decimal degrees — null if unknown */
  latitude: doublePrecision('latitude'),
  /** WGS-84 longitude decimal degrees — null if unknown */
  longitude: doublePrecision('longitude'),
  /** Origin of the coordinate: manual entry, geocoded from address, or bulk import */
  geoSource: text('geo_source', { enum: ['manual', 'geocoded', 'imported'] }),
  /** Business impact classification for this location */
  impactLevel: text('impact_level', { enum: ['critical', 'high', 'medium', 'low'] }),
  /** Urgency classification for this location */
  urgencyLevel: text('urgency_level', { enum: ['high', 'medium', 'low'] }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSiteSchema = createInsertSchema(sitesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sitesTable.$inferSelect;
