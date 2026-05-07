import { Router, type IRouter } from "express";
import { db, customersTable, customerContactsTable, crmSyncLogsTable } from "@workspace/db";
import { eq, desc, count, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middlewares/auth";
import * as sf from "../connectors/salesforce";

const router: IRouter = Router();

const adminOnly = [requireAuth, requireRole("admin")];

// ── Test connection ───────────────────────────────────────────────────────────

router.post("/salesforce/test", ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.testConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message ?? "Unknown error" });
  }
});

// ── Sync accounts ─────────────────────────────────────────────────────────────

router.post("/salesforce/sync/accounts", ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.syncAccounts();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? "Sync failed" });
  }
});

// ── Sync contacts ─────────────────────────────────────────────────────────────

router.post("/salesforce/sync/contacts", ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.syncContacts();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? "Sync failed" });
  }
});

// ── Full sync ─────────────────────────────────────────────────────────────────

router.post("/salesforce/sync/full", ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.fullSync();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? "Sync failed" });
  }
});

// ── Status ────────────────────────────────────────────────────────────────────

router.get("/salesforce/status", ...adminOnly, async (req, res): Promise<void> => {
  const [accountCount] = await db
    .select({ count: count() })
    .from(customersTable)
    .where(eq(customersTable.externalSystem, "salesforce"));

  const [contactCount] = await db
    .select({ count: count() })
    .from(customerContactsTable)
    .where(eq(customerContactsTable.externalSystem, "salesforce"));

  const recentLogs = await db
    .select()
    .from(crmSyncLogsTable)
    .where(eq(crmSyncLogsTable.connector, "salesforce"))
    .orderBy(desc(crmSyncLogsTable.startedAt))
    .limit(5);

  const lastSuccessLog = recentLogs.find(l => l.status === "success");

  const configured = !!(
    process.env.SALESFORCE_CLIENT_ID &&
    process.env.SALESFORCE_CLIENT_SECRET &&
    process.env.SALESFORCE_INSTANCE_URL &&
    process.env.SALESFORCE_USERNAME &&
    process.env.SALESFORCE_PASSWORD
  );

  res.json({
    configured,
    accountsSynced: Number(accountCount?.count ?? 0),
    contactsSynced: Number(contactCount?.count ?? 0),
    lastSyncAt: lastSuccessLog?.completedAt ?? null,
    recentLogs,
  });
});

export default router;
