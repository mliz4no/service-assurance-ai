import { db, usersTable, customersTable, sitesTable, servicesTable, ticketsTable, ticketUpdatesTable, slaPoliciesTable } from "@workspace/db";
import crypto from "crypto";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  console.log("Seeding database...");

  console.log("Creating SLA policies...");
  const [criticalSla, highSla] = await db
    .insert(slaPoliciesTable)
    .values([
      {
        name: "Critical Response SLA",
        severity: "critical",
        initialResponseMinutes: 15,
        escalationMinutes: 60,
        resolutionTargetMinutes: 240,
        isDefault: true,
      },
      {
        name: "High Priority SLA",
        severity: "high",
        initialResponseMinutes: 30,
        escalationMinutes: 120,
        resolutionTargetMinutes: 480,
        isDefault: true,
      },
      {
        name: "Medium Priority SLA",
        severity: "medium",
        initialResponseMinutes: 60,
        escalationMinutes: 240,
        resolutionTargetMinutes: 1440,
        isDefault: true,
      },
      {
        name: "Low Priority SLA",
        severity: "low",
        initialResponseMinutes: 120,
        escalationMinutes: 480,
        resolutionTargetMinutes: 2880,
        isDefault: true,
      },
    ])
    .returning();

  console.log("Creating users...");
  const [adminUser, opsUser] = await db
    .insert(usersTable)
    .values([
      {
        name: "Admin User",
        email: "admin@serviceassurance.ai",
        passwordHash: hashPassword("Admin123!"),
        role: "admin",
      },
      {
        name: "Ops Engineer",
        email: "ops@serviceassurance.ai",
        passwordHash: hashPassword("Ops123!"),
        role: "ops",
      },
    ])
    .returning();

  console.log("Creating customers...");
  const [acme, techCorp, globalNet] = await db
    .insert(customersTable)
    .values([
      {
        name: "Acme Corporation",
        accountNumber: "ACME-001",
        status: "active",
        primaryContactName: "John Smith",
        primaryContactEmail: "jsmith@acme.com",
        primaryContactPhone: "555-100-1001",
        notes: "Platinum tier customer. Multi-site enterprise.",
      },
      {
        name: "TechCorp Industries",
        accountNumber: "TECH-002",
        status: "active",
        primaryContactName: "Sarah Johnson",
        primaryContactEmail: "sjohnson@techcorp.com",
        primaryContactPhone: "555-200-2002",
        notes: "Growth account. Recently added SD-WAN services.",
      },
      {
        name: "Global Networks LLC",
        accountNumber: "GLOB-003",
        status: "active",
        primaryContactName: "Mike Davis",
        primaryContactEmail: "mdavis@globalnetworks.com",
        primaryContactPhone: "555-300-3003",
        notes: "Multi-state retailer. Sensitive to outages.",
      },
    ])
    .returning();

  const customerUser = await db
    .insert(usersTable)
    .values({
      name: "ACME Contact",
      email: "portal@acme.com",
      passwordHash: hashPassword("Acme123!"),
      role: "customer",
      customerId: acme.id,
    })
    .returning();

  console.log("Creating sites...");
  const [acmeHQ, acmeDC, techCorpMain, globalNet1, globalNet2] = await db
    .insert(sitesTable)
    .values([
      {
        customerId: acme.id,
        siteName: "Acme HQ",
        address1: "100 Corporate Blvd",
        city: "Dallas",
        state: "TX",
        postalCode: "75201",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "ACME-TX-001",
      },
      {
        customerId: acme.id,
        siteName: "Acme Data Center",
        address1: "200 Server Farm Rd",
        city: "Austin",
        state: "TX",
        postalCode: "78701",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "ACME-TX-DC",
        notes: "Primary data center. Redundant connectivity required.",
      },
      {
        customerId: techCorp.id,
        siteName: "TechCorp HQ",
        address1: "500 Innovation Way",
        city: "San Jose",
        state: "CA",
        postalCode: "95110",
        country: "US",
        timezone: "America/Los_Angeles",
        siteCode: "TECH-CA-001",
      },
      {
        customerId: globalNet.id,
        siteName: "Global Networks Chicago",
        address1: "300 Michigan Ave",
        city: "Chicago",
        state: "IL",
        postalCode: "60601",
        country: "US",
        timezone: "America/Chicago",
        siteCode: "GLOB-IL-001",
      },
      {
        customerId: globalNet.id,
        siteName: "Global Networks Atlanta",
        address1: "400 Peachtree St",
        city: "Atlanta",
        state: "GA",
        postalCode: "30303",
        country: "US",
        timezone: "America/New_York",
        siteCode: "GLOB-GA-001",
      },
    ])
    .returning();

  console.log("Creating services...");
  const [svc1, svc2, svc3, svc4, svc5, svc6, svc7, svc8] = await db
    .insert(servicesTable)
    .values([
      {
        customerId: acme.id,
        siteId: acmeHQ.id,
        vendorName: "AT&T",
        serviceType: "DIA",
        circuitId: "ATT-TX-00123",
        bandwidth: "1Gbps",
        status: "active",
        monthlyRecurringCharge: "2500.00",
        supportReference: "ATT-SUP-001",
      },
      {
        customerId: acme.id,
        siteId: acmeDC.id,
        vendorName: "Lumen",
        serviceType: "DIA",
        circuitId: "LMN-TX-00456",
        bandwidth: "10Gbps",
        status: "active",
        monthlyRecurringCharge: "8000.00",
        supportReference: "LMN-SUP-002",
        notes: "Primary circuit for DC. Redundant via AT&T.",
      },
      {
        customerId: acme.id,
        siteId: acmeHQ.id,
        vendorName: "Cradlepoint",
        serviceType: "SD-WAN",
        circuitId: "CRPT-TX-001",
        bandwidth: "500Mbps",
        status: "active",
        monthlyRecurringCharge: "1200.00",
      },
      {
        customerId: techCorp.id,
        siteId: techCorpMain.id,
        vendorName: "Comcast Business",
        serviceType: "Broadband",
        circuitId: "CMC-CA-00789",
        bandwidth: "500Mbps",
        status: "down",
        monthlyRecurringCharge: "800.00",
        notes: "Currently down. Trouble ticket open.",
      },
      {
        customerId: techCorp.id,
        siteId: techCorpMain.id,
        vendorName: "Meraki",
        serviceType: "SD-WAN",
        circuitId: "MRK-CA-001",
        bandwidth: "500Mbps",
        status: "impaired",
        monthlyRecurringCharge: "950.00",
      },
      {
        customerId: globalNet.id,
        siteId: globalNet1.id,
        vendorName: "Spectrum Business",
        serviceType: "Broadband",
        circuitId: "SPT-IL-00321",
        bandwidth: "200Mbps",
        status: "active",
        monthlyRecurringCharge: "450.00",
      },
      {
        customerId: globalNet.id,
        siteId: globalNet2.id,
        vendorName: "Comcast Business",
        serviceType: "Broadband",
        circuitId: "CMC-GA-00654",
        bandwidth: "200Mbps",
        status: "active",
        monthlyRecurringCharge: "450.00",
      },
      {
        customerId: globalNet.id,
        siteId: globalNet1.id,
        vendorName: "Vonage",
        serviceType: "Voice",
        circuitId: "VON-IL-001",
        bandwidth: "100 channels",
        status: "active",
        monthlyRecurringCharge: "600.00",
      },
    ])
    .returning();

  console.log("Creating tickets...");
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
  const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [ticket1, ticket2, ticket3, ticket4, ticket5, ticket6] = await db
    .insert(ticketsTable)
    .values([
      {
        ticketNumber: "SA-1001",
        customerId: techCorp.id,
        siteId: techCorpMain.id,
        serviceId: svc4.id,
        title: "Comcast Business circuit down - TechCorp HQ",
        description: "Customer reports complete loss of internet service on primary broadband circuit CMC-CA-00789. All devices affected. No failover configured.",
        source: "manual",
        severity: "critical",
        status: "vendor_engaged",
        outageType: "outage",
        vendorTicketId: "CMC-INC-2024-88123",
        assignedToUserId: opsUser.id,
        openedAt: twoHoursAgo,
        lastUpdatedAt: oneHourAgo,
        nextEscalationAt: new Date(now.getTime() - 15 * 60 * 1000),
        slaTargetMinutes: 240,
        aiSummary: "Critical outage affecting TechCorp HQ primary broadband circuit. Comcast has been engaged and a technician dispatch is expected within 2 hours. No ETA confirmed.",
        aiNormalizedStatus: "vendor_engaged",
        aiCustomerUpdate: "We are aware of the service disruption at your TechCorp HQ location. We have engaged Comcast Business and are actively working to restore your service. We will provide an update as soon as more information is available.",
        aiLastGeneratedAt: oneHourAgo,
      },
      {
        ticketNumber: "SA-1002",
        customerId: acme.id,
        siteId: acmeHQ.id,
        serviceId: svc1.id,
        title: "AT&T DIA intermittent packet loss - Acme HQ",
        description: "Customer reporting 15-20% packet loss on AT&T DIA circuit ATT-TX-00123. Affecting VoIP and video conferencing. Started approximately 3 hours ago.",
        source: "manual",
        severity: "high",
        status: "investigating",
        outageType: "impairment",
        vendorTicketId: "ATT-TKT-2024-55678",
        assignedToUserId: opsUser.id,
        openedAt: fourHoursAgo,
        lastUpdatedAt: twoHoursAgo,
        nextEscalationAt: new Date(now.getTime() - 30 * 60 * 1000),
        slaTargetMinutes: 480,
      },
      {
        ticketNumber: "SA-1003",
        customerId: acme.id,
        siteId: acmeDC.id,
        serviceId: svc2.id,
        title: "Lumen 10G circuit maintenance window inquiry",
        description: "Customer requesting information about upcoming planned maintenance on Lumen 10G circuit at data center.",
        source: "manual",
        severity: "low",
        status: "monitoring",
        outageType: "informational",
        openedAt: oneDayAgo,
        lastUpdatedAt: oneDayAgo,
        slaTargetMinutes: 2880,
      },
      {
        ticketNumber: "SA-1004",
        customerId: techCorp.id,
        siteId: techCorpMain.id,
        serviceId: svc5.id,
        title: "Meraki SD-WAN tunnel flapping - performance degraded",
        description: "SD-WAN tunnels are flapping intermittently causing periodic performance degradation. Users reporting slow application response times.",
        source: "manual",
        severity: "medium",
        status: "investigating",
        outageType: "impairment",
        openedAt: oneHourAgo,
        lastUpdatedAt: oneHourAgo,
        nextEscalationAt: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        slaTargetMinutes: 1440,
      },
      {
        ticketNumber: "SA-1005",
        customerId: globalNet.id,
        siteId: globalNet1.id,
        serviceId: svc6.id,
        title: "Spectrum circuit speed test results below contracted bandwidth",
        description: "Customer performing speed tests and getting 90Mbps down vs contracted 200Mbps. Consistently reproducible.",
        source: "manual",
        severity: "medium",
        status: "new",
        outageType: "impairment",
        openedAt: now,
        lastUpdatedAt: now,
        nextEscalationAt: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        slaTargetMinutes: 1440,
      },
      {
        ticketNumber: "SA-1006",
        customerId: globalNet.id,
        siteId: globalNet2.id,
        serviceId: svc7.id,
        title: "Comcast Atlanta - circuit restored after power event",
        description: "Service was disrupted due to a power event at customer premises. UPS battery depleted. Circuit came back online after power restored.",
        source: "manual",
        severity: "high",
        status: "resolved",
        outageType: "outage",
        openedAt: oneDayAgo,
        lastUpdatedAt: twoHoursAgo,
        resolvedAt: twoHoursAgo,
        slaTargetMinutes: 480,
      },
    ])
    .returning();

  console.log("Creating ticket updates...");
  await db.insert(ticketUpdatesTable).values([
    {
      ticketId: ticket1.id,
      updateType: "system_event",
      rawText: "Ticket SA-1001 created by Ops Engineer",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: twoHoursAgo,
    },
    {
      ticketId: ticket1.id,
      updateType: "internal_note",
      rawText: "Called Comcast NOC at 555-800-2345. Reported as widespread outage in San Jose area. Estimated 2-hour restore. Monitoring.",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: new Date(twoHoursAgo.getTime() + 15 * 60 * 1000),
    },
    {
      ticketId: ticket1.id,
      updateType: "vendor_update",
      rawText: "Comcast update: Our network team has identified the issue as a fiber cut on our backbone near downtown San Jose. Technicians have been dispatched. Estimated repair time 2-3 hours from now. We will update every 30 minutes.",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: oneHourAgo,
    },
    {
      ticketId: ticket1.id,
      updateType: "customer_update",
      rawText: "We have been in contact with Comcast Business. Their teams have identified a fiber cut and technicians are on-site working to restore service. We are monitoring closely and will update you every 30 minutes.",
      visibility: "customer",
      createdByUserId: opsUser.id,
      createdAt: oneHourAgo,
    },
    {
      ticketId: ticket2.id,
      updateType: "system_event",
      rawText: "Ticket SA-1002 created by Ops Engineer",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: fourHoursAgo,
    },
    {
      ticketId: ticket2.id,
      updateType: "vendor_update",
      rawText: "AT&T case opened. Network engineers are looking at the route from Dallas CO to customer premises. Will provide update in 2 hours.",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: twoHoursAgo,
    },
    {
      ticketId: ticket3.id,
      updateType: "system_event",
      rawText: "Ticket SA-1003 opened for maintenance inquiry",
      visibility: "internal",
      createdByUserId: adminUser.id,
      createdAt: oneDayAgo,
    },
    {
      ticketId: ticket4.id,
      updateType: "system_event",
      rawText: "Ticket SA-1004 opened for SD-WAN investigation",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: oneHourAgo,
    },
    {
      ticketId: ticket6.id,
      updateType: "system_event",
      rawText: "Ticket SA-1006 opened after power event reported",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: oneDayAgo,
    },
    {
      ticketId: ticket6.id,
      updateType: "vendor_update",
      rawText: "Comcast confirmed power event at customer premises caused CPE to reboot. Circuit restored once power was re-established. No network-side issues.",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: twoHoursAgo,
    },
    {
      ticketId: ticket6.id,
      updateType: "customer_update",
      rawText: "Your Comcast circuit at Atlanta has been fully restored following the power event. The service outage was caused by a power disruption at your premises. Please verify service is normal on your end.",
      visibility: "customer",
      createdByUserId: opsUser.id,
      createdAt: twoHoursAgo,
    },
    {
      ticketId: ticket6.id,
      updateType: "system_event",
      rawText: "Ticket resolved. Service restored.",
      visibility: "internal",
      createdByUserId: opsUser.id,
      createdAt: twoHoursAgo,
    },
  ]);

  console.log("\nSeed complete! Login credentials:");
  console.log("  Admin:    admin@serviceassurance.ai / Admin123!");
  console.log("  Ops:      ops@serviceassurance.ai / Ops123!");
  console.log("  Customer: portal@acme.com / Acme123!");
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
