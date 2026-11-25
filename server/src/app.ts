import express, { type ErrorRequestHandler } from 'express';
import type { Store } from 'express-session';

import { HttpError } from './lib/http-error.js';
import { sessionMiddleware } from './lib/session.js';
import { authRouter } from './routes/auth.js';

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

  app.use(express.json({ limit: '100kb' }));
  app.use(sessionMiddleware(sessionStore));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/auth', authRouter);

  app.use('/api', (_req, _res, next) => {
    next(new HttpError(404, 'Not found'));
  });

  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong' });
};
