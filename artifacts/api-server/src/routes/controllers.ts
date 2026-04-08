import { Router, type IRouter } from "express";
import { db, controllersTable, managedDevicesTable, networkLinksTable, deviceEventsTable, controllerSyncLogsTable, incidentCorrelationsTable, ticketsTable } from "@workspace/db";
import { eq, desc, and, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import { createConnector } from "../connectors";
import { correlateEvent } from "../lib/incident-correlator";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// ── List controllers ─────────────────────────────────────────────────────────

router.get("/controllers", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === "telecom_services_partner") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const controllers = await db.select().from(controllersTable).orderBy(controllersTable.name);

  const enriched = await Promise.all(
    controllers.map(async (c) => {
      const [deviceCount] = await db
        .select({ count: count() })
        .from(managedDevicesTable)
        .where(eq(managedDevicesTable.controllerId, c.id));
      const [eventCount] = await db
        .select({ count: count() })
        .from(deviceEventsTable)
        .where(eq(deviceEventsTable.controllerId, c.id));
      return {
        ...c,
        deviceCount: Number(deviceCount?.count ?? 0),
        eventCount: Number(eventCount?.count ?? 0),
      };
    })
  );

  res.json(enriched);
});

// ── Get one controller ────────────────────────────────────────────────────────

router.get("/controllers/:id", requireAuth, async (req, res): Promise<void> => {
  const [controller] = await db.select().from(controllersTable).where(eq(controllersTable.id, req.params.id));
  if (!controller) {
    res.status(404).json({ error: "Controller not found" });
    return;
  }

  const [recentLogs, devices, linkCountResult, events] = await Promise.all([
    db.select().from(controllerSyncLogsTable)
      .where(eq(controllerSyncLogsTable.controllerId, controller.id))
      .orderBy(desc(controllerSyncLogsTable.startedAt))
      .limit(10),
    db.select().from(managedDevicesTable)
      .where(eq(managedDevicesTable.controllerId, controller.id)),
    db.select({ count: count() })
      .from(networkLinksTable)
      .innerJoin(managedDevicesTable, eq(networkLinksTable.managedDeviceId, managedDevicesTable.id))
      .where(eq(managedDevicesTable.controllerId, controller.id)),
    db.select().from(deviceEventsTable)
      .where(eq(deviceEventsTable.controllerId, controller.id))
      .orderBy(desc(deviceEventsTable.occurredAt))
      .limit(20),
  ]);

  res.json({
    ...controller,
    recentSyncLogs: recentLogs,
    deviceCount: devices.length,
    linkCount: Number(linkCountResult[0]?.count ?? 0),
    eventCount: events.length,
    recentEvents: events,
  });
});

// ── Create controller ─────────────────────────────────────────────────────────

router.post("/controllers", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { name, vendor, type, baseUrl, authType, apiKeyEncryptedOrPlaceholder, organizationIdOrTenant, pollingEnabled, pollingIntervalSeconds } = req.body;

  if (!name || !vendor || !type || !baseUrl) {
    res.status(400).json({ error: "Bad Request", message: "name, vendor, type, baseUrl are required" });
    return;
  }

  const [controller] = await db
    .insert(controllersTable)
    .values({
      name,
      vendor,
      type,
      baseUrl,
      authType: authType ?? "api_key",
      apiKeyEncryptedOrPlaceholder: apiKeyEncryptedOrPlaceholder ?? null,
      organizationIdOrTenant: organizationIdOrTenant ?? null,
      pollingEnabled: pollingEnabled ?? false,
      pollingIntervalSeconds: pollingIntervalSeconds ?? 300,
    })
    .returning();

  res.status(201).json(controller);
});

// ── Update controller ─────────────────────────────────────────────────────────

router.put("/controllers/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { name, vendor, type, baseUrl, authType, apiKeyEncryptedOrPlaceholder, organizationIdOrTenant, pollingEnabled, pollingIntervalSeconds } = req.body;

  const [existing] = await db.select().from(controllersTable).where(eq(controllersTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Controller not found" });
    return;
  }

  const [updated] = await db
    .update(controllersTable)
    .set({
      name: name ?? existing.name,
      vendor: vendor ?? existing.vendor,
      type: type ?? existing.type,
      baseUrl: baseUrl ?? existing.baseUrl,
      authType: authType ?? existing.authType,
      apiKeyEncryptedOrPlaceholder: apiKeyEncryptedOrPlaceholder ?? existing.apiKeyEncryptedOrPlaceholder,
      organizationIdOrTenant: organizationIdOrTenant ?? existing.organizationIdOrTenant,
      pollingEnabled: pollingEnabled ?? existing.pollingEnabled,
      pollingIntervalSeconds: pollingIntervalSeconds ?? existing.pollingIntervalSeconds,
    })
    .where(eq(controllersTable.id, req.params.id))
    .returning();

  res.json(updated);
});

// ── Delete controller ─────────────────────────────────────────────────────────

