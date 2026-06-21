import { pgTable, text, timestamp, uuid, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';

export const crmSyncLogsTable = pgTable('crm_sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  connector: text('connector').notNull(),
  syncType: text('sync_type', { enum: ['accounts', 'contacts', 'full'] })
    .notNull()
    .default('full'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  status: text('status', { enum: ['running', 'success', 'failed'] })
    .notNull()
    .default('running'),
  message: text('message'),
  recordsProcessed: integer('records_processed'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertCrmSyncLogSchema = createInsertSchema(crmSyncLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertCrmSyncLog = z.infer<typeof insertCrmSyncLogSchema>;
export type CrmSyncLog = typeof crmSyncLogsTable.$inferSelect;
