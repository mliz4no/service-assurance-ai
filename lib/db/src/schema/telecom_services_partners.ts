import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';

export const telecomServicesPartnersTable = pgTable('telecom_services_partners', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  companyName: text('company_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  status: text('status', { enum: ['active', 'inactive'] })
    .notNull()
    .default('active'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTelecomServicesPartnerSchema = createInsertSchema(
  telecomServicesPartnersTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTelecomServicesPartner = z.infer<typeof insertTelecomServicesPartnerSchema>;
export type TelecomServicesPartner = typeof telecomServicesPartnersTable.$inferSelect;
