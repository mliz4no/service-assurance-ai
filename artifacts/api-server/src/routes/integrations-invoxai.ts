import { Router, type IRouter } from 'express';
import { and, eq } from 'drizzle-orm';
import { db, customersTable, servicesTable, sitesTable, ticketsTable } from '@workspace/db';
import { requireAuth, requireIntegrationAuth } from '../middlewares/auth';
import {
  handleIdempotentCreate,
  logIntegrationMutation,
  normalizeServiceType,
  validateRequiredFields,
} from '../lib/integration';
import { sendBadRequest } from '../lib/http';

const router: IRouter = Router();

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return 'code' in error && (error as { code?: string }).code === '23505';
}

router.post(
  '/integrations/invoxai/customers/upsert',
  requireAuth,
  requireIntegrationAuth('integrations:create'),
  async (req, res): Promise<void> => {
    const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, [
      'externalId',
      'name',
      'status',
    ]);
    if (Object.keys(fieldErrors).length > 0) {
      sendBadRequest(res, 'Validation failed', fieldErrors);
      return;
    }

    const result = await handleIdempotentCreate(req, res, 'customers', async () => {
      const externalId = String(req.body.externalId);

      const [existing] = await db
        .select()
        .from(customersTable)
        .where(
          and(
            eq(customersTable.externalSource, 'invoxai'),
            eq(customersTable.externalId, externalId),
          ),
        );

      if (existing) {
        const [updated] = await db
          .update(customersTable)
          .set({
            name: req.body.name,
            status: req.body.status,
            accountNumber: req.body.accountNumber,
            primaryContactName: req.body.primaryContactName,
            primaryContactEmail: req.body.primaryContactEmail,
            primaryContactPhone: req.body.primaryContactPhone,
            notes: req.body.notes,
            externalSyncedAt: req.body.externalSyncedAt ? new Date(req.body.externalSyncedAt) : new Date(),
            externalSyncStatus: req.body.externalSyncStatus ?? 'synced',
            updatedAt: new Date(),
          })
          .where(eq(customersTable.id, existing.id))
          .returning();

        logIntegrationMutation(req, 'upsert', 'customers', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }

      try {
        const [created] = await db
          .insert(customersTable)
          .values({
            name: req.body.name,
            status: req.body.status,
            accountNumber: req.body.accountNumber,
            primaryContactName: req.body.primaryContactName,
            primaryContactEmail: req.body.primaryContactEmail,
            primaryContactPhone: req.body.primaryContactPhone,
            notes: req.body.notes,
            externalSource: 'invoxai',
            externalSystem: 'invoxai',
            externalId,
            externalSyncedAt: req.body.externalSyncedAt
              ? new Date(req.body.externalSyncedAt)
              : new Date(),
            externalSyncStatus: req.body.externalSyncStatus ?? 'synced',
          })
          .returning();

        logIntegrationMutation(req, 'upsert', 'customers', created.id);
        return { statusCode: 201, body: created, resourceId: created.id };
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) throw error;
        const [raceWinner] = await db
          .select()
          .from(customersTable)
          .where(
            and(
              eq(customersTable.externalSource, 'invoxai'),
              eq(customersTable.externalId, externalId),
            ),
          );
        if (!raceWinner) throw error;

        const [updated] = await db
          .update(customersTable)
          .set({
            name: req.body.name,
            status: req.body.status,
            accountNumber: req.body.accountNumber,
            primaryContactName: req.body.primaryContactName,
            primaryContactEmail: req.body.primaryContactEmail,
            primaryContactPhone: req.body.primaryContactPhone,
            notes: req.body.notes,
            externalSyncedAt: req.body.externalSyncedAt ? new Date(req.body.externalSyncedAt) : new Date(),
            externalSyncStatus: req.body.externalSyncStatus ?? 'synced',
            updatedAt: new Date(),
          })
          .where(eq(customersTable.id, raceWinner.id))
          .returning();

        logIntegrationMutation(req, 'upsert', 'customers', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }
    });

    if (!result) return;
    res.status(result.statusCode).json(result.body);
  },
);

