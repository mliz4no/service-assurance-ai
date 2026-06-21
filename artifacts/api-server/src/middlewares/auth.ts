import type { Request, Response, NextFunction } from 'express';
import { getUserFromToken } from '../lib/session-store';
import { db, customersTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import type { User } from '@workspace/db';
import crypto from 'crypto';
import { sendForbidden, sendUnauthorized } from '../lib/http';

type IntegrationScope = 'integrations:create' | 'integrations:read';

type IntegrationPrincipal = {
  source: 'invoxai';
  scopes: IntegrationScope[];
};

function parseScopes(raw: string | undefined): IntegrationScope[] {
  const defaultScopes: IntegrationScope[] = ['integrations:create', 'integrations:read'];
  if (!raw?.trim()) return defaultScopes;

  const requested = raw
    .split(',')
    .map((scope) => scope.trim())
    .filter(Boolean);

  const allowed = new Set<IntegrationScope>(defaultScopes);
  const valid = requested.filter((scope): scope is IntegrationScope =>
    allowed.has(scope as IntegrationScope),
  );

  return valid.length > 0 ? valid : defaultScopes;
}

function getInvoxaiApiKeys(): string[] {
  const fromList = process.env.INVOXAI_API_KEYS?.split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  const fromSingle = process.env.INVOXAI_API_KEY?.trim();

  return [...(fromList ?? []), ...(fromSingle ? [fromSingle] : [])];
}

function timingSafeEquals(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function resolveIntegrationPrincipal(req: Request): IntegrationPrincipal | null {
  const headerApiKey = req.headers['x-api-key'];
  const xApiKey = Array.isArray(headerApiKey) ? headerApiKey[0] : headerApiKey;

  const authHeader = req.headers.authorization;
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '') : undefined;

  const candidate = xApiKey || bearer;
  if (!candidate) return null;

  const validKeys = getInvoxaiApiKeys();
  if (validKeys.length === 0) return null;

  const match = validKeys.some((key) => timingSafeEquals(key, candidate));
  if (!match) return null;

  return {
    source: 'invoxai',
    scopes: parseScopes(process.env.INVOXAI_API_SCOPES),
  };
}

function userHasScope(user: User, scope: IntegrationScope): boolean {
  if (user.role === 'admin' || user.role === 'ops') return true;
  if (scope === 'integrations:read') return true;
  return false;
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      partnerCustomerIds?: string[];
      integration?: IntegrationPrincipal;
      actorType?: 'user' | 'integration';
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    const user = await getUserFromToken(token);
    if (user) {
      req.user = user;
      req.actorType = 'user';

      if (user.role === 'telecom_services_partner' && user.telecomServicesPartnerId) {
        const rows = await db
          .select({ id: customersTable.id })
          .from(customersTable)
          .where(eq(customersTable.telecomServicesPartnerId, user.telecomServicesPartnerId));
        req.partnerCustomerIds = rows.map((r: typeof customersTable.$inferSelect) => r.id);
      }

      next();
      return;
    }
  }

  const integration = resolveIntegrationPrincipal(req);
  if (integration) {
    req.integration = integration;
    req.actorType = 'integration';
    next();
    return;
  }

  sendUnauthorized(res, token ? 'Invalid or expired credentials' : 'Authentication required');
}

export function requireScope(...scopes: IntegrationScope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing = scopes.filter((scope) => {
      if (req.integration) return !req.integration.scopes.includes(scope);
      if (req.user) return !userHasScope(req.user, scope);
      return true;
    });

    if (missing.length > 0) {
      sendForbidden(res, `Missing required scope(s): ${missing.join(', ')}`);
      return;
    }

    next();
  };
}

export function requireIntegrationAuth(...scopes: IntegrationScope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.integration) {
      sendForbidden(res, 'Integration authentication is required');
      return;
    }

    const missing = scopes.filter((scope) => !req.integration?.scopes.includes(scope));
    if (missing.length > 0) {
      sendForbidden(res, `Missing required scope(s): ${missing.join(', ')}`);
      return;
    }

    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendForbidden(res);
      return;
    }
    next();
  };
}
