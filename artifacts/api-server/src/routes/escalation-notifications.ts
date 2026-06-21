import { Router, type IRouter } from 'express';
import { db, escalationNotificationsTable, ticketsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { evaluateEscalation } from '../lib/notificationEngine';

const router: IRouter = Router();

router.get('/tickets/:id/notifications', requireAuth, async (req, res): Promise<void> => {
  const ticketId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const notifications = await db
    .select()
    .from(escalationNotificationsTable)
    .where(eq(escalationNotificationsTable.ticketId, ticketId))
    .orderBy(escalationNotificationsTable.notifiedAt);

  res.json(notifications);
});

router.post('/tickets/:id/evaluate-escalation', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const ticketId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [ticket] = await db.select().from(ticketsTable).where(eq(ticketsTable.id, ticketId));
  if (!ticket) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }

  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    res.json({
      notified: 0,
      contacts: [],
      message: 'Ticket is resolved/closed — no escalation needed',
    });
    return;
  }

  const result = await evaluateEscalation(ticket, req.user?.name ?? 'system');
  res.json(result);
});

export default router;