router.post(
  '/integrations/invoxai/sites/upsert',
  requireAuth,
  requireIntegrationAuth('integrations:create'),
  async (req, res): Promise<void> => {
    const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, [
      'externalId',
      'customerId',
      'siteName',
    ]);
    if (Object.keys(fieldErrors).length > 0) {
      sendBadRequest(res, 'Validation failed', fieldErrors);
      return;
    }

    const result = await handleIdempotentCreate(req, res, 'sites', async () => {
      const externalId = String(req.body.externalId);
      const [existing] = await db
        .select()
        .from(sitesTable)
        .where(and(eq(sitesTable.externalSource, 'invoxai'), eq(sitesTable.externalId, externalId)));

      const updateValues = {
        customerId: req.body.customerId,
        siteName: req.body.siteName,
        address1: req.body.address1,
        address2: req.body.address2,
        city: req.body.city,
        state: req.body.state,
        postalCode: req.body.postalCode,
        country: req.body.country,
        timezone: req.body.timezone,
        siteCode: req.body.siteCode,
        notes: req.body.notes,
        lconName: req.body.lconName,
        lconPhone: req.body.lconPhone,
        lconEmail: req.body.lconEmail,
        latitude: req.body.latitude,
        longitude: req.body.longitude,
        externalSyncedAt: req.body.externalSyncedAt ? new Date(req.body.externalSyncedAt) : new Date(),
        externalSyncStatus: req.body.externalSyncStatus ?? 'synced',
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db
          .update(sitesTable)
          .set(updateValues)
          .where(eq(sitesTable.id, existing.id))
          .returning();
        logIntegrationMutation(req, 'upsert', 'sites', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }

      try {
        const [created] = await db
          .insert(sitesTable)
          .values({
            ...updateValues,
            externalSource: 'invoxai',
            externalId,
          })
          .returning();
        logIntegrationMutation(req, 'upsert', 'sites', created.id);
        return { statusCode: 201, body: created, resourceId: created.id };
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) throw error;
        const [raceWinner] = await db
          .select()
          .from(sitesTable)
          .where(and(eq(sitesTable.externalSource, 'invoxai'), eq(sitesTable.externalId, externalId)));
        if (!raceWinner) throw error;

        const [updated] = await db
          .update(sitesTable)
          .set(updateValues)
          .where(eq(sitesTable.id, raceWinner.id))
          .returning();
        logIntegrationMutation(req, 'upsert', 'sites', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }
    });

    if (!result) return;
    res.status(result.statusCode).json(result.body);
  },
);

router.post(
  '/integrations/invoxai/services/upsert',
  requireAuth,
  requireIntegrationAuth('integrations:create'),
  async (req, res): Promise<void> => {
    const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, [
      'externalId',
      'customerId',
      'siteId',
      'vendorName',
      'serviceType',
      'status',
    ]);
    if (Object.keys(fieldErrors).length > 0) {
      sendBadRequest(res, 'Validation failed', fieldErrors);
      return;
    }

    const serviceType = normalizeServiceType(String(req.body.serviceType));
    if (!serviceType) {
      sendBadRequest(res, 'Validation failed', {
        serviceType: "Unsupported value. Allowed: DIA, SD-WAN, Voice, Other",
      });
      return;
    }

    const result = await handleIdempotentCreate(req, res, 'services', async () => {
      const externalId = String(req.body.externalId);
      const [existing] = await db
        .select()
        .from(servicesTable)
        .where(
          and(eq(servicesTable.externalSource, 'invoxai'), eq(servicesTable.externalId, externalId)),
        );

      const updateValues = {
        customerId: req.body.customerId,
        siteId: req.body.siteId,
        vendorName: req.body.vendorName,
        serviceType,
        circuitId: req.body.circuitId,
        bandwidth: req.body.bandwidth,
        status: req.body.status,
        installDate: req.body.installDate,
        monthlyRecurringCharge: req.body.monthlyRecurringCharge?.toString(),
        supportReference: req.body.supportReference,
        notes: req.body.notes,
        externalSyncedAt: req.body.externalSyncedAt ? new Date(req.body.externalSyncedAt) : new Date(),
        externalSyncStatus: req.body.externalSyncStatus ?? 'synced',
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db
          .update(servicesTable)
          .set(updateValues)
          .where(eq(servicesTable.id, existing.id))
          .returning();
        logIntegrationMutation(req, 'upsert', 'services', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }

      try {
        const [created] = await db
          .insert(servicesTable)
          .values({
            ...updateValues,
            externalSource: 'invoxai',
            externalId,
          })
          .returning();
        logIntegrationMutation(req, 'upsert', 'services', created.id);
        return { statusCode: 201, body: created, resourceId: created.id };
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) throw error;
        const [raceWinner] = await db
          .select()
          .from(servicesTable)
          .where(
            and(eq(servicesTable.externalSource, 'invoxai'), eq(servicesTable.externalId, externalId)),
          );
        if (!raceWinner) throw error;

        const [updated] = await db
          .update(servicesTable)
          .set(updateValues)
          .where(eq(servicesTable.id, raceWinner.id))
          .returning();
        logIntegrationMutation(req, 'upsert', 'services', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }
    });

    if (!result) return;
    res.status(result.statusCode).json(result.body);
  },
);

