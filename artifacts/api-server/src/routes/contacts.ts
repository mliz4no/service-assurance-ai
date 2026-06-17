import { Router, type IRouter } from 'express';
import { db, customerContactsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { getStringParam } from '../lib/params';

const router: IRouter = Router();

router.get('/customers/:customerId/contacts', requireAuth, async (req, res): Promise<void> => {
  const customerId = getStringParam(req.params.customerId, 'customerId');

  if (req.user?.role === 'customer' && req.user.customerId !== customerId) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const contacts = await db
    .select()
    .from(customerContactsTable)
    .where(eq(customerContactsTable.customerId, customerId))
    .orderBy(customerContactsTable.role, customerContactsTable.name);

  res.json(contacts);
});

router.post('/customers/:customerId/contacts', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { customerId } = req.params;
  const {
    name,
    email,
    phone,
    role,
    notifyOnSeverity,
    notifyOnDurationMinutes,
    notificationChannels,
  } = req.body;

  if (!name || !email || !role || !notifyOnSeverity) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'name, email, role, and notifyOnSeverity are required',
    });
    return;
  }

  const [contact] = await db
    .insert(customerContactsTable)
    .values({
      customerId,
      name,
      email,
      phone: phone || null,
      role,
      notifyOnSeverity,
      notifyOnDurationMinutes: notifyOnDurationMinutes || null,
      notificationChannels: notificationChannels || 'email',
    })
    .returning();

  res.status(201).json(contact);
});

router.put(
  '/customers/:customerId/contacts/:contactId',
  requireAuth,
  async (req, res): Promise<void> => {
    if (req.user?.role === 'customer') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const contactId = getStringParam(req.params.contactId, 'contactId');
    const {
      name,
      email,
      phone,
      role,
      notifyOnSeverity,
      notifyOnDurationMinutes,
      notificationChannels,
    } = req.body;

    const [contact] = await db
      .update(customerContactsTable)
      .set({
        name,
        email,
        phone: phone || null,
        role,
        notifyOnSeverity,
        notifyOnDurationMinutes: notifyOnDurationMinutes ?? null,
        notificationChannels: notificationChannels || 'email',
        updatedAt: new Date(),
      })
      .where(eq(customerContactsTable.id, contactId))
      .returning();

    if (!contact) {
      res.status(404).json({ error: 'Not Found' });
      return;
    }

    res.json(contact);
  },
);

router.delete(
  '/customers/:customerId/contacts/:contactId',
  requireAuth,
  async (req, res): Promise<void> => {
    if (req.user?.role === 'customer') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const contactId = getStringParam(req.params.contactId, 'contactId');
    await db.delete(customerContactsTable).where(eq(customerContactsTable.id, contactId));
    res.json({ success: true });
  },
);

export default router;
