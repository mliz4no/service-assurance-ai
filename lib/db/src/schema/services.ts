import { pgTable, text, timestamp, uuid, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { sitesTable } from "./sites";

export const servicesTable = pgTable("services", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").notNull().references(() => sitesTable.id, { onDelete: "cascade" }),
  vendorName: text("vendor_name").notNull(),
  serviceType: text("service_type", { enum: ["DIA", "Broadband", "SD-WAN", "Voice", "Wireless", "Other"] }).notNull(),
  circuitId: text("circuit_id"),
  bandwidth: text("bandwidth"),
  status: text("status", { enum: ["active", "pending", "down", "impaired", "disconnected"] }).notNull().default("active"),
  installDate: text("install_date"),
  monthlyRecurringCharge: numeric("monthly_recurring_charge", { precision: 10, scale: 2 }),
  supportReference: text("support_reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServiceSchema = createInsertSchema(servicesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;
