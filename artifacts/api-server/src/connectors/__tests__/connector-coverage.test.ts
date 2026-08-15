import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import {
  avalaraConfigTable,
  crmSyncLogsTable,
  customerContactsTable,
  customersTable,
  db,
  salesforceConfigTable,
} from '@workspace/db';
import { MerakiConnector } from '../meraki';
import { FortinetConnector } from '../fortinet';
import {
  clearCredential,
  fullSync as salesforceFullSync,
  getCredentials as getSalesforceCredentials,
  saveCredentials as saveSalesforceCredentials,
  testConnection as testSalesforceConnection,
} from '../salesforce';
import {
  getCredentials as getAvalaraCredentials,
  saveCredentials as saveAvalaraCredentials,
  testConnection as testAvalaraConnection,
  validateInvoice,
} from '../avalara';

const SALESFORCE_IDS = ['vitest-account-1', 'vitest-contact-1'];

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response;
}

async function cleanup(): Promise<void> {
  await db
    .delete(customerContactsTable)
    .where(inArray(customerContactsTable.externalId, SALESFORCE_IDS));
  await db.delete(customersTable).where(inArray(customersTable.externalId, SALESFORCE_IDS));
  await db.delete(crmSyncLogsTable).where(eq(crmSyncLogsTable.connector, 'salesforce'));
  await db.delete(salesforceConfigTable);
  await db.delete(avalaraConfigTable);
}

