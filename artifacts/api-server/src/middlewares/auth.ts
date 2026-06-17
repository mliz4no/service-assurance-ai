import type { Request, Response, NextFunction } from 'express';
import { getUserFromToken } from '../lib/session-store';
import { db, customersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import type { User } from '@workspace/db';

declare global {
  namespace Express {
    interface Request {
      user?: User;
      partnerCustomerIds?: string[];
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    return;
  }

  req.user = user;

  if (user.role === 'telecom_services_partner' && user.telecomServicesPartnerId) {
    const rows = await db
      .select({ id: customersTable.id })
      .from(customersTable)
      .where(eq(customersTable.telecomServicesPartnerId, user.telecomServicesPartnerId));
    req.partnerCustomerIds = rows.map((r: typeof customersTable.$inferSelect) => r.id);
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
