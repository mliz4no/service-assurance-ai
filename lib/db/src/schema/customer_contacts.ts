import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { customersTable } from "./customers";

export const customerContactsTable = pgTable("customer_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  role: text("role", { enum: ["noc", "manager", "director", "executive"] }).notNull().default("noc"),
  notifyOnSeverity: text("notify_on_severity", { enum: ["low", "medium", "high", "critical"] }).notNull().default("high"),
  notifyOnDurationMinutes: integer("notify_on_duration_minutes"),
  notificationChannels: text("notification_channels").notNull().default("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type CustomerContact = typeof customerContactsTable.$inferSelect;
export type InsertCustomerContact = typeof customerContactsTable.$inferInsert;
