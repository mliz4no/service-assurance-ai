import { Router, type IRouter, type Request, type Response } from 'express';
import { db, dnsCandidatesTable } from '@workspace/db';
import { desc, eq } from 'drizzle-orm';
import { requireAuth } from '../middlewares/auth';
import { sendBadRequest, sendForbidden } from '../lib/http';
import { importCuratedPublicDns, markDnsCandidateStatus, promoteDnsCandidate, validateDnsCandidate } from '../lib/dns-discovery';

const router: IRouter = Router();

function requireInternalUser(req: Request, res: Response): boolean {
  if (!req.user || !['admin', 'ops'].includes(req.user.role)) {
    sendForbidden(res);
    return false;
  }
  return true;
}

router.get('/monitoring/dns-candidates', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  const candidates = await db
    .select()
    .from(dnsCandidatesTable)
    .where(status ? eq(dnsCandidatesTable.status, status as 'pending') : undefined)
    .orderBy(desc(dnsCandidatesTable.createdAt));
  res.json(candidates);
});

router.post('/monitoring/dns-candidates/import-curated', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const candidates = await importCuratedPublicDns();
  res.json({ imported: candidates.length, candidates });
});

router.post('/monitoring/dns-candidates/:id/status', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const status = req.body?.status;
  if (!['pending', 'validated', 'rejected'].includes(status)) {
    sendBadRequest(res, 'Validation failed', { status: 'Must be pending, validated, or rejected' });
    return;
  }
  const updated = await markDnsCandidateStatus(req.params.id as string, status, req.body?.validationMessage);
  if (!updated) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json(updated);
});

router.post('/monitoring/dns-candidates/:id/validate', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const candidate = await validateDnsCandidate(req.params.id as string);
  if (!candidate) {
    res.status(404).json({ error: 'Not Found' });
    return;
  }
  res.json(candidate);
});

router.post('/monitoring/dns-candidates/:id/promote', requireAuth, async (req, res): Promise<void> => {
  if (!requireInternalUser(req, res)) return;
  const promoted = await promoteDnsCandidate(req.params.id as string);
  if (!promoted) {
    sendBadRequest(res, 'Candidate must be validated before promotion');
    return;
  }
  res.json(promoted);
});

export default router;