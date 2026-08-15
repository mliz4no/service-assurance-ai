import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const ticketNumberCountersTable = pgTable('ticket_number_counters', {
  key: text('key').primaryKey(),
  lastValue: integer('last_value').notNull(),
});