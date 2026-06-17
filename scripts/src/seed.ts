// DB module is imported dynamically inside `seed()` to support DRY_RUN without a real DB
import { eq } from 'drizzle-orm';
import { hashPassword } from './utils';
import { t, h, m, d } from './time';
import { seedCustomers } from './seeders/customers';
import { seedSites } from './seeders/sites';
import { seedUsers } from './seeders/users';
import { seedServices } from './seeders/services';
import { seedTickets } from './seeders/tickets';
import { seedTicketUpdates } from './seeders/ticketUpdates';
import { seedControllers } from './seeders/controllers';
import { seedManagedDevices } from './seeders/managedDevices';
import { seedDeviceEvents } from './seeders/deviceEvents';
import { seedNetworkLinks } from './seeders/networkLinks';

// `clearAll` will be created inside `seed()` where table symbols are available


async function seed() {
  console.log('Starting seed...');
  const isDry = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  const fakeDb = {
    delete: async (tbl: any) => {
      console.log('[DRY_RUN] delete', tbl?.name || tbl);
    },
    insert: (tbl: any) => ({
      values: (vals: any) => ({
        returning: async () => {
          const arr = Array.isArray(vals) ? vals : [vals];
          const out = arr.map((v: any, i: number) => ({ ...(v || {}), id: `sim-${Math.random().toString(36).slice(2,8)}-${i + 1}` }));
          console.log('[DRY_RUN] insert', tbl?.name || tbl, out);
          return out;
        },
      }),
    }),
    select: () => ({
      from: async (_tbl: any) => {
        console.log('[DRY_RUN] select.from', _tbl?.name || _tbl);
        return [];
      },
    }),
    update: (_tbl: any) => ({
      set: (_obj: any) => ({
        where: async (_cond: any) => {
          console.log('[DRY_RUN] update', _tbl?.name || _tbl, _obj);
        },
      }),
    }),
  };

  // load DB module only when not dry-run to avoid requiring DATABASE_URL
  let db: any = undefined;
  let usersTable: any,
    customersTable: any,
    sitesTable: any,
    servicesTable: any,
    ticketsTable: any,
    ticketUpdatesTable: any,
    slaPoliciesTable: any,
    controllersTable: any,
    managedDevicesTable: any,
    networkLinksTable: any,
    deviceEventsTable: any,
    controllerSyncLogsTable: any,
    incidentCorrelationsTable: any,
    customerContactsTable: any,
    telecomServicesPartnersTable: any;

  if (!isDry) {
    const mod = await import('@workspace/db');
    db = mod.db;
    usersTable = mod.usersTable;
    customersTable = mod.customersTable;
    sitesTable = mod.sitesTable;
    servicesTable = mod.servicesTable;
    ticketsTable = mod.ticketsTable;
    ticketUpdatesTable = mod.ticketUpdatesTable;
    slaPoliciesTable = mod.slaPoliciesTable;
    controllersTable = mod.controllersTable;
    managedDevicesTable = mod.managedDevicesTable;
    networkLinksTable = mod.networkLinksTable;
    deviceEventsTable = mod.deviceEventsTable;
    controllerSyncLogsTable = mod.controllerSyncLogsTable;
    incidentCorrelationsTable = mod.incidentCorrelationsTable;
    customerContactsTable = mod.customerContactsTable;
    telecomServicesPartnersTable = mod.telecomServicesPartnersTable;
  } else {
    const make = (n: string) => ({ name: n });
    usersTable = make('usersTable');
    customersTable = make('customersTable');
    sitesTable = make('sitesTable');
    servicesTable = make('servicesTable');
    ticketsTable = make('ticketsTable');
    ticketUpdatesTable = make('ticketUpdatesTable');
    slaPoliciesTable = make('slaPoliciesTable');
    controllersTable = make('controllersTable');
    managedDevicesTable = make('managedDevicesTable');
    networkLinksTable = make('networkLinksTable');
    deviceEventsTable = make('deviceEventsTable');
    controllerSyncLogsTable = make('controllerSyncLogsTable');
    incidentCorrelationsTable = make('incidentCorrelationsTable');
    customerContactsTable = make('customerContactsTable');
    telecomServicesPartnersTable = make('telecomServicesPartnersTable');
  }

  const runDb = isDry ? fakeDb : db;

  async function clearAll(runDbLocal: any) {
    // best-effort clears; in dry-run the fake DB will just log
    await runDbLocal.delete?.(incidentCorrelationsTable);
    await runDbLocal.delete?.(deviceEventsTable);
    await runDbLocal.delete?.(controllerSyncLogsTable);
    await runDbLocal.delete?.(networkLinksTable);
    await runDbLocal.delete?.(managedDevicesTable);
    await runDbLocal.delete?.(controllersTable);
    await runDbLocal.delete?.(ticketUpdatesTable);
    await runDbLocal.delete?.(ticketsTable);
    await runDbLocal.delete?.(servicesTable);
    await runDbLocal.delete?.(sitesTable);
    await runDbLocal.delete?.(usersTable);
    await runDbLocal.delete?.(customersTable);
    await runDbLocal.delete?.(telecomServicesPartnersTable);
  }

  await clearAll(runDb);

  const customers = await seedCustomers({ db: runDb, customersTable, customerContactsTable });
  const { nexatek, ridgeline, broadfields, convergex, pinnacle } = customers;

  const sites = await seedSites(runDb, sitesTable, nexatek, ridgeline, broadfields, convergex, pinnacle);
  const {
    nxtHQ,
    nxtDC,
    nxtWarehouse,
    nxtDenver,
    nxtAustin,
    nxtPhoenix,
    rdgNashville,
    rdgKnoxville,
    brfChicago,
    brfRockford,
    cvxAustinDC,
    cvxHQ,
    pnlMemphis,
  } = sites;

  // create a default telecom partner for demo users
  const [nexatekPartner] = await runDb.insert(telecomServicesPartnersTable).values([
    {
      name: 'Nexatek Partner',
      companyName: 'Nexatek Integrations',
      email: 'partner@nexatek.com',
      phone: '',
    },
  ]).returning();

  const users = await seedUsers({ db: runDb, usersTable, hashPassword, nexatek, broadfields, nexatekPartner });
  const { adminUser, ops1, ops2, partnerAdmin } = users;

  const services = await seedServices(runDb, servicesTable, nexatek, ridgeline, broadfields, convergex, pinnacle, nxtDC, nxtHQ, nxtWarehouse, rdgNashville, rdgKnoxville, brfChicago, brfRockford, cvxAustinDC, pnlMemphis);

  const tickets = await seedTickets({ db: runDb, ticketsTable, customers, sites, services, users });

  await seedTicketUpdates({ db: runDb, ticketUpdatesTable, tickets, users });

  const { merakiCtrl, fortinetCtrl, ctrlNow } = await seedControllers({ db: runDb, controllersTable, controllerSyncLogsTable });

  const managedDevices = await seedManagedDevices({ db: runDb, managedDevicesTable, controllers: { merakiCtrl, fortinetCtrl }, customers, sites, ctrlNow });

  const networkLinks = await seedNetworkLinks({ db: runDb, networkLinksTable, managedDevices, customers, sites, ctrlNow });

  const deviceEvents = await seedDeviceEvents({ db: runDb, deviceEventsTable, controllers: { merakiCtrl, fortinetCtrl }, managedDevices, customers, sites, ctrlNow });

  // Incident correlations: associate some events to open tickets
  const allTickets = await runDb.select().from(ticketsTable);
  const nexatekOpenTickets = allTickets.filter(
    (t: any) => t.customerId === nexatek.id && !['resolved', 'closed'].includes(t.status),
  );
  const convergexOpenTickets = allTickets.filter(
    (t: any) => t.customerId === convergex.id && !['resolved', 'closed'].includes(t.status),
  );
  const pinnacleOpenTickets = allTickets.filter(
    (t: any) => t.customerId === pinnacle.id && !['resolved', 'closed'].includes(t.status),
  );

  const [
    wanConnLostEvt,
    wanDownEvt,
    lteFoEvt,
    austinVpnEvt,
    phoenixFwEvt,
    hqArpEvt,
    fgtHaEvt,
    degradedEvt,
  ] = deviceEvents;

  if (nexatekOpenTickets.length > 0) {
    await runDb.insert(incidentCorrelationsTable).values([
      {
        ticketId: nexatekOpenTickets[0].id,
        deviceEventId: wanConnLostEvt?.id,
        correlationType: 'trigger',
      },
      {
        ticketId: nexatekOpenTickets[0].id,
        deviceEventId: wanDownEvt?.id,
        correlationType: 'related',
      },
    ]);
    await runDb
      .update(ticketsTable)
      .set({
        incidentSource: 'controller',
        impactedDeviceId: managedDevices.find((d: any) => d.hostname?.includes('Denver'))?.id,
        failoverActive: true,
      })
      .where(eq(ticketsTable.id, nexatekOpenTickets[0].id));
  }

  if (convergexOpenTickets.length > 0) {
    await runDb.insert(incidentCorrelationsTable).values({
      ticketId: convergexOpenTickets[0].id,
      deviceEventId: fgtHaEvt?.id,
      correlationType: 'trigger',
    });
  }

  if (pinnacleOpenTickets.length > 0) {
    await runDb.insert(incidentCorrelationsTable).values({
      ticketId: pinnacleOpenTickets[0].id,
      deviceEventId: degradedEvt?.id,
      correlationType: 'related',
    });
  }

  console.log('\nSeed complete! Login credentials:');
  console.log('  Admin: admin@serviceassurance.ai / Admin123!');
  console.log('  Ops:   ops@serviceassurance.ai / Ops123!');
  console.log('  Partner: partneradmin@nexatek.com / Acme123!');
  console.log('  Customer portal (Nexatek): portal@nexatek.com / Acme123!');
}

export { seed };

const isMain =
  process.argv[1] && (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));

if (isMain) {
  seed()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
