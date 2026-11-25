import { Router } from 'express';

import { HttpError } from '../lib/http-error.js';
import { currentUserId } from '../middleware/require-auth.js';
import { findUserWithToken } from '../models/user.js';
import { listAdminRepos } from '../services/github.js';

export const githubRouter = Router();

/** Repos the user can attach a Zap to (see listAdminRepos). */
githubRouter.get('/repos', async (req, res) => {
  const user = await findUserWithToken(currentUserId(req));
  if (!user) {
    throw new HttpError(401, 'Sign in required');
  }
  res.json(await listAdminRepos(user.accessToken));
});
