import { db, avalaraConfigTable } from '@workspace/db';

export interface AvalaraCredentials {
  accountId: string;
  licenseKey: string;
  baseUrl: string;
  companyCode: string;
}

export interface AvalaraTransactionMatch {
  companyCode: string;
  documentCode: string;
  customerCode?: string;
  totalAmount?: number;
  totalTax?: number;
  currencyCode?: string;
  status?: string;
  matchesInvoiceNumber: boolean;
  matchesCustomerAccountNumber: boolean;
}

interface AvalaraTransactionResponse {
  companyCode: string;
  code: string;
  customerCode?: string;
  totalAmount?: number;
  totalTax?: number;
  currencyCode?: string;
  status?: string;
}

export async function getCredentials(): Promise<AvalaraCredentials | null> {
  const rows = await db.select().from(avalaraConfigTable);
  const cfg: Record<string, string> = {};

  for (const row of rows) {
    cfg[row.key] = row.value;
  }

  const accountId = cfg['accountId'] || process.env.AVALARA_ACCOUNT_ID || '';
  const licenseKey = cfg['licenseKey'] || process.env.AVALARA_LICENSE_KEY || '';
  const baseUrl =
    cfg['baseUrl'] || process.env.AVALARA_BASE_URL || 'https://sandbox-rest.avatax.com/api/v2';
  const companyCode = cfg['companyCode'] || process.env.AVALARA_COMPANY_CODE || '';

  if (!accountId || !licenseKey) return null;

  return {
    accountId,
    licenseKey,
    baseUrl: baseUrl.replace(/\/$/, ''),
    companyCode,
  };
}

export async function saveCredentials(creds: Partial<AvalaraCredentials>): Promise<void> {
  const entries: Array<[string, string]> = [
    ['accountId', creds.accountId ?? ''],
    ['licenseKey', creds.licenseKey ?? ''],
    ['baseUrl', creds.baseUrl ?? ''],
    ['companyCode', creds.companyCode ?? ''],
  ];

  for (const [key, value] of entries) {
    if (value === '') continue;

    await db
      .insert(avalaraConfigTable)
      .values({ key, value })
      .onConflictDoUpdate({
        target: avalaraConfigTable.key,
        set: { value, updatedAt: new Date() },
      });
  }
}

function buildAuthHeader(accountId: string, licenseKey: string): string {
  return `Basic ${Buffer.from(`${accountId}:${licenseKey}`).toString('base64')}`;
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  const creds = await getCredentials();
  if (!creds) {
    return { ok: false, message: 'Avalara credentials incomplete. Save account and license key.' };
  }

  try {
    const res = await fetch(`${creds.baseUrl}/utilities/ping`, {
      headers: {
        Authorization: buildAuthHeader(creds.accountId, creds.licenseKey),
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, message: `Avalara ping failed (${res.status}): ${body}` };
    }

    return { ok: true, message: 'Connection successful.' };
  } catch (error: any) {
    return { ok: false, message: error?.message ?? 'Connection failed' };
  }
}

export async function validateInvoice(args: {
  invoiceNumber: string;
  customerAccountNumber: string;
  companyCode?: string | null;
  documentCode?: string | null;
}): Promise<AvalaraTransactionMatch> {
  const creds = await getCredentials();
  if (!creds) {
    throw new Error('Avalara credentials not configured.');
  }

  const companyCode = (args.companyCode || creds.companyCode || '').trim();
  const documentCode = (args.documentCode || args.invoiceNumber).trim();

  if (!companyCode) {
    throw new Error('Company code is required to validate invoice with Avalara.');
  }
  if (!documentCode) {
    throw new Error('Document code is required to validate invoice with Avalara.');
  }

  const url = `${creds.baseUrl}/companies/${encodeURIComponent(companyCode)}/transactions/${encodeURIComponent(documentCode)}`;

  const res = await fetch(url, {
    headers: {
      Authorization: buildAuthHeader(creds.accountId, creds.licenseKey),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Avalara transaction lookup failed (${res.status}): ${body}`);
  }

  const tx = (await res.json()) as AvalaraTransactionResponse;

  return {
    companyCode: tx.companyCode,
    documentCode: tx.code,
    customerCode: tx.customerCode,
    totalAmount: tx.totalAmount,
    totalTax: tx.totalTax,
    currencyCode: tx.currencyCode,
    status: tx.status,
    matchesInvoiceNumber: tx.code === args.invoiceNumber,
    matchesCustomerAccountNumber: (tx.customerCode || '') === args.customerAccountNumber,
  };
}
