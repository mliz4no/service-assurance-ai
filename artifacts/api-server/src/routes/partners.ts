import { Router, type IRouter } from "express";
import { db, telecomServicesPartnersTable, customersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/partners", requireAuth, requireRole("admin", "ops"), async (_req, res): Promise<void> => {
  const partners = await db
    .select()
    .from(telecomServicesPartnersTable)
    .orderBy(telecomServicesPartnersTable.companyName);
  res.json(partners);
});

router.post("/partners", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { name, companyName, email, phone, status, notes } = req.body;
  if (!name || !companyName || !email) {
    res.status(400).json({ error: "Bad Request", message: "name, companyName, and email are required" });
    return;
  }

  const [partner] = await db
    .insert(telecomServicesPartnersTable)
    .values({ name, companyName, email, phone: phone || null, status: status || "active", notes: notes || null })
    .returning();
  res.status(201).json(partner);
});

router.get("/partners/:id", requireAuth, requireRole("admin", "ops"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [partner] = await db
    .select()
    .from(telecomServicesPartnersTable)
    .where(eq(telecomServicesPartnersTable.id, id));

  if (!partner) {
    res.status(404).json({ error: "Not Found" });
    return;
  }

  const customers = await db
    .select({ id: customersTable.id, name: customersTable.name, accountNumber: customersTable.accountNumber, status: customersTable.status })
    .from(customersTable)
    .where(eq(customersTable.telecomServicesPartnerId, id));

  const users = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.telecomServicesPartnerId, id));

  res.json({ ...partner, customers, users });
});

router.put("/partners/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, companyName, email, phone, status, notes } = req.body;

  const [partner] = await db
    .update(telecomServicesPartnersTable)
    .set({ name, companyName, email, phone: phone || null, status, notes: notes || null, updatedAt: new Date() })
    .where(eq(telecomServicesPartnersTable.id, id))
    .returning();

  if (!partner) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json(partner);
});

router.delete("/partners/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [partner] = await db
    .delete(telecomServicesPartnersTable)
    .where(eq(telecomServicesPartnersTable.id, id))
    .returning();
  if (!partner) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json({ success: true, message: "Partner deleted" });
});

export default router;
