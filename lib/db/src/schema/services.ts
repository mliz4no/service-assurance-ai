import { pgTable, text, timestamp, uuid, numeric, uniqueIndex } from 'drizzle-orm/pg-core';
// Note: primaryManagedDeviceId is stored as a plain uuid (no FK constraint) to avoid circular schema import

import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { customersTable } from './customers';
import { sitesTable } from './sites';

export const servicesTable = pgTable(
  'services',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sitesTable.id, { onDelete: 'cascade' }),
    vendorName: text('vendor_name').notNull(),
    serviceType: text('service_type', {
      enum: ['DIA', 'Broadband', 'SD-WAN', 'Voice', 'Wireless', 'Other'],
    }).notNull(),
    circuitId: text('circuit_id'),
    bandwidth: text('bandwidth'),
    status: text('status', { enum: ['active', 'pending', 'down', 'impaired', 'disconnected'] })
      .notNull()
      .default('active'),
    installDate: text('install_date'),
    monthlyRecurringCharge: numeric('monthly_recurring_charge', { precision: 10, scale: 2 }),
    supportReference: text('support_reference'),
    notes: text('notes'),
    impactLevel: text('impact_level', { enum: ['critical', 'high', 'medium', 'low'] }),
    primaryManagedDeviceId: uuid('primary_managed_device_id'),
    externalSource: text('external_source'),
    externalId: text('external_id'),
    externalSyncedAt: timestamp('external_synced_at', { withTimezone: true }),
    externalSyncStatus: text('external_sync_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('services_external_source_external_id_uidx').on(
      table.externalSource,
      table.externalId,
    ),
  ],
);

export const insertServiceSchema = createInsertSchema(servicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
