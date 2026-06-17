import { Router, type IRouter } from 'express';
import {
  db,
  customersTable,
  customerContactsTable,
  crmSyncLogsTable,
  salesforceConfigTable,
} from '@workspace/db';
import { eq, desc, count } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middlewares/auth';
import * as sf from '../connectors/salesforce';

const router: IRouter = Router();

const adminOnly = [requireAuth, requireRole('admin')];

// ── Get saved config (masks sensitive fields) ─────────────────────────────────

router.get('/salesforce/config', ...adminOnly, async (req, res): Promise<void> => {
  const rows = await db.select().from(salesforceConfigTable);
  const cfg: Record<string, string> = {};
  for (const row of rows) {
    cfg[row.key] = row.value;
  }

  // Return non-sensitive fields in plain text; mask secrets
  res.json({
    clientId: cfg['clientId'] || '',
    clientSecret: cfg['clientSecret'] ? '••••••••' : '',
    loginUrl: cfg['loginUrl'] || 'https://login.salesforce.com',
    instanceUrl: cfg['instanceUrl'] || '',
    username: cfg['username'] || '',
    password: cfg['password'] ? '••••••••' : '',
    hasClientSecret: !!cfg['clientSecret'],
    hasPassword: !!cfg['password'],
  });
});

// ── Save config ───────────────────────────────────────────────────────────────

router.put('/salesforce/config', ...adminOnly, async (req, res): Promise<void> => {
  const { clientId, clientSecret, loginUrl, instanceUrl, username, password } = req.body as Record<
    string,
    string
  >;

  // Only save fields that are non-empty and not the masked placeholder
  const toSave: Partial<sf.SalesforceCredentials> = {};
  if (clientId && clientId !== '••••••••') toSave.clientId = clientId.trim();
  if (clientSecret && clientSecret !== '••••••••') toSave.clientSecret = clientSecret.trim();
  if (loginUrl && loginUrl !== '••••••••') toSave.loginUrl = loginUrl.trim().replace(/\/$/, '');
  if (instanceUrl && instanceUrl !== '••••••••')
    toSave.instanceUrl = instanceUrl.trim().replace(/\/$/, '');
  if (username && username !== '••••••••') toSave.username = username.trim();
  if (password && password !== '••••••••') toSave.password = password.trim();

  if (Object.keys(toSave).length === 0) {
    res.status(400).json({ error: 'No fields to save.' });
    return;
  }

  await sf.saveCredentials(toSave);
  res.json({ success: true });
});

// ── Test connection ───────────────────────────────────────────────────────────

router.post('/salesforce/test', ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.testConnection();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ ok: false, message: err.message ?? 'Unknown error' });
  }
});

// ── Sync accounts ─────────────────────────────────────────────────────────────

router.post('/salesforce/sync/accounts', ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.syncAccounts();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? 'Sync failed' });
  }
});

// ── Sync contacts ─────────────────────────────────────────────────────────────

router.post('/salesforce/sync/contacts', ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.syncContacts();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? 'Sync failed' });
  }
});

// ── Full sync ─────────────────────────────────────────────────────────────────

router.post('/salesforce/sync/full', ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await sf.fullSync();
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message ?? 'Sync failed' });
  }
});

// ── Status ────────────────────────────────────────────────────────────────────

router.get('/salesforce/status', ...adminOnly, async (req, res): Promise<void> => {
  const [accountCount] = await db
    .select({ count: count() })
    .from(customersTable)
    .where(eq(customersTable.externalSystem, 'salesforce'));

  const [contactCount] = await db
    .select({ count: count() })
    .from(customerContactsTable)
    .where(eq(customerContactsTable.externalSystem, 'salesforce'));

  const recentLogs = await db
    .select()
    .from(crmSyncLogsTable)
    .where(eq(crmSyncLogsTable.connector, 'salesforce'))
    .orderBy(desc(crmSyncLogsTable.startedAt))
    .limit(5);

  const lastSuccessLog = recentLogs.find((l: typeof crmSyncLogsTable.$inferSelect) => l.status === 'success');
  const creds = await sf.getCredentials();

  res.json({
    configured: !!creds,
    accountsSynced: Number(accountCount?.count ?? 0),
    contactsSynced: Number(contactCount?.count ?? 0),
    lastSyncAt: lastSuccessLog?.completedAt ?? null,
    recentLogs,
  });
});

export default router;
