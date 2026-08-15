import {
  boolean,
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { customersTable } from './customers';
import { sitesTable } from './sites';
import { servicesTable } from './services';

export const monitoredTargetsTable = pgTable(
  'monitored_targets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    publicLabel: text('public_label'),
    hostOrIp: text('host_or_ip').notNull(),
    customerId: uuid('customer_id').references(() => customersTable.id, { onDelete: 'set null' }),
    siteId: uuid('site_id').references(() => sitesTable.id, { onDelete: 'set null' }),
    serviceId: uuid('service_id').references(() => servicesTable.id, { onDelete: 'set null' }),
    targetType: text('target_type', {
      enum: ['ip', 'hostname', 'service', 'controller'],
    })
      .notNull()
      .default('ip'),
    provider: text('provider'),
    region: text('region'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    status: text('status', { enum: ['up', 'down', 'degraded', 'unknown'] })
      .notNull()
      .default('unknown'),
    statusSource: text('status_source', { enum: ['manual', 'nagios', 'controller', 'synthetic'] })
      .notNull()
      .default('manual'),
    isPublic: boolean('is_public').notNull().default(false),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('monitored_targets_host_or_ip_uidx').on(table.hostOrIp),
    uniqueIndex('monitored_targets_public_label_uidx').on(table.publicLabel),
  ],
);

export const insertMonitoredTargetSchema = createInsertSchema(monitoredTargetsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMonitoredTargetApiSchema = insertMonitoredTargetSchema
  .omit({
    status: true,
    statusSource: true,
    lastCheckedAt: true,
    lastSuccessAt: true,
    lastFailureAt: true,
  })
  .extend({
    status: z.enum(['up', 'down', 'degraded', 'unknown']).optional(),
    statusSource: z.enum(['manual', 'nagios', 'controller', 'synthetic']).optional(),
    lastCheckedAt: z.coerce.date().optional(),
    lastSuccessAt: z.coerce.date().optional(),
    lastFailureAt: z.coerce.date().optional(),
  });

export type InsertMonitoredTarget = z.infer<typeof insertMonitoredTargetSchema>;
export type InsertMonitoredTargetApi = z.infer<typeof insertMonitoredTargetApiSchema>;
export type MonitoredTarget = typeof monitoredTargetsTable.$inferSelect;