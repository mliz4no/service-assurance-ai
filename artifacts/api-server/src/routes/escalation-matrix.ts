import { Router, type IRouter } from 'express';
import { requireAuth } from '../middlewares/auth';
import {
  getEffectiveMatrixForScope,
  upsertMatrixOverrides,
  type MatrixScopeType,
} from '../lib/matrixResolver';
import { db, escalationMatrixOverridesTable } from '@workspace/db';
import { eq } from 'drizzle-orm';

const router: IRouter = Router();

const VALID_SCOPE_TYPES: MatrixScopeType[] = ['global', 'customer', 'site', 'service'];

router.get('/escalation-matrix', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { scopeType, scopeId } = req.query as { scopeType?: string; scopeId?: string };

  const effectiveScopeType = (scopeType as MatrixScopeType) ?? 'global';

  if (!VALID_SCOPE_TYPES.includes(effectiveScopeType)) {
    res
      .status(400)
      .json({ error: 'Invalid scopeType. Must be global, customer, site, or service.' });
    return;
  }

  if (effectiveScopeType !== 'global' && !scopeId) {
    res.status(400).json({ error: 'scopeId is required for non-global scopes.' });
    return;
  }

  const cells = await getEffectiveMatrixForScope(effectiveScopeType, scopeId ?? null);
  res.json({ scopeType: effectiveScopeType, scopeId: scopeId ?? null, cells });
});

router.put('/escalation-matrix', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { scopeType, scopeId, cells } = req.body as {
    scopeType?: string;
    scopeId?: string | null;
    cells?: Array<{ impactLevel: string; urgencyLevel: string; derivedSeverity: string }>;
  };

  if (!scopeType || !VALID_SCOPE_TYPES.includes(scopeType as MatrixScopeType)) {
    res.status(400).json({ error: 'Invalid or missing scopeType.' });
    return;
  }

  if (scopeType !== 'global' && !scopeId) {
    res.status(400).json({ error: 'scopeId is required for non-global scopes.' });
    return;
  }

  if (!Array.isArray(cells) || cells.length === 0) {
    res.status(400).json({ error: 'cells array is required.' });
    return;
  }

  await upsertMatrixOverrides(scopeType as MatrixScopeType, scopeId ?? null, cells, req.user?.id);

  const updatedCells = await getEffectiveMatrixForScope(
    scopeType as MatrixScopeType,
    scopeId ?? null,
  );

  res.json({ scopeType, scopeId: scopeId ?? null, cells: updatedCells });
});

router.delete('/escalation-matrix/override/:id', requireAuth, async (req, res): Promise<void> => {
  if (req.user?.role === 'customer') {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const { id } = req.params;

  const [row] = await db
    .select({ id: escalationMatrixOverridesTable.id })
    .from(escalationMatrixOverridesTable)
    .where(eq(escalationMatrixOverridesTable.id, id));

  if (!row) {
    res.status(404).json({ error: 'Override not found.' });
    return;
  }

  await db.delete(escalationMatrixOverridesTable).where(eq(escalationMatrixOverridesTable.id, id));

  res.json({ success: true });
});

export default router;
