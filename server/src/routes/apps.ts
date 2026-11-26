import { Router } from 'express';

import { APPS, DEFAULT_COMMENT_TEMPLATE } from '../apps/catalog.js';

export const appsRouter = Router();

/** The app catalog for the builder's app picker, field chips and preview. */
appsRouter.get('/', (_req, res) => {
  res.json({ apps: APPS, defaults: { commentTemplate: DEFAULT_COMMENT_TEMPLATE } });
});
