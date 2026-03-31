import {
  db,
  usersTable,
  customersTable,
  sitesTable,
  servicesTable,
  ticketsTable,
  ticketUpdatesTable,
  slaPoliciesTable,
  controllersTable,
  managedDevicesTable,
  networkLinksTable,
  deviceEventsTable,
  controllerSyncLogsTable,
  incidentCorrelationsTable,
} from "@workspace/db";
import crypto from "crypto";
import { eq } from "drizzle-orm";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Clear all data in reverse dependency order
async function clearAll() {
  await db.delete(incidentCorrelationsTable);
  await db.delete(deviceEventsTable);
  await db.delete(controllerSyncLogsTable);
  await db.delete(networkLinksTable);
  await db.delete(managedDevicesTable);
  await db.delete(controllersTable);
  await db.delete(ticketUpdatesTable);
  await db.delete(ticketsTable);
  await db.delete(servicesTable);
  await db.delete(sitesTable);
  await db.delete(usersTable);
  await db.delete(customersTable);
  await db.delete(slaPoliciesTable);
}

async function seed() {
  console.log("Seeding database...");
  console.log("Clearing existing data...");
  await clearAll();

  // ─── SLA Policies ────────────────────────────────────────────────────
  console.log("Creating SLA policies...");
  await db.insert(slaPoliciesTable).values([
    {
      name: "Critical — 4-Hour Resolution",
      severity: "critical",
      initialResponseMinutes: 15,
      escalationMinutes: 60,
      resolutionTargetMinutes: 240,
      isDefault: true,
    },
    {
      name: "High — 8-Hour Resolution",
      severity: "high",
      initialResponseMinutes: 30,
      escalationMinutes: 120,
      resolutionTargetMinutes: 480,
      isDefault: true,
    },
    {
      name: "Medium — 24-Hour Resolution",
      severity: "medium",
      initialResponseMinutes: 60,
      escalationMinutes: 240,
      resolutionTargetMinutes: 1440,
      isDefault: true,
    },
    {
      name: "Low — 48-Hour Resolution",
      severity: "low",
      initialResponseMinutes: 120,
      escalationMinutes: 480,
      resolutionTargetMinutes: 2880,
      isDefault: true,
    },
  ]);

  // ─── Staff Users ──────────────────────────────────────────────────────
  console.log("Creating users...");
  const [adminUser, ops1, ops2] = await db
    .insert(usersTable)
    .values([
      {
        name: "Jordan Reyes",
        email: "admin@serviceassurance.ai",
        passwordHash: hashPassword("Admin123!"),
        role: "admin",
      },
      {
        name: "Sam Okafor",
        email: "ops@serviceassurance.ai",
        passwordHash: hashPassword("Ops123!"),
        role: "ops",
      },
      {
        name: "Taylor Brennan",
        email: "taylor@serviceassurance.ai",
        passwordHash: hashPassword("Ops123!"),
        role: "ops",
      },
    ])
    .returning();

  // ─── Customers ────────────────────────────────────────────────────────
  console.log("Creating customers...");
  const [nexatek, ridgeline, broadfields, convergex, pinnacle] = await db
    .insert(customersTable)
    .values([
      {
        name: "Nexatek Solutions",
        accountNumber: "NXT-10041",
        status: "active",
        primaryContactName: "Marcus Webb",
        primaryContactEmail: "mwebb@nexatek.com",
        primaryContactPhone: "214-555-0171",
        notes:
          "Platinum tier. Multi-site enterprise with DIA and SD-WAN across 4 Texas locations. High sensitivity to latency — supports financial trading platforms.",
      },
      {
        name: "Ridgeline Healthcare Group",
        accountNumber: "RDG-10082",
        status: "active",
        primaryContactName: "Dr. Priya Nair",
        primaryContactEmail: "p.nair@ridgelinehealth.com",
        primaryContactPhone: "615-555-0234",
        notes:
          "HIPAA-regulated environment. Redundant connectivity mandatory. Any outage on patient-network circuits must escalate immediately.",
      },
      {
        name: "Broadfields Retail Corp",
        accountNumber: "BRF-10113",
        status: "active",
        primaryContactName: "Kevin Huang",
        primaryContactEmail: "khuang@broadfields.com",
        primaryContactPhone: "312-555-0318",
        notes:
          "Multi-state retail chain. Peak sensitivity around inventory and POS systems. 22 active sites. Primarily Comcast Business and Spectrum.",
      },
      {
        name: "ConvergeX Technologies",
        accountNumber: "CVX-10155",
        status: "active",
        primaryContactName: "Alicia Fontaine",
        primaryContactEmail: "afontaine@convergex.io",
        primaryContactPhone: "737-555-0492",
        notes:
          "SaaS company. Colocation in Austin DC. Primary dependency on Zayo 10G and Cogent backup. Engineering team is technically proficient.",
      },
      {
        name: "Pinnacle Logistics",
        accountNumber: "PNL-10197",
        status: "active",
        primaryContactName: "Darnell Simmons",
        primaryContactEmail: "dsimmons@pinnaclelogistics.com",
        primaryContactPhone: "901-555-0561",
        notes:
          "Regional trucking and warehousing. Wireless backup circuits at remote yard sites. Limited IT staff on-site at most locations.",
      },
    ])
    .returning();

  // ─── Customer portal users ────────────────────────────────────────────
  await db.insert(usersTable).values([
    {
      name: "Marcus Webb",
      email: "portal@nexatek.com",
      passwordHash: hashPassword("Acme123!"),
      role: "customer",
      customerId: nexatek.id,
    },
    {
      name: "Kevin Huang",
      email: "portal@broadfields.com",
      passwordHash: hashPassword("Acme123!"),
      role: "customer",
      customerId: broadfields.id,
    },
  ]);

  // ─── Sites ────────────────────────────────────────────────────────────
  console.log("Creating sites...");
  const [
    nxtHQ,
    nxtDC,
    nxtWarehouse,
    rdgNashville,
    rdgKnoxville,
    brfChicago,
    brfRockford,
    cvxAustinDC,
    cvxHQ,
    pnlMemphis,
    pnlJackson,
  ] = await db
    .insert(sitesTable)
    .values([
      {
        customerId: nexatek.id,
        siteName: "Nexatek Corporate HQ",
        address1: "2400 N Pearl St",
        city: "Dallas",
        state: "TX",
        postalCode: "75201",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "NXT-TX-HQ",
        notes: "Primary trading floor. Latency SLA < 3ms to exchange colocation.",
      },
      {
        customerId: nexatek.id,
        siteName: "Nexatek Data Center (DFW)",
        address1: "1901 N Stemmons Fwy",
        city: "Dallas",
        state: "TX",
        postalCode: "75207",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "NXT-TX-DC1",
        notes: "Colocation cage in Equinix DA1. Dual-homed Zayo + Lumen.",
      },
      {
        customerId: nexatek.id,
        siteName: "Nexatek Warehouse",
        address1: "800 E Mockingbird Ln",
        city: "Irving",
        state: "TX",
        postalCode: "75062",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "NXT-TX-WH1",
      },
      {
        customerId: ridgeline.id,
        siteName: "Ridgeline Nashville Medical Center",
        address1: "2400 Patterson St",
        city: "Nashville",
        state: "TN",
        postalCode: "37203",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "RDG-TN-NMC",
        notes: "Main hospital campus. EHR system hosted on-site. Fiber only — no wireless fallback.",
      },
      {
        customerId: ridgeline.id,
        siteName: "Ridgeline Knoxville Clinic",
        address1: "500 S Gay St",
        city: "Knoxville",
        state: "TN",
        postalCode: "37902",
        country: "US",
        timezone: "America/New_York",
        siteCode: "RDG-TN-KNX",
      },
      {
        customerId: broadfields.id,
        siteName: "Broadfields Chicago Distribution",
        address1: "1300 W Carroll Ave",
        city: "Chicago",
        state: "IL",
        postalCode: "60607",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "BRF-IL-DC1",
        notes: "Regional distribution center. 50+ POS terminals. Mission-critical during business hours.",
      },
      {
        customerId: broadfields.id,
        siteName: "Broadfields Rockford Store",
        address1: "4420 E State St",
        city: "Rockford",
        state: "IL",
        postalCode: "61108",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "BRF-IL-RFD",
      },
      {
        customerId: convergex.id,
        siteName: "ConvergeX Austin Colocation",
        address1: "9220 Waterford Centre Blvd",
        city: "Austin",
        state: "TX",
        postalCode: "78758",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "CVX-TX-AUS-DC",
        notes: "QTS Austin Data Center. Primary production environment.",
      },
      {
        customerId: convergex.id,
        siteName: "ConvergeX HQ",
        address1: "701 Brazos St",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "CVX-TX-HQ",
      },
      {
        customerId: pinnacle.id,
        siteName: "Pinnacle Memphis Terminal",
        address1: "3575 Tchoupitoulas St",
        city: "Memphis",
        state: "TN",
        postalCode: "38127",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "PNL-TN-MEM",
        notes: "Primary dispatch terminal. Wireless backup via Cradlepoint.",
      },
      {
        customerId: pinnacle.id,
        siteName: "Pinnacle Jackson Yard",
        address1: "201 E Pascagoula St",
        city: "Jackson",
        state: "MS",
        postalCode: "39201",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "PNL-MS-JAX",
        notes: "Remote yard site. Limited IT presence.",
      },
    ])
    .returning();

  // ─── Services / Circuits ──────────────────────────────────────────────
  console.log("Creating services...");
  const [
    svcNxtZayo,
    svcNxtLumen,
    svcNxtCradlepoint,
    svcRdgATT1,
    svcRdgATT2,
    svcBrfComcast,
    svcBrfSpectrum,
    svcCvxZayo,
    svcCvxCogent,
    svcPnlWindstream,
    svcPnlVerizonWireless,
    svcRdgCenturyLink,
  ] = await db
    .insert(servicesTable)
    .values([
      // Nexatek DFW DC — Zayo 10G
      {
        customerId: nexatek.id,
        siteId: nxtDC.id,
        vendorName: "Zayo",
        serviceType: "DIA",
        circuitId: "ZAYO/GNRN/334821/NTXK",
        bandwidth: "10Gbps",
        status: "active",
        installDate: "2022-03-15",
        monthlyRecurringCharge: "9800.00",
        supportReference: "ZYO-DC-00441",
        notes: "Primary circuit. Cross-connect to Equinix DA1 meet-me room.",
      },
      // Nexatek DFW DC — Lumen 10G backup
      {
        customerId: nexatek.id,
        siteId: nxtDC.id,
        vendorName: "Lumen",
        serviceType: "DIA",
        circuitId: "CLEC/LUMN/TX.DAL.29871.NTXK",
        bandwidth: "10Gbps",
        status: "active",
        installDate: "2022-03-15",
        monthlyRecurringCharge: "8500.00",
        supportReference: "LMN-TX-00872",
        notes: "Secondary/failover circuit. Auto-fail controlled via BGP.",
      },
      // Nexatek HQ — Cradlepoint 4G/5G failover
      {
        customerId: nexatek.id,
        siteId: nxtHQ.id,
        vendorName: "Cradlepoint",
        serviceType: "Wireless",
        circuitId: "CRPT-TX-HQ-5G-0021",
        bandwidth: "150Mbps",
        status: "active",
        installDate: "2023-01-10",
        monthlyRecurringCharge: "420.00",
        notes: "LTE/5G wireless failover. Active only when primary DIA fails.",
      },
      // Ridgeline Nashville — AT&T Fiber DIA
      {
        customerId: ridgeline.id,
        siteId: rdgNashville.id,
        vendorName: "AT&T",
        serviceType: "DIA",
        circuitId: "ATT/TN.NSH.88172/RDGH",
        bandwidth: "1Gbps",
        status: "active",
        installDate: "2021-06-01",
        monthlyRecurringCharge: "3200.00",
        supportReference: "ATT-TN-54821",
        notes: "Primary EHR and VoIP circuit. Redundancy required at all times.",
      },
      // Ridgeline Nashville — AT&T backup DIA
      {
        customerId: ridgeline.id,
        siteId: rdgNashville.id,
        vendorName: "AT&T",
        serviceType: "DIA",
        circuitId: "ATT/TN.NSH.88173/RDGH",
        bandwidth: "500Mbps",
        status: "down",
        installDate: "2021-06-01",
        monthlyRecurringCharge: "2100.00",
        supportReference: "ATT-TN-54822",
        notes: "CURRENTLY DOWN — backup DIA. Failover to primary activated.",
      },
      // Broadfields Chicago — Comcast Business
      {
        customerId: broadfields.id,
        siteId: brfChicago.id,
        vendorName: "Comcast Business",
        serviceType: "Broadband",
        circuitId: "CMC/IL.CHI.E209-4417/BRF",
        bandwidth: "500Mbps",
        status: "active",
        installDate: "2020-09-20",
        monthlyRecurringCharge: "720.00",
        supportReference: "CMCB-CHI-00129",
      },
      // Broadfields Rockford — Spectrum
      {
        customerId: broadfields.id,
        siteId: brfRockford.id,
        vendorName: "Spectrum Business",
        serviceType: "Broadband",
        circuitId: "SPT/IL.RFD.338821/BRF",
        bandwidth: "200Mbps",
        status: "impaired",
        installDate: "2021-03-05",
        monthlyRecurringCharge: "380.00",
        notes: "Currently showing intermittent speed drops. Ticket open.",
      },
      // ConvergeX Austin DC — Zayo 10G
      {
        customerId: convergex.id,
        siteId: cvxAustinDC.id,
        vendorName: "Zayo",
        serviceType: "DIA",
        circuitId: "ZAYO/GNRN/441023/CVGX",
        bandwidth: "10Gbps",
        status: "active",
        installDate: "2023-05-12",
        monthlyRecurringCharge: "10400.00",
        supportReference: "ZYO-AUS-00882",
        notes: "Carrier Ethernet to QTS Austin DC. BGP dual-stack.",
      },
      // ConvergeX Austin DC — Cogent backup
      {
        customerId: convergex.id,
        siteId: cvxAustinDC.id,
        vendorName: "Cogent",
        serviceType: "DIA",
        circuitId: "CGNT/TX.AUS.82991/CVGX",
        bandwidth: "1Gbps",
        status: "active",
        installDate: "2023-05-12",
        monthlyRecurringCharge: "1800.00",
        notes: "Secondary transit. AS174 peering. BGP failover.",
      },
      // Pinnacle Memphis — Windstream
      {
        customerId: pinnacle.id,
        siteId: pnlMemphis.id,
        vendorName: "Windstream",
        serviceType: "Broadband",
        circuitId: "WDST/TN.MEM.119041/PNL",
        bandwidth: "200Mbps",
        status: "active",
        installDate: "2022-11-01",
        monthlyRecurringCharge: "340.00",
        supportReference: "WIN-MEM-00394",
      },
      // Pinnacle Memphis — Verizon 5G wireless backup
      {
        customerId: pinnacle.id,
        siteId: pnlMemphis.id,
        vendorName: "Verizon Business",
        serviceType: "Wireless",
        circuitId: "VZB/5G-FRXD-TN.MEM.2240",
        bandwidth: "100Mbps",
        status: "active",
        installDate: "2023-07-15",
        monthlyRecurringCharge: "290.00",
        notes: "5G fixed wireless backup on Cradlepoint E3000.",
      },
      // Ridgeline Knoxville — Lumen/CenturyLink
      {
        customerId: ridgeline.id,
        siteId: rdgKnoxville.id,
        vendorName: "Lumen",
        serviceType: "DIA",
        circuitId: "CLEC/LUMN/TN.KNX.40021/RDGH",
        bandwidth: "500Mbps",
        status: "active",
        installDate: "2022-02-14",
        monthlyRecurringCharge: "2200.00",
        supportReference: "LMN-TN-01182",
      },
    ])
    .returning();

  // ─── Tickets ──────────────────────────────────────────────────────────
  console.log("Creating tickets...");
  const now = new Date();

  const t = (offsetMs: number) => new Date(now.getTime() + offsetMs);
  const m = (mins: number) => mins * 60 * 1000;
  const h = (hrs: number) => hrs * 3600 * 1000;
  const d = (days: number) => days * 86400 * 1000;

  const [
    tk1, tk2, tk3, tk4, tk5, tk6, tk7, tk8, tk9, tk10,
  ] = await db
    .insert(ticketsTable)
    .values([
      // ── SA-1001: Critical outage, SLA breached ──────────────────────
      {
        ticketNumber: "SA-1001",
        customerId: ridgeline.id,
        siteId: rdgNashville.id,
        serviceId: svcRdgATT2.id,
        title: "AT&T backup DIA down — Nashville Medical Center",
        description:
          "Customer reports complete loss of the AT&T backup DIA circuit (ATT/TN.NSH.88173/RDGH) at Ridgeline Nashville Medical Center. Primary circuit is load-sharing; patient network traffic is now concentrated on the primary 1G circuit creating congestion. EHR access is degraded. Per customer SLA, backup circuit restoration is critical. No physical access issue identified — CPE shows LOS on the AT&T hand-off port.",
        source: "manual",
        severity: "critical",
        status: "vendor_engaged",
        outageType: "outage",
        vendorTicketId: "ATT-INC-20241031-774421",
        assignedToUserId: ops1.id,
        openedAt: t(-h(3.5)),
        lastUpdatedAt: t(-m(45)),
        nextEscalationAt: t(-m(65)), // BREACHED 65 mins ago
        slaTargetMinutes: 240,
        aiSummary:
          "Critical outage on Ridgeline Nashville Medical Center's AT&T backup DIA circuit (500Mbps). Primary 1G circuit is currently handling full traffic load, causing EHR congestion. AT&T NOC has been engaged for 2+ hours. A technician dispatch to the Nashville central office was dispatched 90 minutes ago. No restoration ETA confirmed.",
        aiNormalizedStatus: "vendor_engaged",
        aiCustomerUpdate:
          "We are actively managing a circuit outage affecting your secondary connectivity at Nashville Medical Center. Your primary circuit remains operational. AT&T technicians are currently investigating and working toward restoration. We are escalating this case and will update you within 30 minutes.",
        aiLastGeneratedAt: t(-m(45)),
      },

      // ── SA-1002: High impairment, SLA approaching ──────────────────
      {
        ticketNumber: "SA-1002",
        customerId: nexatek.id,
        siteId: nxtDC.id,
        serviceId: svcNxtZayo.id,
        title: "Zayo 10G — elevated latency and intermittent loss, DFW DC",
        description:
          "Nexatek NOC reports elevated latency on Zayo circuit ZAYO/GNRN/334821/NTXK beginning approximately 2 hours ago. Baseline latency to exchange co-lo is 1.8ms; current observed latency is 11–14ms with 0.4–0.8% packet loss. Trading application is generating alerts. Zayo ticket opened. Monitoring BGP session — no drops yet but risk of failover to Lumen if loss exceeds 1%.",
        source: "manual",
        severity: "high",
        status: "vendor_engaged",
        outageType: "impairment",
        vendorTicketId: "ZYO-TKT-2024-338847",
        assignedToUserId: ops1.id,
        openedAt: t(-h(2.2)),
        lastUpdatedAt: t(-m(30)),
        nextEscalationAt: t(-m(25)), // BREACHED 25 mins ago
        slaTargetMinutes: 480,
      },

      // ── SA-1003: Medium — Spectrum bandwidth degraded ──────────────
      {
        ticketNumber: "SA-1003",
        customerId: broadfields.id,
        siteId: brfRockford.id,
        serviceId: svcBrfSpectrum.id,
        title: "Spectrum circuit speed below contracted rate — Rockford",
        description:
          "Broadfields Rockford store reports consistent throughput of 60–80Mbps down vs. contracted 200Mbps on Spectrum circuit SPT/IL.RFD.338821/BRF. Issue began after a brief outage last night (approximately 23:15 local). Upload speed appears normal at ~18Mbps. CPE shows no errors. Spectrum has been contacted — they are attributing this to a node-level issue in the Rockford area.",
        source: "manual",
        severity: "medium",
        status: "investigating",
        outageType: "impairment",
        vendorTicketId: "SPT-NOC-2024-19923",
        assignedToUserId: ops2.id,
        openedAt: t(-h(5)),
        lastUpdatedAt: t(-h(2)),
        nextEscalationAt: t(h(1.5)),
        slaTargetMinutes: 1440,
      },

      // ── SA-1004: Critical — Zayo ConvergeX complete outage ─────────
      {
        ticketNumber: "SA-1004",
        customerId: convergex.id,
        siteId: cvxAustinDC.id,
        serviceId: svcCvxZayo.id,
        title: "Zayo 10G complete loss — ConvergeX Austin DC (production down)",
        description:
          "ConvergeX reports total loss of Zayo primary 10G circuit ZAYO/GNRN/441023/CVGX at QTS Austin DC at 09:12 CST. BGP session dropped. Traffic has partially failed over to Cogent 1G backup, but production capacity is severely constrained — customer estimates 70% of production traffic cannot be carried on the 1G backup. Zayo NOC called immediately. CLEC physical investigation underway at QTS Austin DC meet-me room.",
        source: "api",
        severity: "critical",
        status: "dispatch_scheduled",
        outageType: "outage",
        vendorTicketId: "ZYO-INC-2024-441099",
        assignedToUserId: ops2.id,
        openedAt: t(-h(1.8)),
        lastUpdatedAt: t(-m(20)),
        nextEscalationAt: t(m(35)),
        slaTargetMinutes: 240,
        aiSummary:
          "Complete 10G circuit loss at ConvergeX Austin production DC. BGP failover to 1G Cogent backup is active but insufficient for full production load. Zayo technician dispatched to QTS Austin DC MMR. Physical layer investigation in progress — suspected fiber or patch panel issue in the meet-me room.",
        aiNormalizedStatus: "dispatch_scheduled",
        aiCustomerUpdate:
          "Your primary 10G circuit at Austin DC has experienced a complete outage. We have engaged Zayo Network Operations and a technician is currently on-site at QTS Austin investigating the physical layer. Your backup connectivity is active but constrained. We are treating this as our highest priority and will update you every 30 minutes until resolved.",
        aiLastGeneratedAt: t(-m(20)),
      },

      // ── SA-1005: High — Pinnacle wireless failover active ──────────
      {
        ticketNumber: "SA-1005",
        customerId: pinnacle.id,
        siteId: pnlMemphis.id,
        serviceId: svcPnlWindstream.id,
        title: "Windstream down — Memphis terminal, wireless failover active",
        description:
          "Pinnacle Memphis dispatch terminal reporting loss of Windstream broadband (WDST/TN.MEM.119041/PNL) since approximately 06:30 CST. Cradlepoint 4G/LTE failover via Verizon 5G has activated and terminal operations are continuing on wireless. Windstream's automated IVR is indicating an area outage affecting their Frayser node. No ETA provided. Customer reports dispatch operations are degraded due to higher latency on wireless.",
        source: "manual",
        severity: "high",
        status: "vendor_engaged",
        outageType: "outage",
        vendorTicketId: "WIN-INC-119041-20241031",
        assignedToUserId: ops1.id,
        openedAt: t(-h(4)),
        lastUpdatedAt: t(-h(1)),
        nextEscalationAt: t(m(20)),
        slaTargetMinutes: 480,
      },

      // ── SA-1006: Low — maintenance inquiry ────────────────────────
      {
        ticketNumber: "SA-1006",
        customerId: nexatek.id,
        siteId: nxtDC.id,
        serviceId: svcNxtLumen.id,
        title: "Lumen planned maintenance — CLEC/LUMN/TX.DAL.29871 — Nov 3 02:00–04:00 CST",
        description:
          "Lumen NOC sent maintenance notification MNT-2024-118821 for circuit CLEC/LUMN/TX.DAL.29871/NTXK scheduled for November 3, 02:00–04:00 CST. Maintenance involves fiber splice at the Dallas CO. Expected impact: brief BGP session drop, automatic failover to Zayo primary. Customer notification required. Verify Zayo primary can handle full load during maintenance window.",
        source: "email",
        severity: "low",
        status: "monitoring",
        outageType: "informational",
        openedAt: t(-d(2)),
        lastUpdatedAt: t(-d(1)),
        slaTargetMinutes: 2880,
      },

      // ── SA-1007: Medium — Comcast Business CPE replacement ─────────
      {
        ticketNumber: "SA-1007",
        customerId: broadfields.id,
        siteId: brfChicago.id,
        serviceId: svcBrfComcast.id,
        title: "Comcast Business CPE replacement scheduled — Chicago DC",
        description:
          "Customer reports Comcast technician is scheduled to swap the Comcast-provided modem at Chicago Distribution Center on November 2 between 10:00–14:00 CST. Brief service interruption expected (<5 min). Customer confirmed this is a provider-initiated hardware replacement. Monitoring ticket to ensure service restoration post-swap.",
        source: "manual",
        severity: "low",
        status: "monitoring",
        outageType: "informational",
        openedAt: t(-d(1)),
        lastUpdatedAt: t(-d(1)),
        slaTargetMinutes: 2880,
      },

      // ── SA-1008: High — Ridgeline Knoxville impairment ─────────────
      {
        ticketNumber: "SA-1008",
        customerId: ridgeline.id,
        siteId: rdgKnoxville.id,
        serviceId: svcRdgCenturyLink.id,
        title: "Lumen 500M — packet loss affecting VoIP at Knoxville Clinic",
        description:
          "Ridgeline Knoxville Clinic reports significant VoIP call quality degradation since this morning. Packet loss measured at 3–5% on Lumen circuit CLEC/LUMN/TN.KNX.40021/RDGH. Patient scheduling calls are being dropped. Lumen has been notified via their business support portal. Awaiting case number.",
        source: "manual",
        severity: "high",
        status: "new",
        outageType: "impairment",
        assignedToUserId: ops2.id,
        openedAt: t(-m(90)),
        lastUpdatedAt: t(-m(90)),
        nextEscalationAt: t(h(2.5)),
        slaTargetMinutes: 480,
      },

      // ── SA-1009: Medium — ConvergeX Cogent BGP reset ───────────────
      {
        ticketNumber: "SA-1009",
        customerId: convergex.id,
        siteId: cvxAustinDC.id,
        serviceId: svcCvxCogent.id,
        title: "Cogent BGP session reset — brief failover detected",
        description:
          "ConvergeX NOC reported a BGP session reset on Cogent circuit CGNT/TX.AUS.82991/CVGX at 14:22 CST. Session came back in 4 minutes. No customer impact observed per customer monitoring. Root cause unknown — may be Cogent maintenance. Investigating whether this correlates with the Zayo outage earlier today. Creating ticket for tracking purposes.",
        source: "api",
        severity: "medium",
        status: "investigating",
        outageType: "impairment",
        openedAt: t(-h(0.5)),
        lastUpdatedAt: t(-h(0.5)),
        nextEscalationAt: t(h(3.5)),
        slaTargetMinutes: 1440,
      },

      // ── SA-1010: Resolved — Nexatek warehouse outage ───────────────
      {
        ticketNumber: "SA-1010",
        customerId: nexatek.id,
        siteId: nxtWarehouse.id,
        serviceId: svcNxtCradlepoint.id,
        title: "Wireless circuit offline — Nexatek Irving Warehouse (RESOLVED)",
        description:
          "Nexatek Irving Warehouse reported complete loss of the Cradlepoint wireless circuit at 07:45 CST. Investigation revealed the Cradlepoint E3000 router had lost power due to a failed PDU outlet. Customer IT replaced the outlet and reconnected power at 09:15. Circuit restored. No carrier-side issue confirmed.",
        source: "manual",
        severity: "medium",
        status: "resolved",
        outageType: "outage",
        assignedToUserId: ops1.id,
        openedAt: t(-h(7)),
        lastUpdatedAt: t(-h(5.25)),
        resolvedAt: t(-h(5.25)),
        slaTargetMinutes: 1440,
      },
    ])
    .returning();

  // ─── Ticket Updates ───────────────────────────────────────────────────
  console.log("Creating ticket updates...");
  await db.insert(ticketUpdatesTable).values([

    // ── SA-1001 (AT&T backup down — Nashville) ───────────────────────
    {
      ticketId: tk1.id,
      updateType: "system_event",
      rawText: "Ticket SA-1001 opened by Sam Okafor",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(3.5)),
    },
    {
      ticketId: tk1.id,
      updateType: "internal_note",
      rawText:
        "Called AT&T Business Repair at 1-800-ATT-BUSN. Opened repair case ATT-INC-20241031-774421. Provided circuit ID ATT/TN.NSH.88173/RDGH and confirmed physical: CPE shows LOS on AT&T handoff port. AT&T NOC engineer stating they are pulling ticket for line dispatch.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(3.2)),
    },
    {
      ticketId: tk1.id,
      updateType: "vendor_update",
      rawText:
        "AT&T update (14:22 CST): 'Trouble has been isolated to a fiber cut on the F1 span between the Midtown Nashville CO and the customer demarc. Two-man crew dispatched from our Nashville plant. ETA to site: approximately 90 minutes. We will update at 16:00 CST.'",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(2.5)),
    },
    {
      ticketId: tk1.id,
      updateType: "customer_update",
      rawText:
        "Update for Ridgeline Nashville: AT&T has identified a fiber cut between their Nashville CO and your facility. A repair crew is en route and we expect to have an update by 16:00 CST. Your primary circuit remains operational and we are monitoring it closely. We will contact you every 30 minutes.",
      visibility: "customer",
      createdByUserId: ops1.id,
      createdAt: t(-h(2.4)),
    },
    {
      ticketId: tk1.id,
      updateType: "vendor_update",
      rawText:
        "AT&T update (15:45 CST): 'Crew on-site. Aerial fiber cut confirmed at pole 14-B on McGavock St. Splicing in progress. Estimate 60–90 minutes for restoration. Circuit will cycle briefly during restoration.' — AT&T NOC agent: Brandy Holloway ext. 4421.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-m(45)),
    },

    // ── SA-1002 (Zayo latency — Nexatek) ────────────────────────────
    {
      ticketId: tk2.id,
      updateType: "system_event",
      rawText: "Ticket SA-1002 opened by Sam Okafor — automated BGP latency alert",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(2.2)),
    },
    {
      ticketId: tk2.id,
      updateType: "internal_note",
      rawText:
        "Ran MTR from DFW DC to exchange colocation. Hop 5 (Zayo backbone) showing 7ms average vs normal 0.4ms. Issue is upstream in Zayo's network, not at our handoff. Opened Zayo case ZYO-TKT-2024-338847. Zayo case priority set to P2.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(2)),
    },
    {
      ticketId: tk2.id,
      updateType: "vendor_update",
      rawText:
        "Zayo NOC update (16:30 CST): 'We have identified a congested link on our DWDM backbone between DFW and our Chicago PoP. Network engineering is rerouting traffic. Expected resolution within 45 minutes.' — Zayo NOC: Case ID ZYO-TKT-2024-338847.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-m(30)),
    },

    // ── SA-1003 (Spectrum throughput — Broadfields Rockford) ─────────
    {
      ticketId: tk3.id,
      updateType: "system_event",
      rawText: "Ticket SA-1003 opened by Taylor Brennan",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-h(5)),
    },
    {
      ticketId: tk3.id,
      updateType: "internal_note",
      rawText:
        "Confirmed speed test results with customer: 67Mbps down / 18Mbps up vs. contracted 200/20. Ran Ookla test directly from CPE — same results. No CPE errors. Spectrum IVR acknowledged an area node issue in Rockford but did not provide case number. Escalated to Spectrum Business Support and opened case SPT-NOC-2024-19923.",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-h(4.5)),
    },
    {
      ticketId: tk3.id,
      updateType: "vendor_update",
      rawText:
        "Spectrum Business Support (17:12 CST): 'We are aware of a node impairment in the Rockford E. State corridor affecting some business customers. A network engineer is reviewing. We expect restoration within 2–4 hours.' No specific ETA given.",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-h(2)),
    },

    // ── SA-1004 (Zayo 10G — ConvergeX Austin DC) ─────────────────────
    {
      ticketId: tk4.id,
      updateType: "system_event",
      rawText: "Ticket SA-1004 auto-created via API alerting — BGP session drop on ZAYO/GNRN/441023/CVGX",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-h(1.8)),
    },
    {
      ticketId: tk4.id,
      updateType: "internal_note",
      rawText:
        "Confirmed with ConvergeX NOC: BGP to Zayo dropped at 09:12 CST. Cogent failover activated — AS174 BGP session is stable. Traffic is failing over but Cogent 1G capacity is not adequate for full prod load. Customer CPU on load balancers spiking. Called Zayo NOC — case ZYO-INC-2024-441099 opened as P1.",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-h(1.6)),
    },
    {
      ticketId: tk4.id,
      updateType: "vendor_update",
      rawText:
        "Zayo P1 update (09:45 CST): 'Physical layer investigation underway at QTS Austin MMR. Initial indication is a patch panel failure at the Zayo cross-connect. Field engineer dispatched — ETA 30 minutes to MMR.' — Zayo Major Incident Mgr: Tasha Gilmore.",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-h(1.2)),
    },
    {
      ticketId: tk4.id,
      updateType: "customer_update",
      rawText:
        "ConvergeX update: We have a P1 active with Zayo. Their team has identified a suspected patch panel issue at QTS Austin and a field engineer is on-site. Your Cogent backup is carrying traffic. We are driving toward the fastest possible restoration and will update you every 20 minutes.",
      visibility: "customer",
      createdByUserId: ops2.id,
      createdAt: t(-h(1.1)),
    },
    {
      ticketId: tk4.id,
      updateType: "vendor_update",
      rawText:
        "Zayo update (10:22 CST): 'Field engineer on-site at QTS MMR. Confirmed faulty SFP+ transceiver on our cross-connect port. Replacement transceiver being installed now. Circuit should restore within 15–20 minutes.' — ZYO-INC-2024-441099.",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-m(20)),
    },

    // ── SA-1005 (Windstream down — Pinnacle Memphis) ──────────────────
    {
      ticketId: tk5.id,
      updateType: "system_event",
      rawText: "Ticket SA-1005 opened by Sam Okafor — Cradlepoint failover alert received",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(4)),
    },
    {
      ticketId: tk5.id,
      updateType: "internal_note",
      rawText:
        "Customer confirmed: Windstream went down at ~06:30 CST. Cradlepoint activated automatically, currently on Verizon 5G. Windstream IVR: 'Our records show a reported outage affecting your area.' Called Windstream Business at 1-800-347-1991. Opened case WIN-INC-119041-20241031. Area outage at Frayser node confirmed by Windstream rep.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(3.7)),
    },
    {
      ticketId: tk5.id,
      updateType: "vendor_update",
      rawText:
        "Windstream Business update (11:45 CST): 'Area outage affecting the Frayser serving area confirmed. Root cause is an equipment failure at the Frayser node. Repair crew on-site. ETA for restoration: 14:00–15:00 CST.' — Windstream Business Support, Case WIN-INC-119041-20241031.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(1)),
    },

    // ── SA-1008 (Lumen VoIP — Ridgeline Knoxville) ───────────────────
    {
      ticketId: tk8.id,
      updateType: "system_event",
      rawText: "Ticket SA-1008 opened by Taylor Brennan",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-m(90)),
    },
    {
      ticketId: tk8.id,
      updateType: "internal_note",
      rawText:
        "Ran ICMP ping to Lumen handoff: 3–4% loss on 1000-packet test. Packet captures confirm loss is upstream of our CPE. Customer VoIP system is Cisco CUCM — call drops occurring at 60–90 second intervals correlating with loss events. Submitted Lumen Business Support ticket via portal. Awaiting case number callback.",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-m(80)),
    },

    // ── SA-1009 (Cogent BGP reset — ConvergeX) ───────────────────────
    {
      ticketId: tk9.id,
      updateType: "system_event",
      rawText: "Ticket SA-1009 created via API — BGP keepalive failure detected on CGNT/TX.AUS.82991/CVGX",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-m(30)),
    },
    {
      ticketId: tk9.id,
      updateType: "internal_note",
      rawText:
        "Reviewing BGP logs — session dropped at 14:22, re-established at 14:26 (4 minutes). No traffic loss measurable during failover per customer. Correlation with SA-1004 (Zayo outage earlier today) is possible — may be a result of Cogent carrying excess load during that window. Contacting Cogent NOC for session log review.",
      visibility: "internal",
      createdByUserId: ops2.id,
      createdAt: t(-m(25)),
    },

    // ── SA-1010 (Nexatek warehouse — resolved) ────────────────────────
    {
      ticketId: tk10.id,
      updateType: "system_event",
      rawText: "Ticket SA-1010 opened by Sam Okafor",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(7)),
    },
    {
      ticketId: tk10.id,
      updateType: "internal_note",
      rawText:
        "Cradlepoint ECNM dashboard shows E3000 router at Irving Warehouse offline since 07:43. No carrier alerts from Verizon. Unit appears to be powered off. Called customer IT — Kevin confirmed PDU issue in the rack. Power being restored.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(6.5)),
    },
    {
      ticketId: tk10.id,
      updateType: "internal_note",
      rawText:
        "Cradlepoint E3000 is back online. ECNM showing green. 5G connection re-established on Verizon. Confirmed with customer IT that PDU outlet was faulty and has been replaced. Wireless circuit is fully restored.",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(5.3)),
    },
    {
      ticketId: tk10.id,
      updateType: "customer_update",
      rawText:
        "Your wireless connectivity at Nexatek Irving Warehouse has been fully restored. The outage was caused by a failed PDU outlet in your equipment rack — this has been replaced by your on-site team. No carrier-side issue was identified. Please confirm operations are normal.",
      visibility: "customer",
      createdByUserId: ops1.id,
      createdAt: t(-h(5.25)),
    },
    {
      ticketId: tk10.id,
      updateType: "system_event",
      rawText: "Ticket resolved — circuit restored, customer confirmed",
      visibility: "internal",
      createdByUserId: ops1.id,
      createdAt: t(-h(5.25)),
    },
  ]);

  // ─── Controllers ─────────────────────────────────────────────────────
  console.log("Creating controllers...");
  const ctrlNow = new Date();
  const [merakiCtrl, fortinetCtrl] = await db
    .insert(controllersTable)
    .values([
      {
        name: "Cisco Meraki Dashboard — Nexatek Org",
        vendor: "meraki",
        type: "network_manager",
        baseUrl: "https://api.meraki.com/api/v1",
        authType: "api_key",
        apiKeyEncryptedOrPlaceholder: "placeholder",
        organizationIdOrTenant: "NXT-ORG-12345",
        pollingEnabled: true,
        pollingIntervalSeconds: 300,
        lastPolledAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
        lastPollStatus: "success",
        lastPollMessage: "Synced 3 devices, 5 links, 3 events",
      },
      {
        name: "FortiManager — ConvergeX + Pinnacle",
        vendor: "fortinet",
        type: "firewall_manager",
        baseUrl: "https://fortimanager.internal.cvx.io/jsonrpc",
        authType: "api_key",
        apiKeyEncryptedOrPlaceholder: "placeholder",
        organizationIdOrTenant: "CVX-TENANT-01",
        pollingEnabled: true,
        pollingIntervalSeconds: 600,
        lastPolledAt: new Date(ctrlNow.getTime() - 12 * 60 * 1000),
        lastPollStatus: "success",
        lastPollMessage: "Synced 3 devices, 3 links, 2 events",
      },
    ])
    .returning();

  // ─── Sync Logs ────────────────────────────────────────────────────────
  await db.insert(controllerSyncLogsTable).values([
    {
      controllerId: merakiCtrl.id,
      syncType: "full",
      startedAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
      completedAt: new Date(ctrlNow.getTime() - 4.5 * 60 * 1000),
      status: "success",
      message: "Synced 3 devices, 5 links, 3 events",
      recordsProcessed: 11,
    },
    {
      controllerId: fortinetCtrl.id,
      syncType: "full",
      startedAt: new Date(ctrlNow.getTime() - 12 * 60 * 1000),
      completedAt: new Date(ctrlNow.getTime() - 11 * 60 * 1000),
      status: "success",
      message: "Synced 3 devices, 3 links, 2 events",
      recordsProcessed: 8,
    },
    {
      controllerId: merakiCtrl.id,
      syncType: "full",
      startedAt: new Date(ctrlNow.getTime() - 65 * 60 * 1000),
      completedAt: new Date(ctrlNow.getTime() - 64.5 * 60 * 1000),
      status: "success",
      message: "Synced 3 devices, 5 links, 0 new events",
      recordsProcessed: 8,
    },
  ]);

  // ─── Managed Devices ─────────────────────────────────────────────────
  console.log("Creating managed devices...");
  const [mxHQ, mxDenver, mxAustin, fgtHQPrimary, fgtHQStandby, fgtChicago] = await db
    .insert(managedDevicesTable)
    .values([
      // Meraki devices (Nexatek)
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtHQ.id,
        hostname: "MX-NXT-HQ-Primary",
        deviceType: "appliance",
        vendor: "Meraki",
        serialNumber: "Q2TN-XXXX-NXT1",
        controllerDeviceId: "Q2TN-XXXX-NXT1",
        model: "MX84",
        mgmtIp: "10.0.1.1",
        status: "online",
        haState: "active",
        lastSeenAt: new Date(ctrlNow.getTime() - 2 * 60 * 1000),
        metadataJson: { networkId: "N_001", productType: "appliance" },
      },
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtWarehouse.id,
        hostname: "MX-NXT-Warehouse",
        deviceType: "appliance",
        vendor: "Meraki",
        serialNumber: "Q2TN-XXXX-NXT2",
        controllerDeviceId: "Q2TN-XXXX-NXT2",
        model: "MX67",
        mgmtIp: "10.1.1.1",
        status: "offline",
        lastSeenAt: new Date(ctrlNow.getTime() - 2.2 * 3600 * 1000),
        metadataJson: { networkId: "N_002", productType: "appliance" },
      },
      {
        controllerId: merakiCtrl.id,
        customerId: nexatek.id,
        siteId: nxtDC.id,
        hostname: "MX-NXT-DC1",
        deviceType: "appliance",
        vendor: "Meraki",
        serialNumber: "Q2TN-XXXX-NXT3",
        controllerDeviceId: "Q2TN-XXXX-NXT3",
        model: "MX85",
        mgmtIp: "10.2.1.1",
        status: "online",
        lastSeenAt: new Date(ctrlNow.getTime() - 60 * 1000),
        metadataJson: { networkId: "N_003", productType: "appliance" },
      },
      // Fortinet devices (ConvergeX)
      {
        controllerId: fortinetCtrl.id,
        customerId: convergex.id,
        siteId: cvxHQ.id,
        hostname: "FGT-CVX-HQ-01",
        deviceType: "firewall",
        vendor: "Fortinet",
        serialNumber: "FGT60F-FAKESERIAL01",
        controllerDeviceId: "FGT60F-FAKESERIAL01",
        model: "FortiGate 60F",
        mgmtIp: "192.168.1.254",
        status: "online",
        haState: "active",
        lastSeenAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
        metadataJson: { osVersion: "FortiOS 7.4.2", vdom: "root" },
      },
      {
        controllerId: fortinetCtrl.id,
        customerId: convergex.id,
        siteId: cvxHQ.id,
        hostname: "FGT-CVX-HQ-02",
        deviceType: "firewall",
        vendor: "Fortinet",
        serialNumber: "FGT60F-FAKESERIAL02",
        controllerDeviceId: "FGT60F-FAKESERIAL02",
        model: "FortiGate 60F",
        mgmtIp: "192.168.1.253",
        status: "online",
        haState: "standby",
        lastSeenAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
        metadataJson: { osVersion: "FortiOS 7.4.2", vdom: "root", haRole: "standby" },
      },
      {
        controllerId: fortinetCtrl.id,
        customerId: pinnacle.id,
        siteId: pnlMemphis.id,
        hostname: "FGT-PNL-Memphis",
        deviceType: "firewall",
        vendor: "Fortinet",
        serialNumber: "FGT40F-FAKESERIAL03",
        controllerDeviceId: "FGT40F-FAKESERIAL03",
        model: "FortiGate 40F",
        mgmtIp: "10.5.1.254",
        status: "degraded",
        haState: "standalone",
        lastSeenAt: new Date(ctrlNow.getTime() - 12 * 60 * 1000),
        metadataJson: { osVersion: "FortiOS 7.2.8", vdom: "root" },
      },
    ])
    .returning();

  // ─── Network Links ────────────────────────────────────────────────────
  console.log("Creating network links...");
  await db.insert(networkLinksTable).values([
    // Nexatek HQ — primary DIA up, LTE backup up
    {
      managedDeviceId: mxHQ.id,
      customerId: nexatek.id,
      siteId: nxtHQ.id,
      linkName: "WAN1 - AT&T Fiber DIA",
      linkType: "internet",
      providerName: "AT&T Business",
      circuitId: "ATT-DIA-290183-A",
      role: "primary",
      status: "up",
      latencyMs: 8.2,
      jitterMs: 0.4,
      packetLossPct: 0.0,
      lastPolledAt: new Date(ctrlNow.getTime() - 2 * 60 * 1000),
      metadataJson: { interface: "WAN1", publicIp: "12.34.56.78" },
    },
    {
      managedDeviceId: mxHQ.id,
      customerId: nexatek.id,
      siteId: nxtHQ.id,
      linkName: "WAN2 - Verizon LTE Backup",
      linkType: "lte",
      providerName: "Verizon",
      role: "backup",
      status: "up",
      latencyMs: 42.1,
      jitterMs: 3.8,
      packetLossPct: 0.2,
      lastPolledAt: new Date(ctrlNow.getTime() - 2 * 60 * 1000),
      metadataJson: { interface: "WAN2" },
    },
    // Nexatek Warehouse — PRIMARY DOWN, LTE FAILOVER ACTIVE
    {
      managedDeviceId: mxDenver.id,
      customerId: nexatek.id,
      siteId: nxtWarehouse.id,
      linkName: "WAN1 - Comcast Business",
      linkType: "broadband",
      providerName: "Comcast Business",
      circuitId: "CMC-BIZ-190224-B",
      role: "primary",
      status: "down",
      packetLossPct: 100,
      lastPolledAt: new Date(ctrlNow.getTime() - 2.2 * 3600 * 1000),
      metadataJson: { interface: "WAN1", lastStatusChange: new Date(ctrlNow.getTime() - 2.2 * 3600 * 1000).toISOString() },
    },
    {
      managedDeviceId: mxDenver.id,
      customerId: nexatek.id,
      siteId: nxtWarehouse.id,
      linkName: "WAN2 - AT&T LTE Failover",
      linkType: "lte",
      providerName: "AT&T",
      role: "backup",
      status: "up",
      latencyMs: 55.3,
      jitterMs: 6.1,
      packetLossPct: 0.8,
      lastPolledAt: new Date(ctrlNow.getTime() - 2.2 * 3600 * 1000),
      metadataJson: { interface: "WAN2", failoverActive: true },
    },
    // Nexatek DC
    {
      managedDeviceId: mxAustin.id,
      customerId: nexatek.id,
      siteId: nxtDC.id,
      linkName: "WAN1 - Zayo 10G",
      linkType: "internet",
      providerName: "Zayo",
      circuitId: "ZYO-DIA-NXT-DC1",
      role: "primary",
      status: "up",
      latencyMs: 5.1,
      jitterMs: 0.2,
      packetLossPct: 0.0,
      lastPolledAt: new Date(ctrlNow.getTime() - 60 * 1000),
      metadataJson: { interface: "WAN1" },
    },
    // ConvergeX HQ Fortinet
    {
      managedDeviceId: fgtHQPrimary.id,
      customerId: convergex.id,
      siteId: cvxHQ.id,
      linkName: "WAN1 - Zayo Fiber",
      linkType: "internet",
      providerName: "Zayo",
      circuitId: "ZYO-DIA-882901-Z",
      role: "primary",
      status: "up",
      latencyMs: 6.1,
      jitterMs: 0.3,
      packetLossPct: 0.0,
      lastPolledAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
      metadataJson: { interface: "wan1", sdwanMember: 1 },
    },
    {
      managedDeviceId: fgtHQPrimary.id,
      customerId: convergex.id,
      siteId: cvxHQ.id,
      linkName: "WAN2 - Lumen MPLS",
      linkType: "mpls",
      providerName: "Lumen",
      circuitId: "LMN-MPLS-449102-M",
      role: "backup",
      status: "up",
      latencyMs: 15.4,
      jitterMs: 1.2,
      packetLossPct: 0.0,
      lastPolledAt: new Date(ctrlNow.getTime() - 5 * 60 * 1000),
      metadataJson: { interface: "wan2", sdwanMember: 2 },
    },
    // Pinnacle Memphis — degraded link
    {
      managedDeviceId: fgtChicago.id,
      customerId: pinnacle.id,
      siteId: pnlMemphis.id,
      linkName: "WAN1 - Comcast Fiber",
      linkType: "internet",
      providerName: "Comcast Business",
      circuitId: "CMC-BIZ-551033-D",
      role: "primary",
      status: "degraded",
      latencyMs: 142.8,
      jitterMs: 38.5,
      packetLossPct: 12.3,
      lastPolledAt: new Date(ctrlNow.getTime() - 12 * 60 * 1000),
      metadataJson: { interface: "wan1", sdwanHealthCheck: "failing" },
    },
  ]);

  // ─── Device Events ────────────────────────────────────────────────────
  console.log("Creating device events...");
  const [wanDownEvt, fgtHaEvt, degradedEvt] = await db
    .insert(deviceEventsTable)
    .values([
      {
        controllerId: merakiCtrl.id,
        managedDeviceId: mxDenver.id,
        customerId: nexatek.id,
        siteId: nxtWarehouse.id,
        rawEventId: "meraki-evt-001",
        eventSource: "meraki_dashboard",
        severity: "high",
        eventType: "wan_status_change",
        title: "WAN1 link down — Nexatek Warehouse (Comcast Business)",
        description: "Primary WAN interface (Comcast Business, CMC-BIZ-190224-B) went offline. LTE failover is active on WAN2. Device is reachable via backup path.",
        rawPayloadJson: {
          type: "wan_status_change",
          networkId: "N_002",
          deviceSerial: "Q2TN-XXXX-NXT2",
          uplink: "WAN1",
          from: "active",
          to: "failed",
          circuitId: "CMC-BIZ-190224-B",
        },
        occurredAt: new Date(ctrlNow.getTime() - 2.2 * 3600 * 1000),
      },
      {
        controllerId: fortinetCtrl.id,
        managedDeviceId: fgtHQPrimary.id,
        customerId: convergex.id,
        siteId: cvxHQ.id,
        rawEventId: "fgt-evt-001",
        eventSource: "fortigate_system",
        severity: "high",
        eventType: "ha_failover",
        title: "HA failover detected — FGT-CVX-HQ cluster",
        description: "FortiGate HA cluster performed a failover event. FGT-CVX-HQ-02 (standby) was promoted to active. Traffic interruption estimated 2-5 seconds. Root cause: FGT-CVX-HQ-01 NIC heartbeat timeout.",
        rawPayloadJson: {
          logid: "0100032001",
          type: "event",
          subtype: "ha",
          level: "warning",
          msg: "HA master/slave changed",
          newmaster: "FGT60F-FAKESERIAL02",
          reason: "heartbeat_timeout",
        },
        occurredAt: new Date(ctrlNow.getTime() - 4.2 * 3600 * 1000),
      },
      {
        controllerId: fortinetCtrl.id,
        managedDeviceId: fgtChicago.id,
        customerId: pinnacle.id,
        siteId: pnlMemphis.id,
        rawEventId: "fgt-evt-002",
        eventSource: "fortigate_sdwan",
        severity: "medium",
        eventType: "sdwan_link_quality",
        title: "SD-WAN link quality degraded — Pinnacle Memphis (Comcast)",
        description: "WAN1 SD-WAN health check failing on Pinnacle Memphis FortiGate. Packet loss 12.3%, latency 142ms. Threshold: latency > 100ms, loss > 5%. Service may route to backup if available.",
        rawPayloadJson: {
          logid: "0117044545",
          type: "event",
          subtype: "sdwan",
          level: "warning",
          interface: "wan1",
          packetloss: 12.3,
          latency: 142.8,
          jitter: 38.5,
          healthcheck: "comcast_hc",
          status: "fail",
        },
        occurredAt: new Date(ctrlNow.getTime() - 55 * 60 * 1000),
      },
    ])
    .returning();

  // ─── Incident Correlations ────────────────────────────────────────────
  // Link events to the seed tickets (find relevant open tickets)
  console.log("Creating incident correlations...");

  // Find tickets for nexatek/convergex/pinnacle that might be open
  const allTickets = await db.select().from(ticketsTable);
  const nexatekOpenTickets = allTickets.filter(
    (t) => t.customerId === nexatek.id && !["resolved", "closed"].includes(t.status)
  );
  const convergexOpenTickets = allTickets.filter(
    (t) => t.customerId === convergex.id && !["resolved", "closed"].includes(t.status)
  );
  const pinnacleOpenTickets = allTickets.filter(
    (t) => t.customerId === pinnacle.id && !["resolved", "closed"].includes(t.status)
  );

  // Correlate WAN down event to a Nexatek open ticket if one exists
  if (nexatekOpenTickets.length > 0) {
    await db.insert(incidentCorrelationsTable).values({
      ticketId: nexatekOpenTickets[0].id,
      deviceEventId: wanDownEvt.id,
      correlationType: "trigger",
    });
    // Mark that ticket as controller-sourced
    await db.update(ticketsTable)
      .set({ incidentSource: "controller", impactedDeviceId: mxDenver.id, failoverActive: true })
      .where(eq(ticketsTable.id, nexatekOpenTickets[0].id));
  }

  if (convergexOpenTickets.length > 0) {
    await db.insert(incidentCorrelationsTable).values({
      ticketId: convergexOpenTickets[0].id,
      deviceEventId: fgtHaEvt.id,
      correlationType: "trigger",
    });
  }

  if (pinnacleOpenTickets.length > 0) {
    await db.insert(incidentCorrelationsTable).values({
      ticketId: pinnacleOpenTickets[0].id,
      deviceEventId: degradedEvt.id,
      correlationType: "related",
    });
  }

  console.log("\nSeed complete! Login credentials:");
  console.log("  Admin: admin@serviceassurance.ai / Admin123!");
  console.log("  Ops:   ops@serviceassurance.ai / Ops123!");
  console.log("  Customer portal (Nexatek): portal@nexatek.com / Acme123!");
  console.log("  Customer portal (Broadfields): portal@broadfields.com / Acme123!");
}

seed()
  .then(() => {
    console.log("Done!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
