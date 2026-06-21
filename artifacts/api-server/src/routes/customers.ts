import { Router, type IRouter } from 'express';
import { db, customersTable, sitesTable, servicesTable, ticketsTable } from '@workspace/db';
import { eq, and, ilike, or, inArray } from 'drizzle-orm';
import { requireAuth, requireScope } from '../middlewares/auth';
import { sendBadRequest, sendForbidden } from '../lib/http';
import {
  getIntegrationExternalSource,
  handleIdempotentCreate,
  logIntegrationMutation,
  validateRequiredFields,
} from '../lib/integration';

const router: IRouter = Router();

router.get('/customers', requireAuth, async (req, res): Promise<void> => {
  const { search, status, externalSource, externalId, compact } = req.query as {
    search?: string;
    status?: string;
    externalSource?: string;
    externalId?: string;
    compact?: string;
  };

  let query = db.select().from(customersTable).$dynamic();
  const conditions = [];

  if (req.user?.role === 'customer' && req.user.customerId) {
    conditions.push(eq(customersTable.id, req.user.customerId));
  } else if (req.user?.role === 'telecom_services_partner') {
    const pIds = req.partnerCustomerIds ?? [];
    if (pIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(customersTable.id, pIds));
  }
  if (search) {
    conditions.push(
      or(
        ilike(customersTable.name, `%${search}%`),
        ilike(customersTable.accountNumber, `%${search}%`),
      ),
    );
  }
  if (status) {
    conditions.push(eq(customersTable.status, status as 'active' | 'inactive'));
  }
  if (externalSource) {
    conditions.push(eq(customersTable.externalSource, externalSource));
  }
  if (externalId) {
    conditions.push(eq(customersTable.externalId, externalId));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const customers = await query.orderBy(customersTable.name);
  if (compact === 'true' && req.integration) {
    res.json(
      customers.map((customer: typeof customersTable.$inferSelect) => ({
        id: customer.id,
        name: customer.name,
        status: customer.status,
        externalSource: customer.externalSource,
        externalId: customer.externalId,
      })),
    );
    return;
  }

  const isPartner = req.user?.role === 'telecom_services_partner';
  res.json(
    isPartner
      ? customers.map(({ notes: _notes, ...rest }: typeof customersTable.$inferSelect) => rest)
      : customers,
  );
});

router.post('/customers', requireAuth, requireScope('integrations:create'), async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    sendForbidden(res);
    return;
  }

  const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, ['name', 'status']);
  if (Object.keys(fieldErrors).length > 0) {
    sendBadRequest(res, 'Validation failed', fieldErrors);
    return;
  }

  const {
    name,
    accountNumber,
    status,
    primaryContactName,
    primaryContactEmail,
    primaryContactPhone,
    notes,
    externalSource,
    externalId,
    externalSyncedAt,
    externalSyncStatus,
  } = req.body as Record<string, string | null | undefined>;

  if (status !== 'active' && status !== 'inactive') {
    sendBadRequest(res, 'Validation failed', {
      status: "Unsupported value. Allowed: 'active', 'inactive'",
    });
    return;
  }

  const result = await handleIdempotentCreate(req, res, 'customers', async () => {
    const source = externalSource ?? getIntegrationExternalSource(req);
    const [customer] = await db
      .insert(customersTable)
      .values({
        name: name!,
        accountNumber,
        status,
        primaryContactName,
        primaryContactEmail,
        primaryContactPhone,
        notes,
        externalSource: source,
        externalSystem: source,
        externalId,
        externalSyncedAt: externalSyncedAt ? new Date(externalSyncedAt) : undefined,
        externalSyncStatus,
      })
      .returning();

    logIntegrationMutation(req, 'create', 'customers', customer.id);

    return {
      statusCode: 201,
      body: customer,
      resourceId: customer.id,
    };
  });

  if (!result) return;
  res.status(result.statusCode).json(result.body);
});

router.get('/customers/:id', requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  if (req.user?.role === 'customer' && req.user.customerId !== id) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (
    req.user?.role === 'telecom_services_partner' &&
    !(req.partnerCustomerIds ?? []).includes(id)
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
  if (!customer) {
    res.status(404).json({ error: 'Not Found', message: 'Customer not found' });
    return;
  }

  const [sites, services, tickets] = await Promise.all([
    db.select().from(sitesTable).where(eq(sitesTable.customerId, id)),
    db.select().from(servicesTable).where(eq(servicesTable.customerId, id)),
    db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.customerId, id))
      .orderBy(ticketsTable.openedAt),
  ]);

  const isPartner = req.user?.role === 'telecom_services_partner';
  const { notes: _notes, ...customerPublic } = customer;
  res.json(
    isPartner
      ? { ...customerPublic, sites, services, tickets }
      : { ...customer, sites, services, tickets },
  );
});

router.put('/customers/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    sendForbidden(res);
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const {
    name,
    accountNumber,
    status,
    primaryContactName,
    primaryContactEmail,
    primaryContactPhone,
    notes,
    telecomServicesPartnerId,
  } = req.body;

  const updateData: Record<string, unknown> = {
    name,
    accountNumber,
    status,
    primaryContactName,
    primaryContactEmail,
    primaryContactPhone,
    notes,
    updatedAt: new Date(),
  };
  if (telecomServicesPartnerId !== undefined) {
    updateData.telecomServicesPartnerId = telecomServicesPartnerId || null;
  }

  const [customer] = await db
    .update(customersTable)
    .set(updateData as any)
    .where(eq(customersTable.id, id))
    .returning();

  if (!customer) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json(customer);
});

router.delete('/customers/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [customer] = await db.delete(customersTable).where(eq(customersTable.id, id)).returning();
  if (!customer) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json({ success: true, message: 'Customer deleted' });
});

export default router;
