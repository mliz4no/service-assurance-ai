import { Router, type IRouter } from "express";
import { db, customersTable, servicesTable, ticketsTable } from "@workspace/db";
import { eq, and, lt, desc, count, ne } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import { normalizeStatus } from "../lib/ai";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req, res): Promise<void> => {
  const customerCondition = req.user?.role === "customer" && req.user.customerId
    ? eq(customersTable.id, req.user.customerId)
    : undefined;

  const ticketBaseWhere = req.user?.role === "customer" && req.user.customerId
    ? eq(ticketsTable.customerId, req.user.customerId)
    : undefined;

  const [activeCustomers, activeServices, allTickets] = await Promise.all([
    db.select({ cnt: count() }).from(customersTable).where(eq(customersTable.status, "active")),
    db.select({ cnt: count() }).from(servicesTable).where(eq(servicesTable.status, "active")),
    db.select().from(ticketsTable).where(ticketBaseWhere),
  ]);

  const openStatuses = ["new", "investigating", "vendor_engaged", "dispatch_scheduled", "monitoring"];
  const openTickets = allTickets.filter((t) => openStatuses.includes(t.status));
  const criticalTickets = allTickets.filter((t) => t.severity === "critical" && openStatuses.includes(t.status));
  const now = new Date();
  const slaBreachingTickets = openTickets.filter((t) => t.nextEscalationAt && t.nextEscalationAt < now);

  const ticketsByStatus: Record<string, number> = {};
  const ticketsBySeverity: Record<string, number> = {};
  for (const t of allTickets) {
    ticketsByStatus[t.status] = (ticketsByStatus[t.status] ?? 0) + 1;
    ticketsBySeverity[t.severity] = (ticketsBySeverity[t.severity] ?? 0) + 1;
  }

  res.json({
    totalActiveCustomers: activeCustomers[0]?.cnt ?? 0,
    totalActiveServices: activeServices[0]?.cnt ?? 0,
    openTickets: openTickets.length,
    criticalTickets: criticalTickets.length,
    slaBreachingTickets: slaBreachingTickets.length,
    ticketsByStatus,
    ticketsBySeverity,
  });
});

router.get("/dashboard/recent-tickets", requireAuth, async (req, res): Promise<void> => {
  const limit = parseInt((req.query.limit as string) ?? "10", 10);
  const openStatuses = ["new", "investigating", "vendor_engaged", "dispatch_scheduled", "monitoring"];

  const whereConditions = [];
  if (req.user?.role === "customer" && req.user.customerId) {
    whereConditions.push(eq(ticketsTable.customerId, req.user.customerId));
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(whereConditions.length > 0 ? whereConditions[0] : undefined)
    .orderBy(desc(ticketsTable.openedAt))
    .limit(limit);

  const { inArray } = await import("drizzle-orm");
  const customerIds = [...new Set(tickets.map((t) => t.customerId))];
  const customers = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
    : [];

  const siteIds = [...new Set(tickets.map((t) => t.siteId).filter(Boolean) as string[])];
  const { sitesTable } = await import("@workspace/db");
  const sites = siteIds.length
    ? await db.select().from(sitesTable).where(inArray(sitesTable.id, siteIds))
    : [];

  const enriched = tickets.map((t) => ({
    ...t,
    customer: customers.find((c) => c.id === t.customerId) ?? null,
    site: sites.find((s) => s.id === t.siteId) ?? null,
    service: null,
    assignedTo: null,
  }));

  res.json(enriched);
});

router.get("/dashboard/escalation-needed", requireAuth, async (req, res): Promise<void> => {
  const now = new Date();
  const openStatuses = ["new", "investigating", "vendor_engaged", "dispatch_scheduled", "monitoring"];
  const { inArray, isNotNull, lt: drizzleLt } = await import("drizzle-orm");

  const whereConditions = [];
  if (req.user?.role === "customer" && req.user.customerId) {
    whereConditions.push(eq(ticketsTable.customerId, req.user.customerId));
  }

  const tickets = await db
    .select()
    .from(ticketsTable)
    .where(whereConditions.length > 0 ? whereConditions[0] : undefined)
    .orderBy(ticketsTable.nextEscalationAt);

  const escalationNeeded = tickets.filter(
    (t) => openStatuses.includes(t.status) && t.nextEscalationAt && t.nextEscalationAt < now
  );

  const customerIds = [...new Set(escalationNeeded.map((t) => t.customerId))];
  const customers = customerIds.length
    ? await db.select().from(customersTable).where(inArray(customersTable.id, customerIds))
    : [];

  const enriched = escalationNeeded.map((t) => ({
    ...t,
    customer: customers.find((c) => c.id === t.customerId) ?? null,
    site: null,
    service: null,
    assignedTo: null,
  }));

  res.json(enriched);
});

router.get("/admin/config-health", requireAuth, async (_req, res): Promise<void> => {
  let dbHealthy = false;
  try {
    await db.select({ cnt: count() }).from(customersTable);
    dbHealthy = true;
  } catch {
    dbHealthy = false;
  }

  res.json({
    database: dbHealthy,
    openAi: !!process.env.OPENAI_API_KEY,
    sessionSecret: !!process.env.SESSION_SECRET,
    environment: process.env.NODE_ENV ?? "development",
  });
});

router.post("/admin/ai-test", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { text } = req.body;
  if (!text) {
    res.status(400).json({ error: "Bad Request", message: "text is required" });
    return;
  }

  const result = await normalizeStatus({ text, ticketSeverity: "medium", ticketStatus: "new" });

  res.json({
    normalizedStatus: result.status,
    confidence: result.confidence,
    reasoning: result.reasoning,
  });
});

export default router;
