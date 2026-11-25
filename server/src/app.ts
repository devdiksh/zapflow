import express, { type ErrorRequestHandler } from 'express';

import { HttpError } from './lib/http-error.js';

/**
 * Builds the Express app without starting it, so tests can mount it directly.
 */
export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

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
