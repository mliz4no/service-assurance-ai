import { describe, expect, it, vi } from 'vitest';

vi.mock('../session-store', () => ({
  getUserFromToken: vi.fn().mockResolvedValue(null),
}));

vi.mock('@workspace/db', () => ({
  db: {},
  customersTable: {},
  usersTable: {},
}));

function createResponse() {
  const res: any = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
    },
  };
  return res;
}

describe('http helpers and auth middleware', () => {
  it('sends standard error payloads', async () => {
    const { sendError, sendUnauthorized, sendForbidden, sendConflict, sendBadRequest } = await import('../http');
    const res = createResponse();

    sendError(res, 500, 'FAIL', 'boom', { field: 'name' });
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe('FAIL');
    expect(res.body.error.details.field).toBe('name');

    const unauthorized = createResponse();
    sendUnauthorized(unauthorized);
    expect(unauthorized.statusCode).toBe(401);
    expect(unauthorized.body.error.code).toBe('UNAUTHORIZED');

    const forbidden = createResponse();
    sendForbidden(forbidden, 'No access');
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.body.error.message).toBe('No access');

    const conflict = createResponse();
    sendConflict(conflict, 'same key');
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body.error.code).toBe('CONFLICT');

    const badRequest = createResponse();
    sendBadRequest(badRequest, 'bad payload', { field: ['required'] });
    expect(badRequest.statusCode).toBe(400);
    expect(badRequest.body.error.details.field).toEqual(['required']);
  });

  it('handles integration auth and scope checks', async () => {
    const { requireAuth, requireScope, requireIntegrationAuth } = await import('../../middlewares/auth');

    const next = vi.fn();
    const res = createResponse();

    const req: any = {
      headers: {
        'x-api-key': 'abc123',
      },
    };

    process.env.INVOXAI_API_KEYS = 'abc123';
    process.env.INVOXAI_API_SCOPES = 'integrations:create,integrations:read';

    await requireAuth(req, res, next);
    expect(req.actorType).toBe('integration');
    expect(req.integration?.source).toBe('invoxai');

    const scopeNext = vi.fn();
    const scopeHandler = requireScope('integrations:create');
    scopeHandler(req, res, scopeNext);
    expect(scopeNext).toHaveBeenCalledTimes(1);

    const integrationNext = vi.fn();
    const integrationHandler = requireIntegrationAuth('integrations:read');
    integrationHandler(req, res, integrationNext);
    expect(integrationNext).toHaveBeenCalledTimes(1);
  });
});
