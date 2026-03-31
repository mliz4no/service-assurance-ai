import { Router, type IRouter } from "express";
import { db, servicesTable, customersTable, sitesTable, ticketsTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/services", requireAuth, async (req, res): Promise<void> => {
  const { customerId, siteId, search, status, vendorName } = req.query as Record<string, string>;
  const conditions = [];

  if (req.user?.role === "customer" && req.user.customerId) {
    conditions.push(eq(servicesTable.customerId, req.user.customerId));
  } else if (customerId) {
    conditions.push(eq(servicesTable.customerId, customerId));
  }

  if (siteId) conditions.push(eq(servicesTable.siteId, siteId));
  if (status) conditions.push(eq(servicesTable.status, status as "active" | "pending" | "down" | "impaired" | "disconnected"));
  if (vendorName) conditions.push(ilike(servicesTable.vendorName, `%${vendorName}%`));
  if (search) {
    conditions.push(
      or(
        ilike(servicesTable.circuitId, `%${search}%`),
        ilike(servicesTable.vendorName, `%${search}%`)
      )
    );
  }

  const services = await db
    .select({
      id: servicesTable.id,
      customerId: servicesTable.customerId,
      siteId: servicesTable.siteId,
      vendorName: servicesTable.vendorName,
      serviceType: servicesTable.serviceType,
      circuitId: servicesTable.circuitId,
      bandwidth: servicesTable.bandwidth,
      status: servicesTable.status,
      installDate: servicesTable.installDate,
      monthlyRecurringCharge: servicesTable.monthlyRecurringCharge,
      supportReference: servicesTable.supportReference,
      notes: servicesTable.notes,
      createdAt: servicesTable.createdAt,
      updatedAt: servicesTable.updatedAt,
      customer: {
        id: customersTable.id,
        name: customersTable.name,
        accountNumber: customersTable.accountNumber,
        status: customersTable.status,
        primaryContactName: customersTable.primaryContactName,
        primaryContactEmail: customersTable.primaryContactEmail,
        primaryContactPhone: customersTable.primaryContactPhone,
        notes: customersTable.notes,
        createdAt: customersTable.createdAt,
        updatedAt: customersTable.updatedAt,
      },
      site: {
        id: sitesTable.id,
        customerId: sitesTable.customerId,
        siteName: sitesTable.siteName,
        address1: sitesTable.address1,
        address2: sitesTable.address2,
        city: sitesTable.city,
        state: sitesTable.state,
        postalCode: sitesTable.postalCode,
        country: sitesTable.country,
        timezone: sitesTable.timezone,
        siteCode: sitesTable.siteCode,
        notes: sitesTable.notes,
        createdAt: sitesTable.createdAt,
        updatedAt: sitesTable.updatedAt,
      },
    })
    .from(servicesTable)
    .leftJoin(customersTable, eq(servicesTable.customerId, customersTable.id))
    .leftJoin(sitesTable, eq(servicesTable.siteId, sitesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(servicesTable.vendorName);

  res.json(services);
});

router.post("/services", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === "customer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { customerId, siteId, vendorName, serviceType, circuitId, bandwidth, status, installDate, monthlyRecurringCharge, supportReference, notes } = req.body;
  if (!customerId || !siteId || !vendorName || !serviceType || !status) {
    res.status(400).json({ error: "Bad Request", message: "customerId, siteId, vendorName, serviceType, and status are required" });
    return;
  }

  const [service] = await db
    .insert(servicesTable)
    .values({ customerId, siteId, vendorName, serviceType, circuitId, bandwidth, status, installDate, monthlyRecurringCharge: monthlyRecurringCharge?.toString(), supportReference, notes })
    .returning();
  res.status(201).json(service);
});

router.get("/services/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, id));
  if (!service) {
    res.status(404).json({ error: "Not Found" });
    return;
  }

  if (req.user?.role === "customer" && req.user.customerId !== service.customerId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, service.customerId));
  const [site] = service.siteId
    ? await db.select().from(sitesTable).where(eq(sitesTable.id, service.siteId))
    : [null];
  const tickets = await db
    .select({
      id: ticketsTable.id,
      ticketNumber: ticketsTable.ticketNumber,
      title: ticketsTable.title,
      status: ticketsTable.status,
      severity: ticketsTable.severity,
      openedAt: ticketsTable.openedAt,
      nextEscalationAt: ticketsTable.nextEscalationAt,
    })
    .from(ticketsTable)
    .where(eq(ticketsTable.serviceId, id))
    .orderBy(ticketsTable.openedAt);

  res.json({ ...service, customer, site, tickets });
});

router.put("/services/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === "customer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { vendorName, serviceType, circuitId, bandwidth, status, installDate, monthlyRecurringCharge, supportReference, notes } = req.body;

  const [service] = await db
    .update(servicesTable)
    .set({ vendorName, serviceType, circuitId, bandwidth, status, installDate, monthlyRecurringCharge: monthlyRecurringCharge?.toString(), supportReference, notes, updatedAt: new Date() })
    .where(eq(servicesTable.id, id))
    .returning();

  if (!service) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json(service);
});

router.delete("/services/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [service] = await db.delete(servicesTable).where(eq(servicesTable.id, id)).returning();
  if (!service) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json({ success: true, message: "Service deleted" });
});

export default router;
