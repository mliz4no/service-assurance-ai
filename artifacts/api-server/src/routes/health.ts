import { Router, type IRouter } from 'express';
import { HealthCheckResponse } from '@workspace/api-zod';
import { db } from '@workspace/db';
import { sql } from 'drizzle-orm';

const router: IRouter = Router();

router.get('/healthz', (_req, res) => {
  const data = HealthCheckResponse.parse({ status: 'ok' });
  res.json(data);
});

router.get('/readyz', async (_req, res): Promise<void> => {
  try {
    await db.execute(sql`select 1`);
    res.json({ status: 'ready', checks: { database: 'ok' } });
  } catch {
    res.status(503).json({ status: 'not_ready', checks: { database: 'unavailable' } });
  }
});

export default router;
