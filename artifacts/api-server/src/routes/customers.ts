import { Router, type IRouter } from 'express';
import { db, customersTable, sitesTable, servicesTable, ticketsTable } from '@workspace/db';
import { eq, and, ilike, or, inArray } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';

const router: IRouter = Router();

router.get('/customers', requireAuth, async (req, res): Promise<void> => {
  const { search, status } = req.query as { search?: string; status?: string };

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

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const customers = await query.orderBy(customersTable.name);
  const isPartner = req.user?.role === 'telecom_services_partner';
  res.json(isPartner ? customers.map(({ notes: _notes, ...rest }) => rest) : customers);
});

router.post('/customers', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer' || req.user?.role === 'telecom_services_partner') {
    res.status(403).json({ error: 'Forbidden' });
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
  } = req.body;
  if (!name || !status) {
    res.status(400).json({ error: 'Bad Request', message: 'name and status are required' });
    return;
  }

  const [customer] = await db
    .insert(customersTable)
    .values({
      name,
      accountNumber,
      status,
      primaryContactName,
      primaryContactEmail,
      primaryContactPhone,
      notes,
    })
    .returning();
  res.status(201).json(customer);
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
    res.status(403).json({ error: 'Forbidden' });
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
