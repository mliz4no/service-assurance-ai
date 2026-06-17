import type { DrizzleClient } from 'drizzle-orm';
import { t, h, m, d } from '../time';

type SeedParams = {
  db: any;
  ticketsTable: any;
  customers: any;
  sites: any;
  services: any;
  users: any;
};

export async function seedTickets(params: SeedParams) {
  const { db, ticketsTable, customers, sites, services, users } = params;
  const { nexatek, ridgeline, broadfields, convergex, pinnacle } = customers;
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
  const {
    svcNxtZayo,
    svcNxtLumen,
    svcNxtCradlepoint,
    svcRdgATT1,
    svcBrfSpectrum,
    svcBrfComcast,
    svcCvxZayo,
    svcCvxCogent,
    svcPnlWindstream,
    svcRdgCenturyLink,
  } = services;
  const { ops1, ops2 } = users;

  const [tk1, tk2, tk3, tk4, tk5, tk6, tk7, tk8, tk9, tk10] = await db
    .insert(ticketsTable)
    .values([
      {
        ticketNumber: 'SA-1001',
        customerId: ridgeline.id,
        siteId: rdgNashville.id,
        serviceId: svcRdgATT1?.id,
        title: 'AT&T backup down — Nashville clinic (clinical systems degraded)',
        description:
          'Ridgeline Nashville clinic reporting loss of AT&T backup handoff (ATT/TN.NSH.88173/RDGH). Primary Zayo remains up but customers are reporting degraded access to non-critical portals. Opened vendor repair case via AT&T business support.',
        source: 'manual',
        severity: 'high',
        status: 'investigating',
        outageType: 'outage',
        vendorTicketId: 'ATT-INC-20241031-774421',
        assignedToUserId: ops1.id,
        openedAt: t(new Date(Date.now() - h(5) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - h(2) * 60000)),
        nextEscalationAt: t(new Date(Date.now() + h(1.5) * 60000)),
        slaTargetMinutes: 480,
      },
      {
        ticketNumber: 'SA-1002',
        customerId: nexatek.id,
        siteId: nxtHQ.id,
        serviceId: svcNxtZayo?.id,
        title: 'Zayo backbone latency — Nexatek HQ traffic degraded',
        description:
          'Automated BGP latency alert observed from exchange to DFW — suspect congestion on Zayo backbone. Cognitive monitoring alerted. Opened internal ticket to investigate and notify Zayo NOC.',
        source: 'api',
        severity: 'medium',
        status: 'investigating',
        outageType: 'impairment',
        assignedToUserId: ops1.id,
        openedAt: t(new Date(Date.now() - h(2) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - h(1) * 60000)),
        slaTargetMinutes: 1440,
      },
      {
        ticketNumber: 'SA-1003',
        customerId: broadfields.id,
        siteId: brfRockford.id,
        serviceId: svcBrfSpectrum.id,
        title: 'Spectrum circuit speed below contracted rate — Rockford',
        description:
          'Broadfields Rockford store reports consistent throughput of 60–80Mbps down vs. contracted 200Mbps on Spectrum circuit. Issue began after a brief outage last night. Spectrum contacted.',
        source: 'manual',
        severity: 'medium',
        status: 'investigating',
        outageType: 'impairment',
        vendorTicketId: 'SPT-NOC-2024-19923',
        assignedToUserId: ops2.id,
        openedAt: t(new Date(Date.now() - h(5) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - h(2) * 60000)),
        nextEscalationAt: t(new Date(Date.now() + h(1.5) * 60000)),
        slaTargetMinutes: 1440,
      },
      {
        ticketNumber: 'SA-1004',
        customerId: convergex.id,
        siteId: cvxAustinDC.id,
        serviceId: svcCvxZayo.id,
        title: 'Zayo 10G complete loss — ConvergeX Austin DC (production down)',
        description:
          'ConvergeX reports total loss of Zayo primary 10G circuit at QTS Austin DC. BGP session dropped. Traffic partially failed over to Cogent 1G backup.',
        source: 'api',
        severity: 'critical',
        status: 'dispatch_scheduled',
        outageType: 'outage',
        vendorTicketId: 'ZYO-INC-2024-441099',
        assignedToUserId: ops2.id,
        openedAt: t(new Date(Date.now() - h(1.8) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - m(20) * 60000)),
        nextEscalationAt: t(new Date(Date.now() + m(35) * 60000)),
        slaTargetMinutes: 240,
        aiSummary:
          'Complete 10G circuit loss at ConvergeX Austin production DC. BGP failover to 1G Cogent backup is active but insufficient for full production load.',
        aiNormalizedStatus: 'dispatch_scheduled',
        aiCustomerUpdate:
          'Your primary 10G circuit at Austin DC has experienced a complete outage. We have engaged Zayo Network Operations and a technician is currently on-site.',
        aiLastGeneratedAt: t(new Date(Date.now() - m(20) * 60000)),
      },
      {
        ticketNumber: 'SA-1005',
        customerId: pinnacle.id,
        siteId: pnlMemphis.id,
        serviceId: svcPnlWindstream.id,
        title: 'Windstream down — Memphis terminal, wireless failover active',
        description:
          'Pinnacle Memphis dispatch terminal reporting loss of Windstream broadband. Cradlepoint 4G/LTE failover via Verizon 5G has activated.',
        source: 'manual',
        severity: 'high',
        status: 'vendor_engaged',
        outageType: 'outage',
        vendorTicketId: 'WIN-INC-119041-20241031',
        assignedToUserId: ops1.id,
        openedAt: t(new Date(Date.now() - h(4) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - h(1) * 60000)),
        nextEscalationAt: t(new Date(Date.now() + m(20) * 60000)),
        slaTargetMinutes: 480,
      },
      {
        ticketNumber: 'SA-1006',
        customerId: nexatek.id,
        siteId: nxtDC.id,
        serviceId: svcNxtLumen.id,
        title: 'Lumen planned maintenance — CLEC/LUMN/TX.DAL.29871 — Nov 3 02:00–04:00 CST',
        description:
          'Lumen NOC sent maintenance notification for circuit scheduled for Nov 3. Expected impact: brief BGP session drop, automatic failover to Zayo primary.',
        source: 'email',
        severity: 'low',
        status: 'monitoring',
        outageType: 'informational',
        openedAt: t(new Date(Date.now() - d(2) * 24 * 60 * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - d(1) * 24 * 60 * 60000)),
        slaTargetMinutes: 2880,
      },
      {
        ticketNumber: 'SA-1007',
        customerId: broadfields.id,
        siteId: brfChicago.id,
        serviceId: svcBrfComcast.id,
        title: 'Comcast Business CPE replacement scheduled — Chicago DC',
        description:
          'Customer reports Comcast technician scheduled to swap Comcast-provided modem at Chicago Distribution Center.',
        source: 'manual',
        severity: 'low',
        status: 'monitoring',
        outageType: 'informational',
        openedAt: t(new Date(Date.now() - d(1) * 24 * 60 * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - d(1) * 24 * 60 * 60000)),
        slaTargetMinutes: 2880,
      },
      {
        ticketNumber: 'SA-1008',
        customerId: ridgeline.id,
        siteId: rdgKnoxville.id,
        serviceId: svcRdgCenturyLink.id,
        title: 'Lumen 500M — packet loss affecting VoIP at Knoxville Clinic',
        description:
          'Ridgeline Knoxville Clinic reports significant VoIP call quality degradation. Packet loss measured at 3–5% on Lumen circuit.',
        source: 'manual',
        severity: 'high',
        status: 'new',
        outageType: 'impairment',
        assignedToUserId: ops2.id,
        openedAt: t(new Date(Date.now() - m(90) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - m(90) * 60000)),
        nextEscalationAt: t(new Date(Date.now() + h(2.5) * 60000)),
        slaTargetMinutes: 480,
      },
      {
        ticketNumber: 'SA-1009',
        customerId: convergex.id,
        siteId: cvxAustinDC.id,
        serviceId: svcCvxCogent.id,
        title: 'Cogent BGP session reset — brief failover detected',
        description:
          'ConvergeX NOC reported a BGP session reset on Cogent circuit. Session came back in 4 minutes.',
        source: 'api',
        severity: 'medium',
        status: 'investigating',
        outageType: 'impairment',
        openedAt: t(new Date(Date.now() - h(0.5) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - h(0.5) * 60000)),
        nextEscalationAt: t(new Date(Date.now() + h(3.5) * 60000)),
        slaTargetMinutes: 1440,
      },
      {
        ticketNumber: 'SA-1010',
        customerId: nexatek.id,
        siteId: nxtWarehouse.id,
        serviceId: svcNxtCradlepoint.id,
        title: 'Wireless circuit offline — Nexatek Irving Warehouse (RESOLVED)',
        description:
          'Nexatek Irving Warehouse reported complete loss of the Cradlepoint wireless circuit. Investigation revealed the Cradlepoint router had lost power; power restored by customer IT.',
        source: 'manual',
        severity: 'medium',
        status: 'resolved',
        outageType: 'outage',
        assignedToUserId: ops1.id,
        openedAt: t(new Date(Date.now() - h(7) * 60000)),
        lastUpdatedAt: t(new Date(Date.now() - h(5.25) * 60000)),
        resolvedAt: t(new Date(Date.now() - h(5.25) * 60000)),
        slaTargetMinutes: 1440,
      },
    ])
    .returning();

  return { tk1, tk2, tk3, tk4, tk5, tk6, tk7, tk8, tk9, tk10 };
}
