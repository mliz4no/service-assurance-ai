export async function seedUsers({ db, usersTable, hashPassword, nexatek, broadfields, nexatekPartner, }: { db: any; usersTable: any; hashPassword: (s: string) => string; nexatek: any; broadfields: any; nexatekPartner: any; }) {
  console.log('Creating staff users...');
  const [adminUser, ops1, ops2] = await db
    .insert(usersTable)
    .values([
      {
        name: 'Jordan Reyes',
        email: 'admin@serviceassurance.ai',
        passwordHash: hashPassword('Admin123!'),
        role: 'admin',
      },
      {
        name: 'Sam Okafor',
        email: 'ops@serviceassurance.ai',
        passwordHash: hashPassword('Ops123!'),
        role: 'ops',
      },
      {
        name: 'Taylor Brennan',
        email: 'taylor@serviceassurance.ai',
        passwordHash: hashPassword('Ops123!'),
        role: 'ops',
      },
    ])
    .returning();

  console.log('Creating customer portal users...');
  await db.insert(usersTable).values([
    {
      name: 'Marcus Webb',
      email: 'portal@nexatek.com',
      passwordHash: hashPassword('Acme123!'),
      role: 'customer',
      customerId: nexatek.id,
    },
    {
      name: 'Kevin Huang',
      email: 'portal@broadfields.com',
      passwordHash: hashPassword('Acme123!'),
      role: 'customer',
      customerId: broadfields.id,
    },
  ]);

  console.log('Creating partner portal user...');
  const [partnerAdmin] = await db
    .insert(usersTable)
    .values([
      {
        name: 'Nexatek Partner Admin',
        email: 'partneradmin@nexatek.com',
        passwordHash: hashPassword('Acme123!'),
        role: 'telecom_services_partner',
        telecomServicesPartnerId: nexatekPartner.id,
      },
    ])
    .returning();

  return { adminUser, ops1, ops2, partnerAdmin };
}
