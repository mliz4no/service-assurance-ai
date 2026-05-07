/**
 * Salesforce CRM connector — read-only data sync.
 *
 * Pulls Accounts → customers and Contacts → customer_contacts.
 * Uses the OAuth 2.0 Username-Password flow for server-to-server auth.
 * Gracefully disabled when SALESFORCE_CLIENT_ID is not set.
 */

import { db, customersTable, customerContactsTable, crmSyncLogsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "../lib/logger";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SalesforceAccount {
  Id: string;
  Name: string;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
  Phone?: string;
  Website?: string;
}

export interface SalesforceContact {
  Id: string;
  FirstName?: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  AccountId?: string;
}

export interface SalesforceSyncResult {
  synced: number;
  errors: string[];
}

export interface SalesforceFullSyncResult {
  accounts: SalesforceSyncResult;
  contacts: SalesforceSyncResult;
}

interface TokenCache {
  accessToken: string;
  instanceUrl: string;
  expiresAt: number;
}

// ── In-memory token cache ────────────────────────────────────────────────────

let tokenCache: TokenCache | null = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

export function isConfigured(): boolean {
  return !!(
    process.env.SALESFORCE_CLIENT_ID &&
    process.env.SALESFORCE_CLIENT_SECRET &&
    process.env.SALESFORCE_INSTANCE_URL &&
    process.env.SALESFORCE_USERNAME &&
    process.env.SALESFORCE_PASSWORD
  );
}

async function authenticate(): Promise<TokenCache> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache;
  }

  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL!;
  const params = new URLSearchParams({
    grant_type: "password",
    client_id: process.env.SALESFORCE_CLIENT_ID!,
    client_secret: process.env.SALESFORCE_CLIENT_SECRET!,
    username: process.env.SALESFORCE_USERNAME!,
    password: process.env.SALESFORCE_PASSWORD!,
  });

  const res = await fetch(`${instanceUrl}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce auth failed (${res.status}): ${body}`);
  }

  const json = await res.json() as { access_token: string; instance_url: string };

  tokenCache = {
    accessToken: json.access_token,
    instanceUrl: json.instance_url,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };

  return tokenCache;
}

async function sfQuery<T>(soql: string): Promise<T[]> {
  const token = await authenticate();
  const url = `${token.instanceUrl}/services/data/v58.0/query?q=${encodeURIComponent(soql)}`;

  let res = await fetch(url, {
    headers: { Authorization: `Bearer ${token.accessToken}` },
  });

  if (res.status === 401) {
    tokenCache = null;
    const retryToken = await authenticate();
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${retryToken.accessToken}` },
    });
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Salesforce query failed (${res.status}): ${body}`);
  }

  const json = await res.json() as { records: T[] };
  return json.records;
}

function mapTitleToRole(title?: string): "noc" | "manager" | "director" | "executive" {
  if (!title) return "noc";
  const t = title.toLowerCase();
  if (t.includes("executive") || t.includes("ceo") || t.includes("cto") || t.includes("cfo") || t.includes("vp")) return "executive";
  if (t.includes("director")) return "director";
  if (t.includes("manager")) return "manager";
  return "noc";
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  if (!isConfigured()) {
    return {
      ok: false,
      message: "Salesforce credentials not configured. Set SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_INSTANCE_URL, SALESFORCE_USERNAME, and SALESFORCE_PASSWORD.",
    };
  }
  try {
    tokenCache = null;
    await authenticate();
    return { ok: true, message: "Connection successful." };
  } catch (err: any) {
    return { ok: false, message: err.message ?? "Unknown error" };
  }
}

