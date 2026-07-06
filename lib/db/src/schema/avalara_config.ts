import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const avalaraConfigTable = pgTable('avalara_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AvalaraConfig = typeof avalaraConfigTable.$inferSelect;
