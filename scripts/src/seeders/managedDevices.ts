type Params = {
  db: any;
  managedDevicesTable: any;
  controllers: { merakiCtrl: any; fortinetCtrl: any };
  customers: any;
  sites: any;
  ctrlNow: Date;
};

export async function seedManagedDevices(params: Params) {
  const { db, managedDevicesTable, controllers, customers, sites, ctrlNow } = params;
  const { merakiCtrl, fortinetCtrl } = controllers;
  const { nexatek, convergex, pinnacle } = customers;
  const { nxtHQ, nxtDenver, nxtAustin, nxtPhoenix, nxtDC, cvxHQ, pnlMemphis } = sites;

  console.log('Creating managed devices (seeders/managedDevices.ts)');

  const devices = await db
    .insert(managedDevicesTable)
    .values([
      // Meraki devices
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtHQ.id,
        hostname: 'MX85-NXT-HQ-Active',
        deviceType: 'appliance',
        vendor: 'Meraki',
        serialNumber: 'Q2TN-XXXX-NXT1',
        controllerDeviceId: 'Q2TN-XXXX-NXT1',
        model: 'MX85',
        mgmtIp: '10.0.1.1',
        status: 'online',
        haState: 'active',
        networkName: 'Nexatek — HQ Chicago',
        lastSeenAt: new Date(ctrlNow.getTime() - 90 * 1000),
        metadataJson: {
          networkId: 'N_001',
          productType: 'appliance',
          mac: 'e0:55:3d:10:01:01',
          publicIp: '203.0.113.5',
          haEnabled: true,
        },
      },
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtHQ.id,
        hostname: 'MX85-NXT-HQ-Spare',
        deviceType: 'appliance',
        vendor: 'Meraki',
        serialNumber: 'Q2TN-XXXX-NXT1S',
        controllerDeviceId: 'Q2TN-XXXX-NXT1S',
        model: 'MX85',
        mgmtIp: '10.0.1.2',
        status: 'online',
        haState: 'standby',
        networkName: 'Nexatek — HQ Chicago',
        lastSeenAt: new Date(ctrlNow.getTime() - 95 * 1000),
        metadataJson: {
          networkId: 'N_001',
          productType: 'appliance',
          mac: 'e0:55:3d:10:01:02',
          haEnabled: true,
          haRole: 'spare',
        },
      },
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtDenver.id,
        hostname: 'MX67-NXT-Denver',
        deviceType: 'appliance',
        vendor: 'Meraki',
        serialNumber: 'Q2TN-XXXX-NXT2',
        controllerDeviceId: 'Q2TN-XXXX-NXT2',
        model: 'MX67',
        mgmtIp: '10.1.1.1',
        status: 'degraded',
        networkName: 'Nexatek — Denver Warehouse',
        lastSeenAt: new Date(ctrlNow.getTime() - 2.5 * 3600 * 1000),
        metadataJson: {
          networkId: 'N_002',
          productType: 'appliance',
          mac: 'e0:55:3d:20:02:01',
          publicIp: '72.14.195.201',
          failoverActive: true,
          activeWan: 'Cellular',
        },
      },
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtAustin.id,
        hostname: 'MX68-NXT-Austin',
        deviceType: 'appliance',
        vendor: 'Meraki',
        serialNumber: 'Q2TN-XXXX-NXT3',
        controllerDeviceId: 'Q2TN-XXXX-NXT3',
        model: 'MX68',
        mgmtIp: '10.2.1.1',
        status: 'online',
        networkName: 'Nexatek — Austin Office',
        lastSeenAt: new Date(ctrlNow.getTime() - 60 * 1000),
        metadataJson: {
          networkId: 'N_003',
          productType: 'appliance',
          mac: 'e0:55:3d:30:03:01',
          publicIp: '12.141.99.44',
          vpnStatus: 'degraded',
        },
      },
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtPhoenix.id,
        hostname: 'MX67-NXT-Phoenix',
        deviceType: 'appliance',
        vendor: 'Meraki',
        serialNumber: 'Q2TN-XXXX-NXT4',
        controllerDeviceId: 'Q2TN-XXXX-NXT4',
        model: 'MX67',
        mgmtIp: '10.3.1.1',
        status: 'online',
        networkName: 'Nexatek — Phoenix Retail',
        lastSeenAt: new Date(ctrlNow.getTime() - 45 * 1000),
        metadataJson: {
          networkId: 'N_004',
          productType: 'appliance',
          mac: 'e0:55:3d:40:04:01',
          publicIp: '67.199.143.88',
          firmware: 'MX 18.211',
        },
      },
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtDC.id,
        hostname: 'MX450-NXT-DC-Dallas',
        deviceType: 'appliance',
        vendor: 'Meraki',
        serialNumber: 'Q2TN-XXXX-NXT5',
        controllerDeviceId: 'Q2TN-XXXX-NXT5',
        model: 'MX450',
        mgmtIp: '10.4.1.1',
        status: 'online',
        networkName: 'Nexatek — Dallas DC',
        lastSeenAt: new Date(ctrlNow.getTime() - 30 * 1000),
        metadataJson: {
          networkId: 'N_005',
          productType: 'appliance',
          mac: 'e0:55:3d:50:05:01',
          publicIp: '208.55.248.12',
          dualHomed: true,
        },
      },
      // Fortinet devices
      {
        controllerId: fortinetCtrl.id,
        customerId: convergex.id,
        siteId: cvxHQ.id,
        hostname: 'FGT-CVX-HQ-01',
        deviceType: 'firewall',
        vendor: 'Fortinet',
        serialNumber: 'FGT60F-FAKESERIAL01',
        controllerDeviceId: 'FGT60F-FAKESERIAL01',
        model: 'FortiGate 60F',
        mgmtIp: '192.168.1.254',
        status: 'online',
        haState: 'active',
        lastSeenAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
        metadataJson: { osVersion: 'FortiOS 7.4.2', vdom: 'root' },
      },
      {
        controllerId: fortinetCtrl.id,
        customerId: convergex.id,
        siteId: cvxHQ.id,
        hostname: 'FGT-CVX-HQ-02',
        deviceType: 'firewall',
        vendor: 'Fortinet',
        serialNumber: 'FGT60F-FAKESERIAL02',
        controllerDeviceId: 'FGT60F-FAKESERIAL02',
        model: 'FortiGate 60F',
        mgmtIp: '192.168.1.253',
        status: 'online',
        haState: 'standby',
        lastSeenAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
        metadataJson: { osVersion: 'FortiOS 7.4.2', vdom: 'root', haRole: 'standby' },
      },
      {
        controllerId: fortinetCtrl.id,
        customerId: pinnacle.id,
        siteId: pnlMemphis.id,
        hostname: 'FGT-PNL-Memphis',
        deviceType: 'firewall',
        vendor: 'Fortinet',
        serialNumber: 'FGT40F-FAKESERIAL03',
        controllerDeviceId: 'FGT40F-FAKESERIAL03',
        model: 'FortiGate 40F',
        mgmtIp: '10.5.1.254',
        status: 'degraded',
        haState: 'standalone',
        lastSeenAt: new Date(ctrlNow.getTime() - 12 * 60 * 1000),
        metadataJson: { osVersion: 'FortiOS 7.2.8', vdom: 'root' },
      },
    ])
    .returning();

  return devices;
}
