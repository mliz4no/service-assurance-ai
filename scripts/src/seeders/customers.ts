export async function seedCustomers({ db, customersTable, customerContactsTable }: { db: any; customersTable: any; customerContactsTable: any; }) {
  console.log('Creating customers...');
  const [nexatek, ridgeline, broadfields, convergex, pinnacle] = await db
    .insert(customersTable)
    .values([
      {
        name: 'Nexatek Solutions',
        accountNumber: 'NXT-10041',
        status: 'active',
        primaryContactName: 'Marcus Webb',
        primaryContactEmail: 'mwebb@nexatek.com',
        primaryContactPhone: '214-555-0171',
        telecomServicesPartnerId: undefined,
        notes:
          'Platinum tier. Multi-site enterprise with DIA and SD-WAN across 4 Texas locations. High sensitivity to latency — supports financial trading platforms.',
      },
      {
        name: 'Ridgeline Healthcare Group',
        accountNumber: 'RDG-10082',
        status: 'active',
        primaryContactName: 'Dr. Priya Nair',
        primaryContactEmail: 'p.nair@ridgelinehealth.com',
        primaryContactPhone: '615-555-0234',
        telecomServicesPartnerId: undefined,
        notes:
          'HIPAA-regulated environment. Redundant connectivity mandatory. Any outage on patient-network circuits must escalate immediately.',
      },
      {
        name: 'Broadfields Retail Corp',
        accountNumber: 'BRF-10113',
        status: 'active',
        primaryContactName: 'Kevin Huang',
        primaryContactEmail: 'khuang@broadfields.com',
        primaryContactPhone: '312-555-0318',
        notes:
          'Multi-state retail chain. Peak sensitivity around inventory and POS systems. 22 active sites. Primarily Comcast Business and Spectrum.',
      },
      {
        name: 'ConvergeX Technologies',
        accountNumber: 'CVX-10155',
        status: 'active',
        primaryContactName: 'Alicia Fontaine',
        primaryContactEmail: 'afontaine@convergex.io',
        primaryContactPhone: '737-555-0492',
        notes:
          'SaaS company. Colocation in Austin DC. Primary dependency on Zayo 10G and Cogent backup. Engineering team is technically proficient.',
      },
      {
        name: 'Pinnacle Logistics',
        accountNumber: 'PNL-10197',
        status: 'active',
        primaryContactName: 'Darnell Simmons',
        primaryContactEmail: 'dsimmons@pinnaclelogistics.com',
        primaryContactPhone: '901-555-0561',
        notes:
          'Regional trucking and warehousing. Wireless backup circuits at remote yard sites. Limited IT staff on-site at most locations.',
      },
    ])
    .returning();

  // Customer Escalation Contacts
  console.log('Creating customer contacts...');
  await db.insert(customerContactsTable).values([
    {
      customerId: nexatek.id,
      name: 'Sarah Chen',
      email: 's.chen@nexatek.com',
      phone: '+1 972-555-0301',
      role: 'noc',
      notifyOnSeverity: 'medium',
      notifyOnDurationMinutes: null,
      notificationChannels: 'email',
    },
    {
      customerId: nexatek.id,
      name: 'Brad Torres',
      email: 'b.torres@nexatek.com',
      phone: '+1 972-555-0302',
      role: 'manager',
      notifyOnSeverity: 'high',
      notifyOnDurationMinutes: 30,
      notificationChannels: 'email',
    },
    {
      customerId: nexatek.id,
      name: 'Kelly Park',
      email: 'k.park@nexatek.com',
      phone: '+1 972-555-0303',
      role: 'director',
      notifyOnSeverity: 'critical',
      notifyOnDurationMinutes: 60,
      notificationChannels: 'email',
    },
    {
      customerId: ridgeline.id,
      name: 'James Liu',
      email: 'j.liu@ridgelinehealth.com',
      phone: '+1 615-555-0401',
      role: 'noc',
      notifyOnSeverity: 'low',
      notifyOnDurationMinutes: null,
      notificationChannels: 'email',
    },
    {
      customerId: ridgeline.id,
      name: 'Lisa Warren',
      email: 'l.warren@ridgelinehealth.com',
      phone: '+1 615-555-0402',
      role: 'manager',
      notifyOnSeverity: 'medium',
      notifyOnDurationMinutes: 15,
      notificationChannels: 'email',
    },
    {
      customerId: ridgeline.id,
      name: 'Dr. Priya Nair',
      email: 'p.nair@ridgelinehealth.com',
      phone: '+1 615-555-0234',
      role: 'executive',
      notifyOnSeverity: 'high',
      notifyOnDurationMinutes: 30,
      notificationChannels: 'email',
    },
    {
      customerId: broadfields.id,
      name: 'Tony Reyes',
      email: 't.reyes@broadfields.com',
      phone: '+1 312-555-0501',
      role: 'noc',
      notifyOnSeverity: 'medium',
      notifyOnDurationMinutes: null,
      notificationChannels: 'email',
    },
    {
      customerId: broadfields.id,
      name: 'Kevin Huang',
      email: 'khuang@broadfields.com',
      phone: '+1 312-555-0318',
      role: 'manager',
      notifyOnSeverity: 'high',
      notifyOnDurationMinutes: 60,
      notificationChannels: 'email',
    },
    {
      customerId: pinnacle.id,
      name: 'Mike Fontenot',
      email: 'm.fontenot@pinnaclelogistics.com',
      phone: '+1 901-555-0601',
      role: 'noc',
      notifyOnSeverity: 'high',
      notifyOnDurationMinutes: null,
      notificationChannels: 'email',
    },
    {
      customerId: pinnacle.id,
      name: 'Darnell Simmons',
      email: 'dsimmons@pinnaclelogistics.com',
      phone: '+1 901-555-0561',
      role: 'director',
      notifyOnSeverity: 'critical',
      notifyOnDurationMinutes: 120,
      notificationChannels: 'email',
    },
  ]);

  return { nexatek, ridgeline, broadfields, convergex, pinnacle };
}
