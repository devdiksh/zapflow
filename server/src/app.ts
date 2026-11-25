import express, { type ErrorRequestHandler } from 'express';
import type { Store } from 'express-session';
import { RequestError } from 'octokit';

import { HttpError } from './lib/http-error.js';
import { sessionMiddleware } from './lib/session.js';
import { requireAuth } from './middleware/require-auth.js';
import { appsRouter } from './routes/apps.js';
import { authRouter } from './routes/auth.js';
import { githubRouter } from './routes/github.js';
import { webhooksRouter } from './routes/webhooks.js';
import { zapsRouter } from './routes/zaps.js';

export interface AppOptions {
  /** Session store. Production/dev pass a MongoStore; tests can omit it (in-memory). */
  sessionStore?: Store;
}

/**
 * Builds the Express app without starting it, so tests can mount it directly.
 */
export function createApp({ sessionStore }: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');

  // Before express.json() and sessions: the webhook needs the raw body for its
  // signature check, and it's called by GitHub, not by a signed-in browser.
  app.use('/api/webhooks', webhooksRouter);

  app.use(express.json({ limit: '100kb' }));
  app.use(sessionMiddleware(sessionStore));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/apps', appsRouter);
  app.use('/api/zaps', requireAuth, zapsRouter);
  app.use('/api/github', requireAuth, githubRouter);

  app.use('/api', (_req, _res, next) => {
    next(new HttpError(404, 'Not found'));
  });

  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const httpError = toHttpError(err);
  if (httpError.status >= 500) {
    console.error('Request failed:', err);
  }
  res.status(httpError.status).json({ error: httpError.message, details: httpError.details });
};

function toHttpError(err: unknown): HttpError {
  if (err instanceof HttpError) {
    return err;
  }
  if (err instanceof RequestError) {
    // The user's GitHub token was revoked or expired: they need to sign in again.
    if (err.status === 401) {
      return new HttpError(401, 'Your GitHub access has expired. Please sign in again.');
    }
    return new HttpError(502, `GitHub request failed: ${err.message}`);
  }
  // body-parser errors (malformed JSON, payload too large) carry a client status.
  if (isClientError(err)) {
    return new HttpError(err.status, err.message);
  }
  return new HttpError(500, 'Something went wrong');
}

function isClientError(err: unknown): err is { status: number; message: string } {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 && err instanceof Error;
}