export async function syncAccounts(): Promise<SalesforceSyncResult> {
  if (!isConfigured()) {
    throw new Error("Salesforce credentials not configured.");
  }

  const [logRow] = await db.insert(crmSyncLogsTable).values({
    connector: "salesforce",
    syncType: "accounts",
    status: "running",
  }).returning();

  let synced = 0;
  const errors: string[] = [];

  try {
    const accounts = await sfQuery<SalesforceAccount>(
      "SELECT Id,Name,BillingStreet,BillingCity,BillingState,BillingPostalCode,BillingCountry,Phone,Website FROM Account"
    );

    for (const acct of accounts) {
      try {
        const billingParts = [
          acct.BillingStreet,
          acct.BillingCity,
          acct.BillingState,
          acct.BillingPostalCode,
          acct.BillingCountry,
        ].filter(Boolean);
        const notes = billingParts.length > 0 ? `Billing: ${billingParts.join(", ")}` : null;

        const [existing] = await db
          .select({ id: customersTable.id })
          .from(customersTable)
          .where(and(
            eq(customersTable.externalSystem, "salesforce"),
            eq(customersTable.externalId, acct.Id)
          ));

        if (existing) {
          await db.update(customersTable)
            .set({
              name: acct.Name,
              primaryContactPhone: acct.Phone ?? null,
              notes,
              externalSyncedAt: new Date(),
              externalSyncStatus: "synced",
              updatedAt: new Date(),
            })
            .where(eq(customersTable.id, existing.id));
        } else {
          await db.insert(customersTable).values({
            name: acct.Name,
            status: "active",
            primaryContactPhone: acct.Phone ?? null,
            notes,
            externalSystem: "salesforce",
            externalId: acct.Id,
            externalSyncedAt: new Date(),
            externalSyncStatus: "synced",
          });
        }

        synced++;
      } catch (rowErr: any) {
        errors.push(`Account ${acct.Id}: ${rowErr.message}`);
      }
    }

    await db.update(crmSyncLogsTable).set({
      status: "success",
      completedAt: new Date(),
      recordsProcessed: synced,
      message: errors.length ? errors.slice(0, 3).join("; ") : null,
    }).where(eq(crmSyncLogsTable.id, logRow.id));

  } catch (err: any) {
    logger.error({ err }, "salesforce syncAccounts failed");
    await db.update(crmSyncLogsTable).set({
      status: "failed",
      completedAt: new Date(),
      message: err.message,
    }).where(eq(crmSyncLogsTable.id, logRow.id));
    throw err;
  }

  return { synced, errors };
}

export async function syncContacts(): Promise<SalesforceSyncResult> {
  if (!isConfigured()) {
    throw new Error("Salesforce credentials not configured.");
  }

  const [logRow] = await db.insert(crmSyncLogsTable).values({
    connector: "salesforce",
    syncType: "contacts",
    status: "running",
  }).returning();

  let synced = 0;
  const errors: string[] = [];

  try {
    const contacts = await sfQuery<SalesforceContact>(
      "SELECT Id,FirstName,LastName,Email,Phone,Title,AccountId FROM Contact"
    );

    for (const contact of contacts) {
      try {
        if (!contact.Email) continue;

        let customerId: string | null = null;
        if (contact.AccountId) {
          const [customer] = await db
            .select({ id: customersTable.id })
            .from(customersTable)
            .where(and(
              eq(customersTable.externalSystem, "salesforce"),
              eq(customersTable.externalId, contact.AccountId)
            ));
          customerId = customer?.id ?? null;
        }

        if (!customerId) continue;

        const fullName = [contact.FirstName, contact.LastName].filter(Boolean).join(" ");
        const role = mapTitleToRole(contact.Title);

        const [existing] = await db
          .select({ id: customerContactsTable.id })
          .from(customerContactsTable)
          .where(and(
            eq(customerContactsTable.externalSystem, "salesforce"),
            eq(customerContactsTable.externalId, contact.Id)
          ));

        if (existing) {
          await db.update(customerContactsTable)
            .set({
              name: fullName || contact.LastName,
              email: contact.Email,
              phone: contact.Phone ?? null,
              role,
              externalSyncedAt: new Date(),
              externalSyncStatus: "synced",
              updatedAt: new Date(),
            })
            .where(eq(customerContactsTable.id, existing.id));
        } else {
          await db.insert(customerContactsTable).values({
            customerId,
            name: fullName || contact.LastName,
            email: contact.Email,
            phone: contact.Phone ?? null,
            role,
            notifyOnSeverity: "high",
            notificationChannels: "email",
            externalSystem: "salesforce",
            externalId: contact.Id,
            externalSyncedAt: new Date(),
            externalSyncStatus: "synced",
          });
        }

        synced++;
      } catch (rowErr: any) {
        errors.push(`Contact ${contact.Id}: ${rowErr.message}`);
      }
    }

    await db.update(crmSyncLogsTable).set({
      status: "success",
      completedAt: new Date(),
      recordsProcessed: synced,
      message: errors.length ? errors.slice(0, 3).join("; ") : null,
    }).where(eq(crmSyncLogsTable.id, logRow.id));

  } catch (err: any) {
    logger.error({ err }, "salesforce syncContacts failed");
    await db.update(crmSyncLogsTable).set({
      status: "failed",
      completedAt: new Date(),
      message: err.message,
    }).where(eq(crmSyncLogsTable.id, logRow.id));
    throw err;
  }

  return { synced, errors };
}

export async function fullSync(): Promise<SalesforceFullSyncResult> {
  const accounts = await syncAccounts();
  const contacts = await syncContacts();
  return { accounts, contacts };
}
