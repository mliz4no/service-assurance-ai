import {
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  numeric,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod/v4';
import { customersTable } from './customers';
import { sitesTable } from './sites';
import { servicesTable } from './services';
import { usersTable } from './users';

export const invoiceComplaintsTable = pgTable(
  'invoice_complaints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    complaintNumber: text('complaint_number').notNull().unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customersTable.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sitesTable.id, { onDelete: 'set null' }),
    serviceId: uuid('service_id').references(() => servicesTable.id, { onDelete: 'set null' }),
    assignedToUserId: uuid('assigned_to_user_id').references(() => usersTable.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    description: text('description'),
    source: text('source', { enum: ['manual', 'api'] })
      .notNull()
      .default('manual'),
    status: text('status', {
      enum: ['new', 'triaged', 'awaiting_customer', 'resolved', 'closed'],
    })
      .notNull()
      .default('new'),
    priority: text('priority', { enum: ['low', 'medium', 'high'] })
      .notNull()
      .default('medium'),
    complaintType: text('complaint_type', {
      enum: ['tax_mismatch', 'rate_mismatch', 'duplicate_charge', 'missing_exemption', 'other'],
    })
      .notNull()
      .default('other'),
    invoiceNumber: text('invoice_number').notNull(),
    customerAccountNumber: text('customer_account_number').notNull(),
    currencyCode: text('currency_code').notNull().default('USD'),
    invoiceAmount: numeric('invoice_amount', { precision: 12, scale: 2 }),
    documentCode: text('document_code'),
    companyCode: text('company_code'),
    avalaraValidationStatus: text('avalara_validation_status', {
      enum: ['not_validated', 'validated', 'failed'],
    })
      .notNull()
      .default('not_validated'),
    avalaraValidatedAt: timestamp('avalara_validated_at', { withTimezone: true }),
    avalaraSummary: text('avalara_summary'),
    externalSource: text('external_source'),
    externalId: text('external_id'),
    externalSyncedAt: timestamp('external_synced_at', { withTimezone: true }),
    externalSyncStatus: text('external_sync_status'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('invoice_complaints_external_source_external_id_uidx').on(
      table.externalSource,
      table.externalId,
    ),
  ],
);

export const insertInvoiceComplaintSchema = createInsertSchema(invoiceComplaintsTable).omit({
  id: true,
  complaintNumber: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertInvoiceComplaint = z.infer<typeof insertInvoiceComplaintSchema>;
export type InvoiceComplaint = typeof invoiceComplaintsTable.$inferSelect;
