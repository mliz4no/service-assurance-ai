import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { ticketsTable } from './tickets';
import { usersTable } from './users';

export const ticketUpdatesTable = pgTable('ticket_updates', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => ticketsTable.id, { onDelete: 'cascade' }),
  updateType: text('update_type', {
    enum: ['internal_note', 'vendor_update', 'customer_update', 'system_event', 'ai_generated'],
  }).notNull(),
  rawText: text('raw_text').notNull(),
  normalizedStatus: text('normalized_status'),
  // Source text used when AI generated this entry (only set for ai_generated type)
  aiSourceText: text('ai_source_text'),
  visibility: text('visibility', { enum: ['internal', 'customer'] })
    .notNull()
    .default('internal'),
  createdByUserId: uuid('created_by_user_id').references(() => usersTable.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertTicketUpdateSchema = createInsertSchema(ticketUpdatesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertTicketUpdate = z.infer<typeof insertTicketUpdateSchema>;
export type TicketUpdate = typeof ticketUpdatesTable.$inferSelect;
