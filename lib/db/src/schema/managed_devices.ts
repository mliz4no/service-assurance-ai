import { doublePrecision, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { controllersTable } from './controllers';
import { customersTable } from './customers';
import { sitesTable } from './sites';

export const managedDevicesTable = pgTable('managed_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  controllerId: uuid('controller_id')
    .notNull()
    .references(() => controllersTable.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id').references(() => customersTable.id, { onDelete: 'set null' }),
  siteId: uuid('site_id').references(() => sitesTable.id, { onDelete: 'set null' }),
  hostname: text('hostname').notNull(),
  deviceType: text('device_type', {
    enum: ['firewall', 'sdwan_edge', 'appliance', 'switch', 'gateway'],
  }).notNull(),
  vendor: text('vendor').notNull(),
  serialNumber: text('serial_number'),
  controllerDeviceId: text('controller_device_id').notNull(),
  model: text('model'),
  mgmtIp: text('mgmt_ip'),
  status: text('status', { enum: ['online', 'offline', 'degraded', 'unknown'] })
    .notNull()
    .default('unknown'),
  haState: text('ha_state', { enum: ['active', 'standby', 'standalone', 'unknown'] }),
  /** Controller-native network/site name (e.g. Meraki network name, FortiManager ADOM) */
  networkName: text('network_name'),
  /** WGS-84 latitude — null means inherit from site */
  latitude: doublePrecision('latitude'),
  /** WGS-84 longitude — null means inherit from site */
  longitude: doublePrecision('longitude'),
  /** Origin of the coordinate */
  geoSource: text('geo_source', { enum: ['manual', 'inherited_from_site', 'imported'] }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  metadataJson: jsonb('metadata_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertManagedDeviceSchema = createInsertSchema(managedDevicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertManagedDevice = z.infer<typeof insertManagedDeviceSchema>;
export type ManagedDevice = typeof managedDevicesTable.$inferSelect;
