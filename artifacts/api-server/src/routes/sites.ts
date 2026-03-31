import { Router, type IRouter } from "express";
import { db, sitesTable, customersTable, servicesTable, ticketsTable } from "@workspace/db";
import { eq, and, ilike, or } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/sites", requireAuth, async (req, res): Promise<void> => {
  const { customerId, search } = req.query as { customerId?: string; search?: string };
  const conditions = [];

  if (req.user?.role === "customer" && req.user.customerId) {
    conditions.push(eq(sitesTable.customerId, req.user.customerId));
  } else if (customerId) {
    conditions.push(eq(sitesTable.customerId, customerId));
  }

  if (search) {
    conditions.push(
      or(ilike(sitesTable.siteName, `%${search}%`), ilike(sitesTable.siteCode, `%${search}%`))
    );
  }

  const sites = await db
    .select({
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
    })
    .from(sitesTable)
    .leftJoin(customersTable, eq(sitesTable.customerId, customersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sitesTable.siteName);

  res.json(sites);
});

router.post("/sites", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === "customer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const { customerId, siteName, address1, address2, city, state, postalCode, country, timezone, siteCode, notes } = req.body;
  if (!customerId || !siteName) {
    res.status(400).json({ error: "Bad Request", message: "customerId and siteName are required" });
    return;
  }

  const [site] = await db
    .insert(sitesTable)
    .values({ customerId, siteName, address1, address2, city, state, postalCode, country, timezone, siteCode, notes })
    .returning();
  res.status(201).json(site);
});

router.get("/sites/:id", requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, id));
  if (!site) {
    res.status(404).json({ error: "Not Found" });
    return;
  }

  if (req.user?.role === "customer" && req.user.customerId !== site.customerId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, site.customerId));
  const [services, tickets] = await Promise.all([
    db.select().from(servicesTable).where(eq(servicesTable.siteId, id)),
    db.select().from(ticketsTable).where(eq(ticketsTable.siteId, id)).orderBy(ticketsTable.openedAt),
  ]);

  res.json({ ...site, customer, services, tickets });
});

router.put("/sites/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === "customer") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { siteName, address1, address2, city, state, postalCode, country, timezone, siteCode, notes } = req.body;

  const [site] = await db
    .update(sitesTable)
    .set({ siteName, address1, address2, city, state, postalCode, country, timezone, siteCode, notes, updatedAt: new Date() })
    .where(eq(sitesTable.id, id))
    .returning();

  if (!site) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json(site);
});

router.delete("/sites/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [site] = await db.delete(sitesTable).where(eq(sitesTable.id, id)).returning();
  if (!site) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json({ success: true, message: "Site deleted" });
});

export default router;
