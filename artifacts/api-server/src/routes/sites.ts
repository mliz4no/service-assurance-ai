import { Router, type IRouter } from 'express';
import { db, sitesTable, customersTable, servicesTable, ticketsTable } from '@workspace/db';
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

router.get('/sites', requireAuth, async (req, res): Promise<void> => {
  const { customerId, search, externalSource, externalId, compact } = req.query as {
    customerId?: string;
    search?: string;
    externalSource?: string;
    externalId?: string;
    compact?: string;
  };
  const conditions = [];

  if (req.user?.role === 'customer' && req.user.customerId) {
    conditions.push(eq(sitesTable.customerId, req.user.customerId));
  } else if (req.user?.role === 'telecom_services_partner') {
    const pIds = req.partnerCustomerIds ?? [];
    if (pIds.length === 0) {
      res.json([]);
      return;
    }
    conditions.push(inArray(sitesTable.customerId, pIds));
  } else if (customerId) {
    conditions.push(eq(sitesTable.customerId, customerId));
  }

  if (search) {
    conditions.push(
      or(ilike(sitesTable.siteName, `%${search}%`), ilike(sitesTable.siteCode, `%${search}%`)),
    );
  }
  if (externalSource) {
    conditions.push(eq(sitesTable.externalSource, externalSource));
  }
  if (externalId) {
    conditions.push(eq(sitesTable.externalId, externalId));
  }

  const sites = await db
    .select({
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
      lconName: sitesTable.lconName,
      lconPhone: sitesTable.lconPhone,
      lconEmail: sitesTable.lconEmail,
      latitude: sitesTable.latitude,
      longitude: sitesTable.longitude,
      geoSource: sitesTable.geoSource,
      externalSource: sitesTable.externalSource,
      externalId: sitesTable.externalId,
      externalSyncedAt: sitesTable.externalSyncedAt,
      externalSyncStatus: sitesTable.externalSyncStatus,
      createdAt: sitesTable.createdAt,
      updatedAt: sitesTable.updatedAt,
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
    })
    .from(sitesTable)
    .leftJoin(customersTable, eq(sitesTable.customerId, customersTable.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(sitesTable.siteName);

  if (compact === 'true' && req.integration) {
    res.json(
      sites.map((site: (typeof sites)[number]) => ({
        id: site.id,
        customerId: site.customerId,
        siteName: site.siteName,
        externalSource: site.externalSource,
        externalId: site.externalId,
      })),
    );
    return;
  }

  res.json(sites);
});

router.post('/sites', requireAuth, requireScope('integrations:create'), async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    sendForbidden(res);
    return;
  }

  const fieldErrors = validateRequiredFields(req.body as Record<string, unknown>, [
    'customerId',
    'siteName',
  ]);
  if (Object.keys(fieldErrors).length > 0) {
    sendBadRequest(res, 'Validation failed', fieldErrors);
    return;
  }

  const {
    customerId,
    siteName,
    address1,
    address2,
    city,
    state,
    postalCode,
    country,
    timezone,
    siteCode,
    notes,
    lconName,
    lconPhone,
    lconEmail,
    latitude,
    longitude,
    geoSource,
    externalSource,
    externalId,
    externalSyncedAt,
    externalSyncStatus,
  } = req.body as Record<string, string | number | null | undefined>;

  const result = await handleIdempotentCreate(req, res, 'sites', async () => {
    const [site] = await db
      .insert(sitesTable)
      .values({
        customerId: customerId as string,
        siteName: siteName as string,
        address1: address1 as string | undefined,
        address2: address2 as string | undefined,
        city: city as string | undefined,
        state: state as string | undefined,
        postalCode: postalCode as string | undefined,
        country: country as string | undefined,
        timezone: timezone as string | undefined,
        siteCode: siteCode as string | undefined,
        notes: notes as string | undefined,
        lconName: lconName as string | undefined,
        lconPhone: lconPhone as string | undefined,
        lconEmail: lconEmail as string | undefined,
        latitude: latitude as number | undefined,
        longitude: longitude as number | undefined,
        geoSource: geoSource as 'manual' | 'geocoded' | 'imported' | undefined,
        externalSource: (externalSource as string | undefined) ?? getIntegrationExternalSource(req),
        externalId: externalId as string | undefined,
        externalSyncedAt: externalSyncedAt ? new Date(externalSyncedAt as string) : undefined,
        externalSyncStatus: externalSyncStatus as string | undefined,
      })
      .returning();

    logIntegrationMutation(req, 'create', 'sites', site.id);

    return {
      statusCode: 201,
      body: site,
      resourceId: site.id,
    };
  });

  if (!result) return;
  res.status(result.statusCode).json(result.body);
});

router.get('/sites/:id', requireAuth, async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [site] = await db.select().from(sitesTable).where(eq(sitesTable.id, id));
  if (!site) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  if (req.user?.role === 'customer' && req.user.customerId !== site.customerId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  if (
    req.user?.role === 'telecom_services_partner' &&
    !(req.partnerCustomerIds ?? []).includes(site.customerId)
  ) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, site.customerId));
  const [services, tickets] = await Promise.all([
    db.select().from(servicesTable).where(eq(servicesTable.siteId, id)),
    db
      .select()
      .from(ticketsTable)
      .where(eq(ticketsTable.siteId, id))
      .orderBy(ticketsTable.openedAt),
  ]);

  res.json({ ...site, customer, services, tickets });
});

router.put('/sites/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    sendForbidden(res);
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const {
    siteName,
    address1,
    address2,
    city,
    state,
    postalCode,
    country,
    timezone,
    siteCode,
    notes,
    lconName,
    lconPhone,
    lconEmail,
    latitude,
    longitude,
    geoSource,
    impactLevel,
    urgencyLevel,
  } = req.body;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (siteName !== undefined) updateData.siteName = siteName;
  if (address1 !== undefined) updateData.address1 = address1;
  if (address2 !== undefined) updateData.address2 = address2;
  if (city !== undefined) updateData.city = city;
  if (state !== undefined) updateData.state = state;
  if (postalCode !== undefined) updateData.postalCode = postalCode;
  if (country !== undefined) updateData.country = country;
  if (timezone !== undefined) updateData.timezone = timezone;
  if (siteCode !== undefined) updateData.siteCode = siteCode;
  if (notes !== undefined) updateData.notes = notes;
  if (lconName !== undefined) updateData.lconName = lconName;
  if (lconPhone !== undefined) updateData.lconPhone = lconPhone;
  if (lconEmail !== undefined) updateData.lconEmail = lconEmail;
  if (latitude !== undefined) updateData.latitude = latitude;
  if (longitude !== undefined) updateData.longitude = longitude;
  if (geoSource !== undefined) updateData.geoSource = geoSource;
  if (impactLevel !== undefined) updateData.impactLevel = impactLevel === '' ? null : impactLevel;
  if (urgencyLevel !== undefined)
    updateData.urgencyLevel = urgencyLevel === '' ? null : urgencyLevel;

  const [site] = await db
    .update(sitesTable)
    .set(updateData as any)
    .where(eq(sitesTable.id, id))
    .returning();

  if (!site) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json(site);
});

router.delete('/sites/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [site] = await db.delete(sitesTable).where(eq(sitesTable.id, id)).returning();
  if (!site) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json({ success: true, message: 'Site deleted' });
});

export default router;