router.delete("/controllers/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const [existing] = await db.select().from(controllersTable).where(eq(controllersTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Controller not found" });
    return;
  }

  await db.delete(controllersTable).where(eq(controllersTable.id, req.params.id));
  res.json({ success: true });
});

// ── Test connection ────────────────────────────────────────────────────────────

router.post("/controllers/:id/test", requireAuth, async (req, res): Promise<void> => {
  const [controller] = await db.select().from(controllersTable).where(eq(controllersTable.id, req.params.id));
  if (!controller) {
    res.status(404).json({ error: "Controller not found" });
    return;
  }

  const connector = createConnector(controller);
  if (!connector) {
    res.status(400).json({ error: "Unsupported vendor" });
    return;
  }

  const result = await connector.testConnection();
  res.json(result);
});

// ── Sync one controller ───────────────────────────────────────────────────────

router.post("/controllers/:id/sync", requireAuth, async (req, res): Promise<void> => {
  const [controller] = await db.select().from(controllersTable).where(eq(controllersTable.id, req.params.id));
  if (!controller) {
    res.status(404).json({ error: "Controller not found" });
    return;
  }

  const [syncLog] = await db
    .insert(controllerSyncLogsTable)
    .values({ controllerId: controller.id, syncType: "full", status: "running" })
    .returning();

  // Run sync asynchronously; respond immediately with log ID
  res.json({ syncLogId: syncLog.id, message: "Sync started" });

  // Execute sync in background
  runSync(controller, syncLog.id).catch((err) =>
    logger.error({ err, controllerId: controller.id }, "Controller sync failed")
  );
});

// ── Sync all enabled controllers ──────────────────────────────────────────────

router.post("/controllers/sync/all", requireAuth, async (req, res): Promise<void> => {
  const controllers = await db
    .select()
    .from(controllersTable)
    .where(eq(controllersTable.pollingEnabled, true));

  if (controllers.length === 0) {
    res.json({ message: "No polling-enabled controllers found", started: 0 });
    return;
  }

  const logs: Array<{ controllerId: string; syncLogId: string }> = [];
  for (const controller of controllers) {
    const [syncLog] = await db
      .insert(controllerSyncLogsTable)
      .values({ controllerId: controller.id, syncType: "full", status: "running" })
      .returning();
    logs.push({ controllerId: controller.id, syncLogId: syncLog.id });
    runSync(controller, syncLog.id).catch((err) =>
      logger.error({ err, controllerId: controller.id }, "Controller sync failed")
    );
  }

  res.json({ message: "Sync started for all enabled controllers", started: logs.length, logs });
});

// ── Sync engine (internal) ────────────────────────────────────────────────────

