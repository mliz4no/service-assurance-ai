import { Router, type IRouter } from 'express';
import { db, servicesTable, customersTable, sitesTable, ticketsTable } from '@workspace/db';
import { eq, and, ilike, or, inArray } from 'drizzle-orm';
import { requireAuth, requireScope } from '../middlewares/auth';
import { sendBadRequest, sendForbidden } from '../lib/http';
import {
  getIntegrationExternalSource,
  handleIdempotentCreate,
  logIntegrationMutation,
  normalizeServiceType,
  validateRequiredFields,
} from '../lib/integration';

const router: IRouter = Router();

router.get('/services', requireAuth, async (req, res): Promise<void> => {
  const { customerId, siteId, search, status, vendorName, externalSource, externalId, compact } =
    req.query as Record<string, string>;
  const conditions = [];

  if (req.user?.role === 'customer' && req.user.customerId) {
    conditions.push(eq(servicesTable.customerId, req.user.customerId));
  } else if (req.user?.role === 'telecom_services_partner') {
    const pIds = req.partnerCustomerIds ?? [];
    if (pIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(servicesTable.customerId, pIds));
  } else if (customerId) {
    conditions.push(eq(servicesTable.customerId, customerId));
  }

  if (siteId) conditions.push(eq(servicesTable.siteId, siteId));
  if (status)
    conditions.push(
      eq(
        servicesTable.status,
        status as 'active' | 'pending' | 'down' | 'impaired' | 'disconnected',
      ),
    );
  if (vendorName) conditions.push(ilike(servicesTable.vendorName, `%${vendorName}%`));
  if (search) {
    conditions.push(
      or(
        ilike(servicesTable.circuitId, `%${search}%`),
        ilike(servicesTable.vendorName, `%${search}%`),
      ),
    );
  }
  if (externalSource) {
    conditions.push(eq(servicesTable.externalSource, externalSource));
  }
  if (externalId) {
    conditions.push(eq(servicesTable.externalId, externalId));
  }

  const services = await db
    .select({
      id: servicesTable.id,
      customerId: servicesTable.customerId,
      siteId: servicesTable.siteId,
      vendorName: servicesTable.vendorName,
      serviceType: servicesTable.serviceType,
      circuitId: servicesTable.circuitId,
      bandwidth: servicesTable.bandwidth,
      status: servicesTable.status,
      installDate: servicesTable.installDate,
      monthlyRecurringCharge: servicesTable.monthlyRecurringCharge,
      supportReference: servicesTable.supportReference,
      notes: servicesTable.notes,
      externalSource: servicesTable.externalSource,
      externalId: servicesTable.externalId,
      externalSyncedAt: servicesTable.externalSyncedAt,
      externalSyncStatus: servicesTable.externalSyncStatus,
      createdAt: servicesTable.createdAt,
      updatedAt: servicesTable.updatedAt,
      customer: {
        id: customersTable.id,
        name: customersTable.name,
        accountNumber: customersTable.accountNumber,
        status: customersTable.status,
        primaryContactName: customersTable.primaryContactName,
        primaryContactEmail: customersTable.primaryContactEmail,
        primaryContactPhone: customersTable.primaryContactPhone,
        notes: customersTable.notes,
        createdAt: customersTable.createdAt,
        updatedAt: customersTable.updatedAt,
      },
      site: {
        id: sitesTable.id,
        customerId: sitesTable.customerId,
        siteName: sitesTable.siteName,
        address1: sitesTable.address1,
        address2: sitesTable.address2,
        city: sitesTable.city,
        state: sitesTable.state,
        postalCode: sitesTable.postalCode,
        country: sitesTable.country,
        timezone: sitesTable.timezone,
        siteCode: sitesTable.siteCode,
        notes: sitesTable.notes,
        createdAt: sitesTable.createdAt,
        updatedAt: sitesTable.updatedAt,
      },
    })
    .from(servicesTable)
    .leftJoin(customersTable, eq(servicesTable.customerId, customersTable.id))
    .leftJoin(sitesTable, eq(servicesTable.siteId, sitesTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(servicesTable.vendorName);

  if (compact === 'true' && req.integration) {
    res.json(
      services.map((service: (typeof services)[number]) => ({
        id: service.id,
        customerId: service.customerId,
        siteId: service.siteId,
        vendorName: service.vendorName,
        serviceType: service.serviceType,
        status: service.status,
        externalSource: service.externalSource,
        externalId: service.externalId,
      })),
    );
    return;
  }

  res.json(services);
});

router.post('/services', requireAuth, requireScope('integrations:create'), async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    sendForbidden(res);
    return;
  }

  const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, [
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

  const {
    customerId,
    siteId,
    vendorName,
    serviceType,
    circuitId,
    bandwidth,
    status,
    installDate,
    monthlyRecurringCharge,
    supportReference,
    notes,
    externalSource,
    externalId,
    externalSyncedAt,
    externalSyncStatus,
  } = req.body as Record<string, string | number | null | undefined>;

  const mappedServiceType = normalizeServiceType(serviceType as string);
  if (!mappedServiceType) {
    sendBadRequest(res, 'Validation failed', {
      serviceType: "Unsupported value. Allowed: DIA, SD-WAN, Voice, Other",
    });
    return;
  }

  const allowedStatuses = ['active', 'pending', 'down', 'impaired', 'disconnected'];
  if (!allowedStatuses.includes(status as string)) {
    sendBadRequest(res, 'Validation failed', {
      status: `Unsupported value. Allowed: ${allowedStatuses.join(', ')}`,
    });
    return;
  }

  const result = await handleIdempotentCreate(req, res, 'services', async () => {
    const [service] = await db
      .insert(servicesTable)
      .values({
        customerId: customerId as string,
        siteId: siteId as string,
        vendorName: vendorName as string,
        serviceType: mappedServiceType as
          | 'DIA'
          | 'Broadband'
          | 'SD-WAN'
          | 'Voice'
          | 'Wireless'
          | 'Other',
        circuitId: circuitId as string | undefined,
        bandwidth: bandwidth as string | undefined,
        status: status as 'active' | 'pending' | 'down' | 'impaired' | 'disconnected',
        installDate: installDate as string | undefined,
        monthlyRecurringCharge: monthlyRecurringCharge?.toString(),
        supportReference: supportReference as string | undefined,
        notes: notes as string | undefined,
        externalSource: (externalSource as string | undefined) ?? getIntegrationExternalSource(req),
        externalId: externalId as string | undefined,
        externalSyncedAt: externalSyncedAt ? new Date(externalSyncedAt as string) : undefined,
        externalSyncStatus: externalSyncStatus as string | undefined,
      })
      .returning();

    logIntegrationMutation(req, 'create', 'services', service.id);

    return {
      statusCode: 201,
      body: service,
      resourceId: service.id,
    };
  });

  if (!result) return;
  res.status(result.statusCode).json(result.body);
});

router.get('/services/:id', requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, id));
  if (!service) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  if (req.user?.role === 'customer' && req.user.customerId !== service.customerId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (
    req.user?.role === 'telecom_services_partner' &&
    !(req.partnerCustomerIds ?? []).includes(service.customerId)
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, service.customerId));
  const [site] = service.siteId
    ? await db.select().from(sitesTable).where(eq(sitesTable.id, service.siteId))
    : [null];
  const tickets = await db
    .select({
      id: ticketsTable.id,
      ticketNumber: ticketsTable.ticketNumber,
      title: ticketsTable.title,
      status: ticketsTable.status,
      severity: ticketsTable.severity,
      openedAt: ticketsTable.openedAt,
      nextEscalationAt: ticketsTable.nextEscalationAt,
    })
    .from(ticketsTable)
    .where(eq(ticketsTable.serviceId, id))
    .orderBy(ticketsTable.openedAt);

  res.json({ ...service, customer, site, tickets });
});

