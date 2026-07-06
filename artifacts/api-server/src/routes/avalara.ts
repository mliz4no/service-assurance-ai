import { Router, type IRouter } from 'express';
import { db, invoiceComplaintsTable, avalaraConfigTable } from '@workspace/db';
import { desc, eq, count } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middlewares/auth';
import * as avalara from '../connectors/avalara';

const router: IRouter = Router();

const adminOnly = [requireAuth, requireRole('admin')];

router.get('/avalara/config', ...adminOnly, async (req, res): Promise<void> => {
  const rows = await db.select().from(avalaraConfigTable);
  const cfg: Record<string, string> = {};

  for (const row of rows) {
    cfg[row.key] = row.value;
  }

  res.json({
    accountId: cfg['accountId'] || '',
    licenseKey: cfg['licenseKey'] ? '••••••••' : '',
    baseUrl: cfg['baseUrl'] || 'https://sandbox-rest.avatax.com/api/v2',
    companyCode: cfg['companyCode'] || '',
    hasLicenseKey: !!cfg['licenseKey'],
  });
});

router.put('/avalara/config', ...adminOnly, async (req, res): Promise<void> => {
  const { accountId, licenseKey, baseUrl, companyCode } = req.body as Record<string, string>;

  const toSave: Partial<avalara.AvalaraCredentials> = {};
  if (accountId && accountId !== '••••••••') toSave.accountId = accountId.trim();
  if (licenseKey && licenseKey !== '••••••••') toSave.licenseKey = licenseKey.trim();
  if (baseUrl && baseUrl !== '••••••••') toSave.baseUrl = baseUrl.trim().replace(/\/$/, '');
  if (companyCode && companyCode !== '••••••••') toSave.companyCode = companyCode.trim();

  if (Object.keys(toSave).length === 0) {
    res.status(400).json({ error: 'No fields to save.' });
    return;
  }

  await avalara.saveCredentials(toSave);
  res.json({ success: true });
});

router.post('/avalara/test', ...adminOnly, async (req, res): Promise<void> => {
  try {
    const result = await avalara.testConnection();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error?.message ?? 'Unknown error' });
  }
});

router.get('/avalara/status', ...adminOnly, async (req, res): Promise<void> => {
  const creds = await avalara.getCredentials();

  const [validatedCount] = await db
    .select({ count: count() })
    .from(invoiceComplaintsTable)
    .where(eq(invoiceComplaintsTable.avalaraValidationStatus, 'validated'));

  const [failedCount] = await db
    .select({ count: count() })
    .from(invoiceComplaintsTable)
    .where(eq(invoiceComplaintsTable.avalaraValidationStatus, 'failed'));

  const recent = await db
    .select({
      id: invoiceComplaintsTable.id,
      complaintNumber: invoiceComplaintsTable.complaintNumber,
      title: invoiceComplaintsTable.title,
      avalaraValidationStatus: invoiceComplaintsTable.avalaraValidationStatus,
      avalaraValidatedAt: invoiceComplaintsTable.avalaraValidatedAt,
    })
    .from(invoiceComplaintsTable)
    .where(eq(invoiceComplaintsTable.avalaraValidationStatus, 'validated'))
    .orderBy(desc(invoiceComplaintsTable.avalaraValidatedAt))
    .limit(5);

  res.json({
    configured: !!creds,
    validatedCount: Number(validatedCount?.count ?? 0),
    failedCount: Number(failedCount?.count ?? 0),
    recent,
  });
});

export default router;
