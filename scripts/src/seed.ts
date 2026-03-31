import {
  db,
  usersTable,
  customersTable,
  sitesTable,
  servicesTable,
  ticketsTable,
  ticketUpdatesTable,
  slaPoliciesTable,
} from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Clear all data in reverse dependency order
async function clearAll() {
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
