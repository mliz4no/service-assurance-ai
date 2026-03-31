import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { controllersTable } from "./controllers";
import { managedDevicesTable } from "./managed_devices";
import { customersTable } from "./customers";
import { sitesTable } from "./sites";
import { servicesTable } from "./services";

export const deviceEventsTable = pgTable("device_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  controllerId: uuid("controller_id").notNull().references(() => controllersTable.id, { onDelete: "cascade" }),
  managedDeviceId: uuid("managed_device_id").references(() => managedDevicesTable.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  serviceId: uuid("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  rawEventId: text("raw_event_id").notNull(),
  eventSource: text("event_source").notNull(),
  severity: text("severity", { enum: ["informational", "low", "medium", "high", "critical"] }).notNull().default("informational"),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  normalizedStatus: text("normalized_status"),
  aiSummary: text("ai_summary"),
  aiProbableImpact: text("ai_probable_impact"),
  aiCustomerUpdate: text("ai_customer_update"),
  confidenceScore: integer("confidence_score"),
  /** Vendor event category (e.g. Meraki: "appliance_connectivity", "vpn", "security", "device") */
  category: text("category"),
  rawPayloadJson: jsonb("raw_payload_json"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDeviceEventSchema = createInsertSchema(deviceEventsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertDeviceEvent = z.infer<typeof insertDeviceEventSchema>;
export type DeviceEvent = typeof deviceEventsTable.$inferSelect;