describe.sequential('connector behavior coverage', () => {
  beforeEach(async () => {
    await cleanup();
    vi.unstubAllGlobals();
  });

  afterEach(() => vi.unstubAllGlobals());
  afterAll(cleanup);

  it('normalizes complete Meraki and Fortinet demo snapshots', async () => {
    const meraki = new MerakiConnector({
      apiKey: 'placeholder',
      baseUrl: 'https://api.meraki.com/api/v1',
      organizationId: 'demo-org',
    });
    const fortinet = new FortinetConnector({
      apiKey: 'placeholder',
      baseUrl: 'https://fortigate.example.test',
      managerType: 'fortigate',
    });

    await expect(meraki.testConnection()).resolves.toMatchObject({ ok: true });
    await expect(meraki.syncNetworks()).resolves.not.toHaveLength(0);
    const merakiResult = await meraki.fullSync();
    expect(merakiResult.devices.length).toBeGreaterThan(3);
    expect(merakiResult.links.some((link) => link.failoverActive)).toBe(true);
    expect(merakiResult.events.length).toBeGreaterThan(0);
    expect(merakiResult.errors).toEqual([]);

    await expect(fortinet.testConnection()).resolves.toMatchObject({ ok: true });
    const fortinetResult = await fortinet.fullSync();
    expect(fortinetResult.devices).toHaveLength(3);
    expect(fortinetResult.links).toHaveLength(3);
    expect(fortinetResult.events).toHaveLength(2);
  });

  it('normalizes live Meraki responses and handles rate limits and partial event failures', async () => {
    const calls = new Map<string, number>();
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      calls.set(url, (calls.get(url) ?? 0) + 1);
      if (url.endsWith('/organizations/org-live') && calls.get(url) === 1) {
        return jsonResponse({}, 429, { 'Retry-After': '0' });
      }
      if (url.endsWith('/organizations/org-live')) {
        return jsonResponse({ id: 'org-live', name: 'Live Org', api: { enabled: true } });
      }
      if (url.endsWith('/networks')) {
        return jsonResponse([
          { id: 'network-1', organizationId: 'org-live', name: 'Branch One', productTypes: ['appliance'], timeZone: 'UTC', tags: [] },
          { id: 'network-2', organizationId: 'org-live', name: 'Switch Only', productTypes: ['switch'], timeZone: 'UTC', tags: [] },
        ]);
      }
      if (url.includes('/devices/statuses')) {
        return jsonResponse([
          { name: 'MX Live', serial: 'Q2XX-LIVE', mac: '00:11:22:33:44:55', networkId: 'network-1', productType: 'appliance', model: 'MX75', status: 'online', lanIp: '10.0.0.1', publicIp: '198.51.100.1', lastReportedAt: new Date().toISOString() },
          { name: 'MS Ignored', serial: 'Q2XX-SWITCH', mac: '00:11:22:33:44:56', networkId: 'network-2', productType: 'switch', model: 'MS120', status: 'online' },
        ]);
      }
      if (url.includes('/uplink/statuses')) {
        return jsonResponse([{ networkId: 'network-1', serial: 'Q2XX-LIVE', model: 'MX75', uplinks: [{ interface: 'WAN1', status: 'active', ip: '198.51.100.1', provider: 'Live Carrier' }] }]);
      }
      if (url.includes('/networks/network-1/events')) {
        return jsonResponse({ events: [{ occurredAt: new Date().toISOString(), networkId: 'network-1', type: 'wan_status_change', description: 'WAN changed', deviceSerial: 'Q2XX-LIVE', deviceName: 'MX Live', eventData: { status: 'down' } }] });
      }
      return jsonResponse('network failure', 503);
    }));

    const connector = new MerakiConnector({
      apiKey: 'live-key',
      baseUrl: 'https://api.meraki.test',
      organizationId: 'org-live',
    });
    await expect(connector.testConnection()).resolves.toMatchObject({ ok: true });
    const result = await connector.fullSync();
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].networkName).toBe('Branch One');
    expect(result.links).toHaveLength(1);
    expect(result.events).toHaveLength(1);

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse('unauthorized', 401)));
    await expect(connector.testConnection()).resolves.toMatchObject({ ok: false });
  });

  it('tests both live Fortinet management connection modes and failures', async () => {
    const unconfigured = new FortinetConnector({
      apiKey: 'secret',
      baseUrl: '',
      managerType: 'fortigate',
    });
    await expect(unconfigured.testConnection()).resolves.toMatchObject({ ok: false });

    const fortiManager = new FortinetConnector({
      apiKey: 'manager-secret',
      baseUrl: 'https://fortimanager.test/',
      managerType: 'fortimanager',
    });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ result: [{ status: { code: 0, message: 'OK' } }] })));
    await expect(fortiManager.testConnection()).resolves.toMatchObject({ ok: true });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ result: [{ status: { code: -1, message: 'Denied' } }] })));
    await expect(fortiManager.testConnection()).resolves.toMatchObject({ ok: false });

    const fortiGate = new FortinetConnector({
      apiKey: 'gate-secret',
      baseUrl: 'https://fortigate.test',
      managerType: 'fortigate',
    });
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ results: { hostname: 'FG-LIVE', version: '7.4' } })));
    await expect(fortiGate.testConnection()).resolves.toMatchObject({ ok: true });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network unavailable'); }));
    await expect(fortiGate.testConnection()).resolves.toMatchObject({ ok: false });
  });

  it('persists Salesforce credentials and creates then updates accounts and contacts', async () => {
    expect(await getSalesforceCredentials()).toBeNull();
    await saveSalesforceCredentials({
      clientId: 'client-id',
      clientSecret: 'client-secret',
      loginUrl: 'https://login.salesforce.test/',
      instanceUrl: 'https://instance.salesforce.test',
      username: 'integration@example.test',
      password: 'password-token',
    });
    expect(await getSalesforceCredentials()).toMatchObject({ clientId: 'client-id' });

    let tokenCount = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/oauth2/token')) {
        tokenCount += 1;
        return jsonResponse({ access_token: `token-${tokenCount}`, instance_url: 'https://instance.salesforce.test' });
      }
      const query = decodeURIComponent(url);
      if (query.includes('FROM Account')) {
        return jsonResponse({ records: [{ Id: 'vitest-account-1', Name: 'Vitest Salesforce Account', BillingCity: 'Chicago', BillingState: 'IL', Phone: '555-0101' }] });
      }
      return jsonResponse({ records: [
        { Id: 'vitest-contact-1', FirstName: 'Taylor', LastName: 'Manager', Email: 'taylor@example.test', Phone: '555-0102', Title: 'Operations Manager', AccountId: 'vitest-account-1' },
        { Id: 'vitest-contact-no-email', LastName: 'Skipped', AccountId: 'vitest-account-1' },
      ] });
    }));

    await expect(testSalesforceConnection()).resolves.toMatchObject({ ok: true });
    const first = await salesforceFullSync();
    const second = await salesforceFullSync();
    expect(first.accounts.synced).toBe(1);
    expect(first.contacts.synced).toBe(1);
    expect(second.accounts.synced).toBe(1);
    expect(second.contacts.synced).toBe(1);

    const [contact] = await db
      .select()
      .from(customerContactsTable)
      .where(eq(customerContactsTable.externalId, 'vitest-contact-1'));
    expect(contact.role).toBe('manager');

    await clearCredential('clientSecret');
    expect(await getSalesforceCredentials()).toBeNull();
    await expect(testSalesforceConnection()).resolves.toMatchObject({ ok: false });
  });

  it('persists Avalara credentials and validates invoice matches and failures', async () => {
    expect(await getAvalaraCredentials()).toBeNull();
    await saveAvalaraCredentials({
      accountId: 'avalara-account',
      licenseKey: 'avalara-key',
      baseUrl: 'https://avalara.test/api/v2/',
      companyCode: 'COMPANY',
    });
    expect(await getAvalaraCredentials()).toMatchObject({ baseUrl: 'https://avalara.test/api/v2' });

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>).Authorization).toMatch(/^Basic /);
      if (url.endsWith('/utilities/ping')) return jsonResponse({ authenticated: true });
      return jsonResponse({ companyCode: 'COMPANY', code: 'INV-100', customerCode: 'CUST-100', totalAmount: 125, totalTax: 10, currencyCode: 'USD', status: 'Posted' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(testAvalaraConnection()).resolves.toMatchObject({ ok: true });
    await expect(validateInvoice({ invoiceNumber: 'INV-100', customerAccountNumber: 'CUST-100' })).resolves.toMatchObject({ matchesInvoiceNumber: true, matchesCustomerAccountNumber: true });

    await expect(validateInvoice({ invoiceNumber: 'INV-101', customerAccountNumber: 'CUST-100', companyCode: ' ' })).rejects.toThrow('Company code is required');
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse('not found', 404)));
    await expect(validateInvoice({ invoiceNumber: 'INV-404', customerAccountNumber: 'CUST-404' })).rejects.toThrow('Avalara transaction lookup failed');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Avalara network unavailable'); }));
    await expect(testAvalaraConnection()).resolves.toMatchObject({
      ok: false,
      message: 'Avalara network unavailable',
    });
  });

  it('aggregates failures when every live Meraki sync surface is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse('service unavailable', 503)));
    const connector = new MerakiConnector({
      apiKey: 'live-key',
      baseUrl: 'https://api.meraki.test',
      organizationId: 'unavailable-org',
    });

    const result = await connector.fullSync();
    expect(result.devices).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.errors).toHaveLength(3);
  });
});