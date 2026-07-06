import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core';
import { invoiceComplaintsTable } from './invoice_complaints';
import { usersTable } from './users';

export const invoiceComplaintEventsTable = pgTable('invoice_complaint_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  complaintId: uuid('complaint_id')
    .notNull()
    .references(() => invoiceComplaintsTable.id, { onDelete: 'cascade' }),
  eventType: text('event_type', {
    enum: [
      'created',
      'status_changed',
      'assignment_changed',
      'note',
      'validation_requested',
      'validation_succeeded',
      'validation_failed',
    ],
  })
    .notNull()
    .default('note'),
  message: text('message').notNull(),
  metadata: jsonb('metadata'),
  createdByUserId: uuid('created_by_user_id').references(() => usersTable.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type InvoiceComplaintEvent = typeof invoiceComplaintEventsTable.$inferSelect;
export type InsertInvoiceComplaintEvent = typeof invoiceComplaintEventsTable.$inferInsert;
