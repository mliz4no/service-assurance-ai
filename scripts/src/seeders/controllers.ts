type Params = {
  db: any;
  controllersTable: any;
  controllerSyncLogsTable: any;
};

export async function seedControllers(params: Params) {
  const { db, controllersTable, controllerSyncLogsTable } = params;
  console.log('Creating controllers (seeders/controllers.ts)');
  const ctrlNow = new Date();

  const [merakiCtrl, fortinetCtrl] = await db
    .insert(controllersTable)
    .values([
      {
        name: 'Cisco Meraki Dashboard — Nexatek Org',
        vendor: 'meraki',
        type: 'network_manager',
        baseUrl: 'https://api.meraki.com/api/v1',
        authType: 'api_key',
        apiKeyEncryptedOrPlaceholder: 'placeholder',
        organizationIdOrTenant: 'NXT-ORG-12345',
        pollingEnabled: true,
        pollingIntervalSeconds: 300,
        lastPolledAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
        lastPollStatus: 'success',
        lastPollMessage: 'Synced 6 devices, 11 links, 7 events',
      },
      {
        name: 'FortiManager — ConvergeX + Pinnacle',
        vendor: 'fortinet',
        type: 'firewall_manager',
        baseUrl: 'https://fortimanager.internal.cvx.io/jsonrpc',
        authType: 'api_key',
        apiKeyEncryptedOrPlaceholder: 'placeholder',
        organizationIdOrTenant: 'CVX-TENANT-01',
        pollingEnabled: true,
        pollingIntervalSeconds: 600,
        lastPolledAt: new Date(ctrlNow.getTime() - 12 * 60 * 1000),
        lastPollStatus: 'success',
        lastPollMessage: 'Synced 3 devices, 3 links, 2 events',
      },
    ])
    .returning();

  await db.insert(controllerSyncLogsTable).values([
    {
      controllerId: merakiCtrl.id,
      syncType: 'full',
      startedAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
      completedAt: new Date(ctrlNow.getTime() - 4.5 * 60 * 1000),
      status: 'success',
      message:
        'Synced 6 devices, 11 links, 7 events (HQ HA pair, Denver failover, Austin VPN, Phoenix, Dallas DC)',
      recordsProcessed: 24,
    },
    {
      controllerId: fortinetCtrl.id,
      syncType: 'full',
      startedAt: new Date(ctrlNow.getTime() - 12 * 60 * 1000),
      completedAt: new Date(ctrlNow.getTime() - 11 * 60 * 1000),
      status: 'success',
      message: 'Synced 3 devices, 3 links, 2 events',
      recordsProcessed: 8,
    },
    {
      controllerId: merakiCtrl.id,
      syncType: 'full',
      startedAt: new Date(ctrlNow.getTime() - 65 * 60 * 1000),
      completedAt: new Date(ctrlNow.getTime() - 64.5 * 60 * 1000),
      status: 'success',
      message:
        'Synced 6 devices, 11 links, 3 new events (Denver WAN down, Austin VPN change, Phoenix firmware complete)',
      recordsProcessed: 20,
    },
    {
      controllerId: merakiCtrl.id,
      syncType: 'events',
      startedAt: new Date(ctrlNow.getTime() - 2.6 * 3600 * 1000),
      completedAt: new Date(ctrlNow.getTime() - 2.59 * 3600 * 1000),
      status: 'success',
      message: 'Synced 2 new events (Denver uplink_connectivity_change, wan_status_change)',
      recordsProcessed: 2,
    },
  ]);

  return { merakiCtrl, fortinetCtrl, ctrlNow };
}
