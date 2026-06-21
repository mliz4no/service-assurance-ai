import { Router, type IRouter } from 'express';
import { db, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '../middlewares/auth';
import { hashPassword } from '../lib/auth';

const router: IRouter = Router();

router.get('/users', requireAuth, requireRole('admin', 'ops'), async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      customerId: usersTable.customerId,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    })
    .from(usersTable)
    .orderBy(usersTable.name);
  res.json(users);
});

router.post('/users', requireAuth, requireRole('admin'), async (req, res): Promise<void> => {
  const { name, email, password, role, customerId, telecomServicesPartnerId } = req.body;
  if (!name || !email || !password || !role) {
    res
      .status(400)
      .json({ error: 'Bad Request', message: 'name, email, password, and role required' });
    return;
  }

  const passwordHash = hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      email,
      passwordHash,
      role,
      customerId: customerId || null,
      telecomServicesPartnerId: telecomServicesPartnerId || null,
    })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      role: usersTable.role,
      customerId: usersTable.customerId,
      createdAt: usersTable.createdAt,
      updatedAt: usersTable.updatedAt,
    });

  res.status(201).json(user);
});

router.put('/users/:id', requireAuth, requireRole('admin'), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { name, email, password, role, customerId, telecomServicesPartnerId } = req.body;

  const updates: Record<string, unknown> = {
    name,
    email,
    role,
    customerId: customerId || null,
    telecomServicesPartnerId: telecomServicesPartnerId || null,
    updatedAt: new Date(),
  };
  if (password) {
    updates.passwordHash = hashPassword(password);
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({
    id: usersTable.id,
    name: usersTable.name,
    email: usersTable.email,
    role: usersTable.role,
    customerId: usersTable.customerId,
    createdAt: usersTable.createdAt,
    updatedAt: usersTable.updatedAt,
  });

  if (!user) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json(user);
});

router.delete('/users/:id', requireAuth, requireRole('admin'), async (req, res): Promise<void> => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const [user] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json({ success: true, message: 'User deleted' });
});

export default router;
