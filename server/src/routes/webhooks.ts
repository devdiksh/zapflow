import express, { Router } from 'express';

import { env } from '../config.js';
import { pullRequestEventSchema } from '../services/pull-request-event.js';
import { runPullRequestOpened } from '../services/runner.js';
import { verifyGithubSignature } from '../services/webhook-signature.js';

export const webhooksRouter = Router();

/**
 * GitHub webhook receiver. Mounted before express.json(): the signature is an
 * HMAC of the raw bytes, so we need the body unparsed.
 */
webhooksRouter.post('/github', express.raw({ type: '*/*', limit: '5mb' }), (req, res) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  const event = req.get('x-github-event');
  const delivery = req.get('x-github-delivery');

  if (!verifyGithubSignature(env.GITHUB_WEBHOOK_SECRET, rawBody, req.get('x-hub-signature-256'))) {
    console.warn(`[webhook] rejected ${event ?? 'unknown'} delivery ${delivery ?? '?'}: bad signature`);
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ error: 'Expected a JSON payload (webhook content type application/json)' });
    return;
  }

  // Acknowledge right away: GitHub waits at most 10s, and posting comments can
  // take a while. A real system would put the work on a queue (see README).
  res.status(200).json({ ok: true });

  if (event !== 'pull_request') {
    return; // e.g. the `ping` GitHub sends when the hook is created
  }
  const parsed = pullRequestEventSchema.safeParse(payload);
  if (!parsed.success || parsed.data.action !== 'opened') {
    return;
  }
  runPullRequestOpened(parsed.data).catch((err: unknown) => {
    console.error(`[webhook] delivery ${delivery ?? '?'} failed:`, err);
  });
});
