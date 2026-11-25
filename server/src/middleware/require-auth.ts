import type { Request, RequestHandler } from 'express';

import { HttpError } from '../lib/http-error.js';

/** Rejects requests without a signed-in session with 401. */
export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.session.userId) {
    next(new HttpError(401, 'Sign in required'));
    return;
  }
  next();
};

/** The signed-in user's id. Use behind `requireAuth`. */
export function currentUserId(req: Request): string {
  const userId = req.session.userId;
  if (!userId) {
    throw new HttpError(401, 'Sign in required');
  }
  return userId;
}
