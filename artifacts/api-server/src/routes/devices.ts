import { Router, type IRouter } from "express";
import { db, managedDevicesTable, networkLinksTable, deviceEventsTable, controllersTable, customersTable, sitesTable, incidentCorrelationsTable, ticketsTable } from "@workspace/db";
import { eq, and, desc, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/devices", requireAuth, async (req, res): Promise<void> => {
  const { customerId, siteId, controllerId, status, search } = req.query as Record<string, string>;

  let devices = await db.select().from(managedDevicesTable).orderBy(managedDevicesTable.hostname);

  if (req.user?.role === "telecom_services_partner") {
    const pIds = req.partnerCustomerIds ?? [];
    devices = devices.filter((d) => d.customerId && pIds.includes(d.customerId));
  }

  // Simple in-memory filtering
  if (customerId) devices = devices.filter((d) => d.customerId === customerId);
  if (siteId) devices = devices.filter((d) => d.siteId === siteId);
  if (controllerId) devices = devices.filter((d) => d.controllerId === controllerId);
  if (status) devices = devices.filter((d) => d.status === status);
  if (search) {
    const q = search.toLowerCase();
    devices = devices.filter(
      (d) =>
        d.hostname.toLowerCase().includes(q) ||
        d.vendor.toLowerCase().includes(q) ||
        (d.model ?? "").toLowerCase().includes(q) ||
        (d.serialNumber ?? "").toLowerCase().includes(q)
    );
  }

  // Enrich with controller/customer/site names
  const controllerIds = [...new Set(devices.map((d) => d.controllerId))];
  const customerIds = [...new Set(devices.map((d) => d.customerId).filter(Boolean))] as string[];
  const siteIds = [...new Set(devices.map((d) => d.siteId).filter(Boolean))] as string[];

  const [controllers, customers, sites] = await Promise.all([
    controllerIds.length ? db.select().from(controllersTable).where(or(...controllerIds.map((id) => eq(controllersTable.id, id)))) : [],
    customerIds.length ? db.select().from(customersTable).where(or(...customerIds.map((id) => eq(customersTable.id, id)))) : [],
    siteIds.length ? db.select().from(sitesTable).where(or(...siteIds.map((id) => eq(sitesTable.id, id)))) : [],
  ]);

  const enriched = devices.map((d) => ({
    ...d,
    controller: controllers.find((c) => c.id === d.controllerId) ?? null,
    customer: customers.find((c) => c.id === d.customerId) ?? null,
    site: sites.find((s) => s.id === d.siteId) ?? null,
  }));

  res.json(enriched);
});

router.get("/devices/:id", requireAuth, async (req, res): Promise<void> => {
  const [device] = await db
    .select()
    .from(managedDevicesTable)
    .where(eq(managedDevicesTable.id, req.params.id));

  if (!device) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  const [links, recentEvents, controller, customer, site] = await Promise.all([
    db.select().from(networkLinksTable).where(eq(networkLinksTable.managedDeviceId, device.id)),
    db
      .select()
      .from(deviceEventsTable)
      .where(eq(deviceEventsTable.managedDeviceId, device.id))
      .orderBy(desc(deviceEventsTable.occurredAt))
      .limit(20),
    db.select().from(controllersTable).where(eq(controllersTable.id, device.controllerId)).then((r) => r[0] ?? null),
    device.customerId ? db.select().from(customersTable).where(eq(customersTable.id, device.customerId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    device.siteId ? db.select().from(sitesTable).where(eq(sitesTable.id, device.siteId)).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);

  // Get correlated tickets
  const correlations = await db
    .select({ ticketId: incidentCorrelationsTable.ticketId })
    .from(incidentCorrelationsTable)
    .innerJoin(deviceEventsTable, eq(incidentCorrelationsTable.deviceEventId, deviceEventsTable.id))
    .where(eq(deviceEventsTable.managedDeviceId, device.id));

  const ticketIds = [...new Set(correlations.map((c) => c.ticketId))];
  const linkedTickets =
    ticketIds.length > 0
      ? await db.select().from(ticketsTable).where(or(...ticketIds.map((id) => eq(ticketsTable.id, id))))
      : [];

  res.json({
    ...device,
    controller,
    customer,
    site,
    links,
    recentEvents,
    linkedTickets,
  });
});

router.put("/devices/:id", requireAuth, async (req, res): Promise<void> => {
  const [existing] = await db.select().from(managedDevicesTable).where(eq(managedDevicesTable.id, req.params.id));
  if (!existing) {
    res.status(404).json({ error: "Device not found" });
    return;
  }

  const { customerId, siteId, hostname, status } = req.body;
  const [updated] = await db
    .update(managedDevicesTable)
    .set({
      customerId: customerId ?? existing.customerId,
      siteId: siteId ?? existing.siteId,
      hostname: hostname ?? existing.hostname,
      status: status ?? existing.status,
    })
    .where(eq(managedDevicesTable.id, req.params.id))
    .returning();

  res.json(updated);
});

export default router;
