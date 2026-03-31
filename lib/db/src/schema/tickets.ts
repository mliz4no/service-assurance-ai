import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { customersTable } from "./customers";
import { sitesTable } from "./sites";
import { servicesTable } from "./services";
import { usersTable } from "./users";

export const ticketsTable = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  ticketNumber: text("ticket_number").notNull().unique(),
  customerId: uuid("customer_id").notNull().references(() => customersTable.id, { onDelete: "cascade" }),
  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  source: text("source", { enum: ["manual", "email", "api", "controller"] }).notNull().default("manual"),
  severity: text("severity", { enum: ["low", "medium", "high", "critical"] }).notNull(),
  status: text("status", { enum: ["new", "investigating", "vendor_engaged", "dispatch_scheduled", "monitoring", "resolved", "closed"] }).notNull().default("new"),
  outageType: text("outage_type", { enum: ["outage", "impairment", "informational", "unknown"] }).notNull().default("unknown"),
  vendorTicketId: text("vendor_ticket_id"),
  assignedToUserId: uuid("assigned_to_user_id").references(() => usersTable.id, { onDelete: "set null" }),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  nextEscalationAt: timestamp("next_escalation_at", { withTimezone: true }),
  slaTargetMinutes: integer("sla_target_minutes"),
  // AI fields
  aiSummary: text("ai_summary"),
  aiNormalizedStatus: text("ai_normalized_status"),
  aiCustomerUpdate: text("ai_customer_update"),
  aiLastGeneratedAt: timestamp("ai_last_generated_at", { withTimezone: true }),
  // Per-operation timestamps (traceability)
  aiSummarizedAt: timestamp("ai_summarized_at", { withTimezone: true }),
  aiNormalizedAt: timestamp("ai_normalized_at", { withTimezone: true }),
  aiCustomerUpdateAt: timestamp("ai_customer_update_at", { withTimezone: true }),
  // AI confidence score (0-100) from the most recent AI operation
  aiConfidence: integer("ai_confidence"),
  aiProbableImpact: text("ai_probable_impact"),
  // Controller-sourced incident fields
  incidentSource: text("incident_source", { enum: ["manual", "email", "controller"] }).default("manual"),
  impactedDeviceId: uuid("impacted_device_id"),
  impactedLinkId: uuid("impacted_link_id"),
  failoverActive: boolean("failover_active").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTicketSchema = createInsertSchema(ticketsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof ticketsTable.$inferSelect;
