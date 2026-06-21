import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { ticketsTable } from './tickets';
import { deviceEventsTable } from './device_events';

export const incidentCorrelationsTable = pgTable('incident_correlations', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => ticketsTable.id, { onDelete: 'cascade' }),
  deviceEventId: uuid('device_event_id')
    .notNull()
    .references(() => deviceEventsTable.id, { onDelete: 'cascade' }),
  correlationType: text('correlation_type', { enum: ['trigger', 'related', 'recovery'] })
    .notNull()
    .default('trigger'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncidentCorrelationSchema = createInsertSchema(incidentCorrelationsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertIncidentCorrelation = z.infer<typeof insertIncidentCorrelationSchema>;
export type IncidentCorrelation = typeof incidentCorrelationsTable.$inferSelect;
