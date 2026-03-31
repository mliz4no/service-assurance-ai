import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { controllersTable } from "./controllers";

export const controllerSyncLogsTable = pgTable("controller_sync_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  controllerId: uuid("controller_id").notNull().references(() => controllersTable.id, { onDelete: "cascade" }),
  syncType: text("sync_type", { enum: ["full", "devices", "links", "events"] }).notNull().default("full"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  status: text("status", { enum: ["running", "success", "failed"] }).notNull().default("running"),
  message: text("message"),
  recordsProcessed: integer("records_processed"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertControllerSyncLogSchema = createInsertSchema(controllerSyncLogsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertControllerSyncLog = z.infer<typeof insertControllerSyncLogSchema>;
export type ControllerSyncLog = typeof controllerSyncLogsTable.$inferSelect;
