import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const controllersTable = pgTable("controllers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  vendor: text("vendor", { enum: ["meraki", "fortinet"] }).notNull(),
  type: text("type", { enum: ["sdwan", "firewall_manager", "network_manager"] }).notNull(),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type", { enum: ["api_key", "oauth", "basic"] }).notNull().default("api_key"),
  apiKeyEncryptedOrPlaceholder: text("api_key_encrypted_or_placeholder"),
  organizationIdOrTenant: text("organization_id_or_tenant"),
  pollingEnabled: boolean("polling_enabled").notNull().default(false),
  pollingIntervalSeconds: integer("polling_interval_seconds").notNull().default(300),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  lastPollStatus: text("last_poll_status", { enum: ["success", "failed", "running"] }),
  lastPollMessage: text("last_poll_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertControllerSchema = createInsertSchema(controllersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertController = z.infer<typeof insertControllerSchema>;
export type Controller = typeof controllersTable.$inferSelect;
