import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';
import { currentUserId, requireAuth } from '../middleware/require-auth.js';
import { findUserWithToken } from '../models/user.js';
import { copilotEnabled, draftZap } from '../services/copilot.js';
import { listAdminRepos } from '../services/github.js';
import { parseBody } from '../validation/zap.js';

export const copilotRouter = Router();

const draftRequestSchema = z.strictObject({
  prompt: z.string().trim().min(3, 'Describe the Zap you want').max(500, 'Keep it under 500 characters'),
});

/** Lets the builder show a "not configured" state instead of a broken input. */
copilotRouter.get('/status', (_req, res) => {
  res.json({ enabled: copilotEnabled() });
});

/** Natural language → draft Zap (not saved, never enabled). The builder opens it for review. */
copilotRouter.post('/draft', requireAuth, async (req, res) => {
  if (!copilotEnabled()) {
    throw new HttpError(503, 'Copilot isn’t configured. Set ANTHROPIC_API_KEY in server/.env to turn it on.');
  }
  const { prompt } = parseBody(draftRequestSchema, req.body);

  const user = await findUserWithToken(currentUserId(req));
  if (!user) {
    throw new HttpError(401, 'Sign in required');
  }
  // The user's repos give Claude something real to pick from (it never invents one).
  const repos = (await listAdminRepos(user.accessToken)).slice(0, 100).map((repo) => repo.fullName);

  res.json(await draftZap(prompt, repos));
});
