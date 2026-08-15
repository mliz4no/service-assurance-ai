import 'dotenv/config';
import app from './app';
import { logger } from './lib/logger';
import { db, usersTable, telecomServicesPartnersTable, customersTable } from '@workspace/db';
import { seed } from '@workspace/scripts';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { createMonitoringScheduler, type MonitoringScheduler } from './lib/monitoring-scheduler';
import { runNagiosMonitoring, runSyntheticMonitoring } from './lib/monitoring-execution';
import { acquireDistributedLock } from './lib/distributed-lock';

const rawPort = process.env['PORT'];

if (!rawPort) {
  throw new Error('PORT environment variable is required but was not provided.');
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

async function autoSeedIfEmpty() {
  try {
    const rows = await db.select().from(usersTable).limit(1);
    if (rows.length === 0) {
      logger.info('Empty database detected — running seed...');
      await seed();
      logger.info('Seed complete.');
      return;
    }
  } catch (err) {
    logger.error({ err }, 'Auto-seed failed');
  }
}

async function patchPartnerIfMissing() {
  try {
    const existingPartners = await db.select().from(telecomServicesPartnersTable).limit(1);
    if (existingPartners.length > 0) return;

    logger.info('No partner orgs found — inserting demo partner...');

    const [partner] = await db
      .insert(telecomServicesPartnersTable)
      .values({
        name: 'Nexatek Solutions',
        companyName: 'Nexatek Solutions Ltd.',
        email: 'partner@nexatek.com',
        phone: '+1-800-639-2835',
        status: 'active',
        notes: 'Demo reseller partner account',
      })
      .returning();

    await db.insert(usersTable).values({
      name: 'Nexatek Partner Admin',
      email: 'partneradmin@nexatek.com',
      passwordHash: hashPassword('Acme123!'),
      role: 'telecom_services_partner',
      telecomServicesPartnerId: partner.id,
    });

    const nexatek = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.name, 'Nexatek Solutions'))
      .limit(1);
    const ridgeline = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.name, 'Ridgeline Healthcare Group'))
      .limit(1);

    if (nexatek[0]) {
      await db
        .update(customersTable)
        .set({ telecomServicesPartnerId: partner.id })
        .where(eq(customersTable.id, nexatek[0].id));
    }
    if (ridgeline[0]) {
      await db
        .update(customersTable)
        .set({ telecomServicesPartnerId: partner.id })
        .where(eq(customersTable.id, ridgeline[0].id));
    }

    logger.info('Partner patch complete.');
  } catch (err) {
    logger.error({ err }, 'Partner patch failed');
  }
}

function startMonitoringScheduler(): MonitoringScheduler | null {
  if (process.env.MONITORING_SCHEDULER_ENABLED !== 'true') return null;

  const rawInterval = Number(process.env.MONITORING_INTERVAL_MS ?? '60000');
  const intervalMs = Number.isFinite(rawInterval) ? Math.max(1_000, rawInterval) : 60_000;
  const mode = process.env.MONITORING_MODE ?? 'synthetic';

  return createMonitoringScheduler({
    intervalMs,
    runImmediately: process.env.MONITORING_RUN_IMMEDIATELY === 'true',
    jobName: `monitoring:${mode}`,
    acquireLease: () => acquireDistributedLock(`service-assurance:monitoring:${mode}`),
    run: async () => {
      if (mode === 'nagios') return runNagiosMonitoring();
      if (mode === 'both') {
        const [synthetic, nagios] = await Promise.all([
          runSyntheticMonitoring(),
          runNagiosMonitoring(),
        ]);
        return {
          processed: synthetic.processed + nagios.processed,
          createdTickets: synthetic.createdTickets + nagios.createdTickets,
          updatedTickets: synthetic.updatedTickets + nagios.updatedTickets,
        };
      }
      return runSyntheticMonitoring();
    },
  });
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, 'Error listening on port');
    process.exit(1);
  }

  logger.info({ port }, 'Server listening');
  await autoSeedIfEmpty();
  await patchPartnerIfMissing();
  const scheduler = startMonitoringScheduler();
  if (scheduler) {
    logger.info('Automated monitoring scheduler started');
    const stop = () => scheduler.stop();
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  }
});
