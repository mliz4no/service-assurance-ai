import { Router, type IRouter } from "express";
import { db, slaPoliciesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/sla-policies", requireAuth, async (_req, res): Promise<void> => {
  const policies = await db.select().from(slaPoliciesTable).orderBy(slaPoliciesTable.severity);
  res.json(policies);
});

router.post("/sla-policies", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const { name, severity, initialResponseMinutes, escalationMinutes, resolutionTargetMinutes, isDefault } = req.body;
  if (!name || !severity) {
    res.status(400).json({ error: "Bad Request", message: "name and severity required" });
    return;
  }

  const [policy] = await db
    .insert(slaPoliciesTable)
    .values({ name, severity, initialResponseMinutes, escalationMinutes, resolutionTargetMinutes, isDefault: !!isDefault })
    .returning();

  res.status(201).json(policy);
});

router.put("/sla-policies/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, severity, initialResponseMinutes, escalationMinutes, resolutionTargetMinutes, isDefault } = req.body;

  const [policy] = await db
    .update(slaPoliciesTable)
    .set({ name, severity, initialResponseMinutes, escalationMinutes, resolutionTargetMinutes, isDefault: !!isDefault, updatedAt: new Date() })
    .where(eq(slaPoliciesTable.id, id))
    .returning();

  if (!policy) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json(policy);
});

router.delete("/sla-policies/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [policy] = await db.delete(slaPoliciesTable).where(eq(slaPoliciesTable.id, id)).returning();
  if (!policy) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  res.json({ success: true, message: "SLA policy deleted" });
});

export default router;
