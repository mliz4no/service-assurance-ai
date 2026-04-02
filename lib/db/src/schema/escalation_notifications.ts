import { pgTable, text, uuid, integer, timestamp } from "drizzle-orm/pg-core";
import { ticketsTable } from "./tickets";
import { customerContactsTable } from "./customer_contacts";

export const escalationNotificationsTable = pgTable("escalation_notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketId: uuid("ticket_id").notNull().references(() => ticketsTable.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id").references(() => customerContactsTable.id, { onDelete: "set null" }),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactRole: text("contact_role").notNull(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }).notNull().defaultNow(),
  severity: text("severity").notNull(),
  channel: text("channel").notNull().default("email"),
  reason: text("reason", { enum: ["severity_threshold", "duration_threshold", "manual"] }).notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(0),
  message: text("message").notNull(),
  status: text("status", { enum: ["simulated", "sent", "failed"] }).notNull().default("simulated"),
  ruleDescription: text("rule_description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EscalationNotification = typeof escalationNotificationsTable.$inferSelect;
export type InsertEscalationNotification = typeof escalationNotificationsTable.$inferInsert;
