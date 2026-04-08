import { Router, type IRouter } from "express";
import { db, deviceEventsTable, controllersTable, managedDevicesTable, customersTable, sitesTable, incidentCorrelationsTable, ticketsTable } from "@workspace/db";
import { eq, desc, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { summarizeControllerEvent, inferProbableImpact } from "../lib/ai";

const router: IRouter = Router();

router.get("/device-events", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === "telecom_services_partner") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const { controllerId, customerId, siteId, severity, search } = req.query as Record<string, string>;

  let events = await db
    .select()
    .from(deviceEventsTable)
    .orderBy(desc(deviceEventsTable.occurredAt));

  if (controllerId) events = events.filter((e) => e.controllerId === controllerId);
  if (customerId) events = events.filter((e) => e.customerId === customerId);
  if (siteId) events = events.filter((e) => e.siteId === siteId);
  if (severity) events = events.filter((e) => e.severity === severity);
  if (search) {
    const q = search.toLowerCase();
    events = events.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q)
    );
  }

  const controllerIds = [...new Set(events.map((e) => e.controllerId))];
  const customerIds = [...new Set(events.map((e) => e.customerId).filter(Boolean))] as string[];

  const [controllers, customers] = await Promise.all([
    controllerIds.length ? db.select().from(controllersTable).where(or(...controllerIds.map((id) => eq(controllersTable.id, id)))) : [],
    customerIds.length ? db.select().from(customersTable).where(or(...customerIds.map((id) => eq(customersTable.id, id)))) : [],
  ]);

  const enriched = events.map((e) => ({
    ...e,
    controller: controllers.find((c) => c.id === e.controllerId) ?? null,
    customer: customers.find((c) => c.id === e.customerId) ?? null,
  }));

  res.json(enriched);
});

router.get("/device-events/:id", requireAuth, async (req, res): Promise<void> => {
  const [event] = await db
    .select()
    .from(deviceEventsTable)
    .where(eq(deviceEventsTable.id, req.params.id));

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const [controller, device, customer, site] = await Promise.all([
    db.select().from(controllersTable).where(eq(controllersTable.id, event.controllerId)).then((r) => r[0] ?? null),
    event.managedDeviceId ? db.select().from(managedDevicesTable).where(eq(managedDevicesTable.id, event.managedDeviceId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    event.customerId ? db.select().from(customersTable).where(eq(customersTable.id, event.customerId)).then((r) => r[0] ?? null) : Promise.resolve(null),
    event.siteId ? db.select().from(sitesTable).where(eq(sitesTable.id, event.siteId)).then((r) => r[0] ?? null) : Promise.resolve(null),
  ]);

  // Find linked ticket via incident correlation
  const correlations = await db
    .select()
    .from(incidentCorrelationsTable)
    .where(eq(incidentCorrelationsTable.deviceEventId, event.id));

  const ticketIds = correlations.map((c) => c.ticketId);
  const linkedTickets =
    ticketIds.length > 0
      ? await db.select().from(ticketsTable).where(or(...ticketIds.map((id) => eq(ticketsTable.id, id))))
      : [];

  res.json({ ...event, controller, device, customer, site, linkedTickets, correlations });
});

// AI analysis for a single event
router.post("/device-events/:id/ai-analyze", requireAuth, async (req, res): Promise<void> => {
  const [event] = await db
    .select()
    .from(deviceEventsTable)
    .where(eq(deviceEventsTable.id, req.params.id));

  if (!event) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  let device: typeof managedDevicesTable.$inferSelect | null = null;
  if (event.managedDeviceId) {
    const [d] = await db.select().from(managedDevicesTable).where(eq(managedDevicesTable.id, event.managedDeviceId));
    device = d ?? null;
  }

  try {
    const [summaryResult, impactResult] = await Promise.all([
      summarizeControllerEvent({
        title: event.title,
        description: event.description ?? null,
        eventType: event.eventType,
        severity: event.severity,
        vendor: device?.vendor ?? event.eventSource,
        deviceType: device?.deviceType ?? null,
        deviceStatus: device?.status ?? null,
      }),
      inferProbableImpact({
        title: event.title,
        description: event.description ?? null,
        eventType: event.eventType,
        severity: event.severity,
        vendor: device?.vendor ?? event.eventSource,
        deviceType: device?.deviceType ?? null,
      }),
    ]);

    const [updated] = await db
      .update(deviceEventsTable)
      .set({
        aiSummary: summaryResult.summary,
        aiProbableImpact: impactResult.probableImpact,
        confidenceScore: summaryResult.confidence,
        normalizedStatus: summaryResult.normalizedStatus ?? null,
      })
      .where(eq(deviceEventsTable.id, event.id))
      .returning();

    res.json({
      aiSummary: summaryResult.summary,
      aiProbableImpact: impactResult.probableImpact,
      confidence: summaryResult.confidence,
      normalizedStatus: summaryResult.normalizedStatus,
    });
  } catch (err: any) {
    res.status(500).json({ error: "AI analysis failed", message: err.message });
  }
});

export default router;
