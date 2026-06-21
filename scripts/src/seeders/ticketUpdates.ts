import { t, h, m, d } from '../time';

type Params = {
  db: any;
  ticketUpdatesTable: any;
  tickets: any;
  users: any;
};

export async function seedTicketUpdates(params: Params) {
  const { db, ticketUpdatesTable, tickets, users } = params;
  const { tk1, tk2, tk3, tk4, tk5, tk6, tk7, tk8, tk9, tk10 } = tickets;
  const { ops1, ops2 } = users;

  await db.insert(ticketUpdatesTable).values([
    {
      ticketId: tk1.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1001 opened by Sam Okafor',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(3.5) * 60000)),
    },
    {
      ticketId: tk1.id,
      updateType: 'internal_note',
      rawText:
        'Called AT&T Business Repair at 1-800-ATT-BUSN. Opened repair case ATT-INC-20241031-774421. Provided circuit ID and confirmed physical: CPE shows LOS on AT&T handoff port.',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(3.2) * 60000)),
    },
    {
      ticketId: tk1.id,
      updateType: 'vendor_update',
      rawText:
        "AT&T update: 'Trouble isolated to a fiber cut on the F1 span between the Midtown Nashville CO and the customer demarc. Crew dispatched.'",
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(2.5) * 60000)),
    },
    {
      ticketId: tk1.id,
      updateType: 'customer_update',
      rawText:
        'Update for Ridgeline Nashville: AT&T has identified a fiber cut. Repair crew en route. We will update you every 30 minutes.',
      visibility: 'customer',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(2.4) * 60000)),
    },
    // SA-1002 updates
    {
      ticketId: tk2.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1002 opened by Sam Okafor — automated BGP latency alert',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(2.2) * 60000)),
    },
    {
      ticketId: tk2.id,
      updateType: 'internal_note',
      rawText:
        'Ran MTR from DFW DC to exchange colocation. Hop 5 showing 7ms average vs normal 0.4ms. Opened Zayo case ZYO-TKT-2024-338847.',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(2) * 60000)),
    },
    // SA-1003 updates
    {
      ticketId: tk3.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1003 opened by Taylor Brennan',
      visibility: 'internal',
      createdByUserId: ops2.id,
      createdAt: t(new Date(Date.now() - h(5) * 60000)),
    },
    {
      ticketId: tk3.id,
      updateType: 'internal_note',
      rawText:
        'Confirmed speed test results with customer: 67Mbps down / 18Mbps up vs contracted 200/20. No CPE errors. Escalated to Spectrum Business Support.',
      visibility: 'internal',
      createdByUserId: ops2.id,
      createdAt: t(new Date(Date.now() - h(4.5) * 60000)),
    },
    // SA-1004 updates
    {
      ticketId: tk4.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1004 auto-created via API alerting — BGP session drop on ZAYO',
      visibility: 'internal',
      createdByUserId: ops2.id,
      createdAt: t(new Date(Date.now() - h(1.8) * 60000)),
    },
    {
      ticketId: tk4.id,
      updateType: 'internal_note',
      rawText:
        'Confirmed with ConvergeX NOC: BGP to Zayo dropped at 09:12 CST. Cogent failover active.',
      visibility: 'internal',
      createdByUserId: ops2.id,
      createdAt: t(new Date(Date.now() - h(1.6) * 60000)),
    },
    // SA-1005 updates
    {
      ticketId: tk5.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1005 opened by Sam Okafor — Cradlepoint failover alert received',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(4) * 60000)),
    },
    {
      ticketId: tk5.id,
      updateType: 'internal_note',
      rawText:
        'Customer confirmed Windstream down; Cradlepoint activated automatically. Opened case WIN-INC-119041-20241031.',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(3.7) * 60000)),
    },
    // SA-1008 updates
    {
      ticketId: tk8.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1008 opened by Taylor Brennan',
      visibility: 'internal',
      createdByUserId: ops2.id,
      createdAt: t(new Date(Date.now() - m(90) * 60000)),
    },
    {
      ticketId: tk8.id,
      updateType: 'internal_note',
      rawText:
        'Ran ICMP ping to Lumen handoff: 3–4% loss on 1000-packet test. Packet captures confirm loss is upstream of CPE.',
      visibility: 'internal',
      createdByUserId: ops2.id,
      createdAt: t(new Date(Date.now() - m(80) * 60000)),
    },
    // SA-1009 updates
    {
      ticketId: tk9.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1009 created via API — BGP keepalive failure detected',
      visibility: 'internal',
      createdByUserId: ops2.id,
      createdAt: t(new Date(Date.now() - m(30) * 60000)),
    },
    // SA-1010 updates
    {
      ticketId: tk10.id,
      updateType: 'system_event',
      rawText: 'Ticket SA-1010 opened by Sam Okafor',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(7) * 60000)),
    },
    {
      ticketId: tk10.id,
      updateType: 'internal_note',
      rawText:
        'Cradlepoint E3000 is back online. 5G connection re-established on Verizon. Confirmed with customer IT that PDU outlet was faulty and has been replaced.',
      visibility: 'internal',
      createdByUserId: ops1.id,
      createdAt: t(new Date(Date.now() - h(5.3) * 60000)),
    },
  ]);
}
