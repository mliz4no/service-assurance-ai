import { integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { monitoredTargetsTable } from './monitored_targets';

export const MONITORING_CHECK_TYPES = [
  'http',
  'tcp',
  'icmp',
  'dns',
  'tls',
] as const;
export type MonitoringCheckType = (typeof MONITORING_CHECK_TYPES)[number];

export const monitoringChecksTable = pgTable('monitoring_checks', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetId: uuid('target_id')
    .notNull()
    .references(() => monitoredTargetsTable.id, { onDelete: 'cascade' }),
  source: text('source', { enum: ['manual', 'synthetic', 'nagios', 'controller'] })
    .notNull()
    .default('manual'),
  checkType: text('check_type', { enum: MONITORING_CHECK_TYPES }).notNull(),
  status: text('status', { enum: ['up', 'down', 'degraded', 'unknown'] }).notNull(),
  responseTimeMs: integer('response_time_ms'),
  payloadJson: jsonb('payload_json'),
  checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertMonitoringCheckSchema = createInsertSchema(monitoringChecksTable).omit({
  id: true,
  createdAt: true,
});

export type InsertMonitoringCheck = z.infer<typeof insertMonitoringCheckSchema>;
export type MonitoringCheck = typeof monitoringChecksTable.$inferSelect;