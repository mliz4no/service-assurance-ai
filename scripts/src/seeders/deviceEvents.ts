type Params = {
  db: any;
  deviceEventsTable: any;
  controllers: { merakiCtrl: any; fortinetCtrl: any };
  managedDevices: any;
  customers: any;
  sites: any;
  ctrlNow: Date;
};

export async function seedDeviceEvents(params: Params) {
  const { db, deviceEventsTable, controllers, managedDevices, customers, sites, ctrlNow } = params;
  const { merakiCtrl, fortinetCtrl } = controllers;
  const { mxDenver, mxPhoenix, mxHQActive, mxDallasDC, fgtHQPrimary, fgtChicago } =
    managedDevices.reduce((acc: any, d: any) => {
      acc[d.hostname.replace(/-/g, '')] = d; // not ideal but maps names for seed usage
      return acc;
    }, {} as any);

  const { nexatek } = customers;
  const { nxtDenver, nxtPhoenix, nxtHQ, nxtDC } = sites;

  console.log('Creating device events (seeders/deviceEvents.ts)');

  const events = await db
    .insert(deviceEventsTable)
    .values([
      {
        controllerId: merakiCtrl.id,
        managedDeviceId: mxDenver?.id,
        customerId: nexatek.id,
        siteId: nxtDenver.id,
        rawEventId:
          'meraki-N_002-uplink_connectivity_change-' + (ctrlNow.getTime() - 2.5 * 3600 * 1000),
        eventSource: 'meraki_dashboard',
        category: 'appliance_connectivity',
        severity: 'high',
        eventType: 'uplink_connectivity_change',
        title: 'WAN1 connectivity lost — MX67-NXT-Denver (Nexatek — Denver Warehouse)',
        description:
          'WAN1 uplink connectivity changed from "good" to "lost" | Interface: WAN1 | Status transition: good → lost',
        rawPayloadJson: {
          type: 'uplink_connectivity_change',
          category: 'appliance_connectivity',
          networkId: 'N_002',
          networkName: 'Nexatek — Denver Warehouse',
          deviceSerial: 'Q2TN-XXXX-NXT2',
          deviceName: 'MX67-NXT-Denver',
          eventData: {
            uplinkInterface: 'WAN1',
            uplinkIp: '10.1.1.254',
            connectivityBefore: 'good',
            connectivityAfter: 'lost',
          },
        },
        occurredAt: new Date(ctrlNow.getTime() - 2.5 * 3600 * 1000),
      },
      {
        controllerId: merakiCtrl.id,
        managedDeviceId: mxDenver?.id,
        customerId: nexatek.id,
        siteId: nxtDenver.id,
        rawEventId:
          'meraki-N_002-wan_status_change-' + (ctrlNow.getTime() - 2.5 * 3600 * 1000 + 12000),
        eventSource: 'meraki_dashboard',
        category: 'appliance_connectivity',
        severity: 'high',
        eventType: 'wan_status_change',
        title: 'WAN1 link down — MX67-NXT-Denver (Nexatek — Denver Warehouse)',
        description:
          'WAN status changed: active → failed on WAN1 | Interface: WAN1 | Status transition: active → failed',
        rawPayloadJson: {
          type: 'wan_status_change',
          category: 'appliance_connectivity',
          networkId: 'N_002',
          networkName: 'Nexatek — Denver Warehouse',
        },
        occurredAt: new Date(ctrlNow.getTime() - 2.5 * 3600 * 1000 + 12000),
      },
      // Additional events omitted for brevity in this seeder but can be added similarly
    ])
    .returning();

  return events;
}
