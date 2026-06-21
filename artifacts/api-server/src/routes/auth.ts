import { Router, type IRouter } from 'express';
import { db, usersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { hashPassword, verifyPassword, generateToken } from '../lib/auth';
import { createSession, deleteSession, getUserFromToken } from '../lib/session-store';
import { requireAuth } from '../middlewares/auth';

const router: IRouter = Router();

router.post('/auth/login', async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Bad Request', message: 'Email and password required' });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    return;
  }

  const valid = verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid credentials' });
    return;
  }

  const token = generateToken();
  createSession(token, user.id);

  const { passwordHash: _, ...safeUser } = user;
  res.json({ user: safeUser, token });
});

router.post('/auth/logout', requireAuth, async (req, res): Promise<void> => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) deleteSession(token);
  res.json({ success: true, message: 'Logged out' });
});

router.get('/auth/me', requireAuth, async (req, res): Promise<void> => {
  const { passwordHash: _, ...safeUser } = req.user!;
  res.json(safeUser);
});

export default router;