async function runSync(controller: typeof controllersTable.$inferSelect, syncLogId: string): Promise<void> {
  const connector = createConnector(controller);
  if (!connector) {
    await db
      .update(controllerSyncLogsTable)
      .set({ status: "failed", message: "Unsupported vendor", completedAt: new Date() })
      .where(eq(controllerSyncLogsTable.id, syncLogId));
    return;
  }

  try {
    const { devices, links, events, errors } = await connector.fullSync();
    let recordsProcessed = 0;

    // Upsert devices
    for (const device of devices) {
      const [existing] = await db
        .select()
        .from(managedDevicesTable)
        .where(
          and(
            eq(managedDevicesTable.controllerId, controller.id),
            eq(managedDevicesTable.controllerDeviceId, device.controllerDeviceId)
          )
        );

      if (existing) {
        await db
          .update(managedDevicesTable)
          .set({
            hostname: device.hostname,
            status: device.status,
            haState: device.haState ?? null,
            networkName: device.networkName ?? null,
            lastSeenAt: device.lastSeenAt ?? null,
            mgmtIp: device.mgmtIp ?? null,
            model: device.model ?? null,
            metadataJson: device.metadataJson ?? null,
          })
          .where(eq(managedDevicesTable.id, existing.id));
      } else {
        await db.insert(managedDevicesTable).values({
          controllerId: controller.id,
          hostname: device.hostname,
          deviceType: device.deviceType,
          vendor: device.vendor,
          serialNumber: device.serialNumber ?? null,
          controllerDeviceId: device.controllerDeviceId,
          model: device.model ?? null,
          mgmtIp: device.mgmtIp ?? null,
          status: device.status,
          haState: device.haState ?? null,
          networkName: device.networkName ?? null,
          lastSeenAt: device.lastSeenAt ?? null,
          metadataJson: device.metadataJson ?? null,
        });
      }
      recordsProcessed++;
    }

    // Upsert links (tied to managed devices)
    for (const link of links) {
      const [device] = await db
        .select()
        .from(managedDevicesTable)
        .where(
          and(
            eq(managedDevicesTable.controllerId, controller.id),
            eq(managedDevicesTable.controllerDeviceId, link.controllerDeviceId)
          )
        );

      if (!device) continue;

      const [existingLink] = await db
        .select()
        .from(networkLinksTable)
        .where(
          and(
            eq(networkLinksTable.managedDeviceId, device.id),
            eq(networkLinksTable.linkName, link.linkName)
          )
        );

      if (existingLink) {
        await db
          .update(networkLinksTable)
          .set({
            status: link.status,
            failoverActive: link.failoverActive ?? false,
            networkName: link.networkName ?? null,
            latencyMs: link.latencyMs ?? null,
            jitterMs: link.jitterMs ?? null,
            packetLossPct: link.packetLossPct ?? null,
            lastPolledAt: new Date(),
            metadataJson: link.metadataJson ?? null,
          })
          .where(eq(networkLinksTable.id, existingLink.id));
      } else {
        await db.insert(networkLinksTable).values({
          managedDeviceId: device.id,
          customerId: device.customerId ?? null,
          siteId: device.siteId ?? null,
          linkName: link.linkName,
          linkType: link.linkType,
          providerName: link.providerName ?? null,
          circuitId: link.circuitId ?? null,
          role: link.role,
          status: link.status,
          failoverActive: link.failoverActive ?? false,
          networkName: link.networkName ?? null,
          latencyMs: link.latencyMs ?? null,
          jitterMs: link.jitterMs ?? null,
          packetLossPct: link.packetLossPct ?? null,
          lastPolledAt: new Date(),
          metadataJson: link.metadataJson ?? null,
        });
      }
      recordsProcessed++;
    }

    // Insert new events (skip duplicates by rawEventId)
    for (const event of events) {
      const [existing] = await db
        .select()
        .from(deviceEventsTable)
        .where(
          and(
            eq(deviceEventsTable.controllerId, controller.id),
            eq(deviceEventsTable.rawEventId, event.rawEventId)
          )
        );

      if (existing) continue;

      // Find the managed device for this event
      let managedDeviceId: string | null = null;
      let customerId: string | null = null;
      let siteId: string | null = null;

      if (event.controllerDeviceId) {
        const [dev] = await db
          .select()
          .from(managedDevicesTable)
          .where(
            and(
              eq(managedDevicesTable.controllerId, controller.id),
              eq(managedDevicesTable.controllerDeviceId, event.controllerDeviceId)
            )
          );
        if (dev) {
          managedDeviceId = dev.id;
          customerId = dev.customerId ?? null;
          siteId = dev.siteId ?? null;
        }
      }

      // Detect failover active (primary down, backup up)
      let failoverActive = false;
      if (managedDeviceId) {
        const allLinks = await db
          .select()
          .from(networkLinksTable)
          .where(eq(networkLinksTable.managedDeviceId, managedDeviceId));
        const primary = allLinks.find((l) => l.role === "primary");
        const backup = allLinks.find((l) => l.role === "backup");
        if (primary?.status === "down" && backup?.status === "up") {
          failoverActive = true;
        }
      }

      const [savedEvent] = await db
        .insert(deviceEventsTable)
        .values({
          controllerId: controller.id,
          managedDeviceId,
          customerId,
          siteId,
          rawEventId: event.rawEventId,
          eventSource: event.eventSource,
          severity: event.severity,
          eventType: event.eventType,
          category: event.category ?? null,
          title: event.title,
          description: event.description ?? null,
          rawPayloadJson: event.rawPayloadJson ?? null,
          occurredAt: event.occurredAt,
        })
        .returning();

      // Run incident correlation
      await correlateEvent({
        eventId: savedEvent.id,
        controllerId: controller.id,
        customerId,
        siteId,
        serviceId: null,
        managedDeviceId,
        severity: event.severity,
        eventType: event.eventType,
        title: event.title,
        description: event.description ?? null,
        failoverActive,
      }).catch((err) => logger.warn({ err }, "Incident correlation failed, continuing sync"));

      recordsProcessed++;
    }

    // Update controller last poll status
    await db
      .update(controllersTable)
      .set({
        lastPolledAt: new Date(),
        lastPollStatus: errors.length > 0 ? "failed" : "success",
        lastPollMessage: errors.length > 0 ? errors.join("; ") : "Sync completed",
      })
      .where(eq(controllersTable.id, controller.id));

    await db
      .update(controllerSyncLogsTable)
      .set({
        status: "success",
        completedAt: new Date(),
        recordsProcessed,
        message: `Synced ${devices.length} devices, ${links.length} links, ${events.length} events`,
      })
      .where(eq(controllerSyncLogsTable.id, syncLogId));

    logger.info({ controllerId: controller.id, recordsProcessed }, "Controller sync completed");
  } catch (err: any) {
    logger.error({ err, controllerId: controller.id }, "Controller sync error");

    await db
      .update(controllersTable)
      .set({ lastPolledAt: new Date(), lastPollStatus: "failed", lastPollMessage: err.message })
      .where(eq(controllersTable.id, controller.id));

    await db
      .update(controllerSyncLogsTable)
      .set({ status: "failed", completedAt: new Date(), message: err.message })
      .where(eq(controllerSyncLogsTable.id, syncLogId));
  }
}

export default router;
