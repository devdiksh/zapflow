import { RequestError } from 'octokit';

import { HttpError } from '../lib/http-error.js';
import { findUserWithToken } from '../models/user.js';
import type { ZapTrigger } from '../validation/zap.js';
import { githubClient } from './github.js';
import { ensureRepoWebhook, releaseRepoWebhook } from './repo-webhooks.js';

/**
 * Turning a Zap on means making sure GitHub will tell us about its trigger
 * event. Called before an enabled Zap is saved, so a Zap is never stored as
 * "on" without a working webhook behind it. Returns the webhook id.
 */
export async function connectTrigger(userId: string, trigger: ZapTrigger): Promise<number> {
  const user = await findUserWithToken(userId);
  if (!user) {
    throw new HttpError(401, 'Sign in required');
  }

  const repo = trigger.config.repo;
  try {
    return await ensureRepoWebhook(githubClient(user.accessToken), repo);
  } catch (err) {
    if (err instanceof RequestError && (err.status === 403 || err.status === 404)) {
      throw new HttpError(
        422,
        `ZapFlow couldn't add a webhook to ${repo}. You need admin access to that repository.`,
      );
    }
    if (err instanceof RequestError && err.status === 422) {
      throw new HttpError(422, `GitHub rejected the webhook for ${repo}: ${err.message}`);
    }
    throw err;
  }
}

/**
 * Turning a Zap off (or deleting it, or moving it to another repo) releases
 * the old repo's webhook if nothing else uses it. Best effort: a leftover hook
 * only delivers events that no Zap picks up, so a failure here shouldn't
 * block the user's change.
 */
export async function disconnectTrigger(userId: string, trigger: ZapTrigger): Promise<void> {
  try {
    const user = await findUserWithToken(userId);
    if (user) {
      await releaseRepoWebhook(githubClient(user.accessToken), trigger.config.repo);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.warn(`Couldn't remove the webhook from ${trigger.config.repo}: ${reason}`);
  }
}