router.post(
  '/integrations/invoxai/tickets/upsert',
  requireAuth,
  requireIntegrationAuth('integrations:create'),
  async (req, res): Promise<void> => {
    const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, [
      'externalId',
      'customerId',
      'title',
      'source',
      'severity',
      'outageType',
    ]);
    if (Object.keys(fieldErrors).length > 0) {
      sendBadRequest(res, 'Validation failed', fieldErrors);
      return;
    }

    const result = await handleIdempotentCreate(req, res, 'tickets', async () => {
      const externalId = String(req.body.externalId);
      const [existing] = await db
        .select()
        .from(ticketsTable)
        .where(and(eq(ticketsTable.externalSource, 'invoxai'), eq(ticketsTable.externalId, externalId)));

      const baseValues = {
        customerId: req.body.customerId,
        siteId: req.body.siteId ?? null,
        serviceId: req.body.serviceId ?? null,
        title: req.body.title,
        description: req.body.description,
        source: req.body.source,
        severity: req.body.severity,
        status: req.body.status ?? 'new',
        outageType: req.body.outageType,
        vendorTicketId: req.body.vendorTicketId ?? null,
        impactLevel: req.body.impactLevel ?? null,
        urgencyLevel: req.body.urgencyLevel ?? null,
        externalSyncedAt: req.body.externalSyncedAt ? new Date(req.body.externalSyncedAt) : new Date(),
        externalSyncStatus: req.body.externalSyncStatus ?? 'synced',
        lastUpdatedAt: new Date(),
        updatedAt: new Date(),
      };

      if (existing) {
        const [updated] = await db
          .update(ticketsTable)
          .set(baseValues)
          .where(eq(ticketsTable.id, existing.id))
          .returning();
        logIntegrationMutation(req, 'upsert', 'tickets', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }

      const ticketNumber = `INV-${Date.now()}`;
      try {
        const [created] = await db
          .insert(ticketsTable)
          .values({
            ticketNumber,
            ...baseValues,
            externalSource: 'invoxai',
            externalId,
          })
          .returning();
        logIntegrationMutation(req, 'upsert', 'tickets', created.id);
        return { statusCode: 201, body: created, resourceId: created.id };
      } catch (error: unknown) {
        if (!isUniqueViolation(error)) throw error;
        const [raceWinner] = await db
          .select()
          .from(ticketsTable)
          .where(and(eq(ticketsTable.externalSource, 'invoxai'), eq(ticketsTable.externalId, externalId)));
        if (!raceWinner) throw error;

        const [updated] = await db
          .update(ticketsTable)
          .set(baseValues)
          .where(eq(ticketsTable.id, raceWinner.id))
          .returning();
        logIntegrationMutation(req, 'upsert', 'tickets', updated.id);
        return { statusCode: 200, body: updated, resourceId: updated.id };
      }
    });

    if (!result) return;
    res.status(result.statusCode).json(result.body);
  },
);

export default router;