router.put('/services/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    sendForbidden(res);
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const {
    vendorName,
    serviceType,
    circuitId,
    bandwidth,
    status,
    installDate,
    monthlyRecurringCharge,
    supportReference,
    notes,
    impactLevel,
  } = req.body;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (vendorName !== undefined) updateData.vendorName = vendorName;
  if (serviceType !== undefined) updateData.serviceType = serviceType;
  if (circuitId !== undefined) updateData.circuitId = circuitId;
  if (bandwidth !== undefined) updateData.bandwidth = bandwidth;
  if (status !== undefined) updateData.status = status;
  if (installDate !== undefined) updateData.installDate = installDate;
  if (monthlyRecurringCharge !== undefined)
    updateData.monthlyRecurringCharge = monthlyRecurringCharge?.toString();
  if (supportReference !== undefined) updateData.supportReference = supportReference;
  if (notes !== undefined) updateData.notes = notes;
  if (impactLevel !== undefined) updateData.impactLevel = impactLevel === '' ? null : impactLevel;

  const [service] = await db
    .update(servicesTable)
    .set(updateData as any)
    .where(eq(servicesTable.id, id))
    .returning();

  if (!service) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json(service);
});

router.delete('/services/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [service] = await db.delete(servicesTable).where(eq(servicesTable.id, id)).returning();
  if (!service) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json({ success: true, message: 'Service deleted' });
});

export default router;
