import { pgTable, text, timestamp, uuid, real, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { managedDevicesTable } from "./managed_devices";
import { servicesTable } from "./services";
import { customersTable } from "./customers";
import { sitesTable } from "./sites";

export const networkLinksTable = pgTable("network_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  managedDeviceId: uuid("managed_device_id").notNull().references(() => managedDevicesTable.id, { onDelete: "cascade" }),
  serviceId: uuid("service_id").references(() => servicesTable.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
  siteId: uuid("site_id").references(() => sitesTable.id, { onDelete: "set null" }),
  linkName: text("link_name").notNull(),
  linkType: text("link_type", { enum: ["internet", "mpls", "lte", "broadband", "wan_uplink", "vpn_tunnel", "sdwan_transport"] }).notNull(),
  providerName: text("provider_name"),
  circuitId: text("circuit_id"),
  role: text("role", { enum: ["primary", "backup", "unknown"] }).notNull().default("unknown"),
  status: text("status", { enum: ["up", "down", "degraded", "unknown"] }).notNull().default("unknown"),
  latencyMs: real("latency_ms"),
  jitterMs: real("jitter_ms"),
  packetLossPct: real("packet_loss_pct"),
  /** True when a backup/cellular link is actively carrying traffic due to primary failure */
  failoverActive: boolean("failover_active").notNull().default(false),
  /** Controller-native network name (e.g. Meraki network name) */
  networkName: text("network_name"),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertNetworkLinkSchema = createInsertSchema(networkLinksTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertNetworkLink = z.infer<typeof insertNetworkLinkSchema>;
export type NetworkLink = typeof networkLinksTable.$inferSelect;
