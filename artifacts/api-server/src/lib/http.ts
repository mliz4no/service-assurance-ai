import type { Response } from 'express';

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Record<string, string | string[]>;
  };
};

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: Record<string, string | string[]>,
): void {
  const payload: ErrorBody = {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  res.status(status).json(payload);
}

export function sendUnauthorized(res: Response, message = 'Authentication required'): void {
  sendError(res, 401, 'UNAUTHORIZED', message);
}

export function sendForbidden(res: Response, message = 'Insufficient permissions'): void {
  sendError(res, 403, 'FORBIDDEN', message);
}

export function sendConflict(res: Response, message: string): void {
  sendError(res, 409, 'CONFLICT', message);
}

export function sendBadRequest(
  res: Response,
  message: string,
  details?: Record<string, string | string[]>,
): void {
  sendError(res, 400, 'BAD_REQUEST', message, details);
}
