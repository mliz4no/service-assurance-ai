import { pgTable, text, timestamp, uuid, integer, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';

export const slaPoliciesTable = pgTable('sla_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
  initialResponseMinutes: integer('initial_response_minutes').notNull(),
  escalationMinutes: integer('escalation_minutes').notNull(),
  resolutionTargetMinutes: integer('resolution_target_minutes').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertSlaPolicySchema = createInsertSchema(slaPoliciesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertSlaPolicy = z.infer<typeof insertSlaPolicySchema>;
export type SlaPolicy = typeof slaPoliciesTable.$inferSelect;
