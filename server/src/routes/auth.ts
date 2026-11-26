import { randomBytes } from 'node:crypto';

import { Router } from 'express';

import { env } from '../config.js';
import { HttpError } from '../lib/http-error.js';
import {
  SESSION_COOKIE,
  destroySession,
  regenerateSession,
  saveSession,
} from '../lib/session.js';
import { User, toPublicUser } from '../models/user.js';
import { exchangeCodeForToken, githubAuthorizeUrl, githubClient } from '../services/github.js';

export const authRouter = Router();

/** Step 1: send the browser to GitHub's consent screen. */
authRouter.get('/github', async (req, res) => {
  const state = randomBytes(16).toString('hex');
  req.session.oauthState = state;
  // Persist the state before leaving, so it's there when GitHub sends the user back.
  await saveSession(req);
  res.redirect(githubAuthorizeUrl(state));
});

/** Step 2: GitHub redirects back here (through the Angular proxy) with ?code&state. */
authRouter.get('/github/callback', async (req, res) => {
  const loginUrl = (error: string) => `${env.APP_URL}/login?error=${encodeURIComponent(error)}`;

  const { code, state, error } = req.query;
  const expectedState = req.session.oauthState;
  delete req.session.oauthState;

  if (typeof error === 'string') {
    res.redirect(loginUrl(error === 'access_denied' ? 'access_denied' : 'oauth_failed'));
    return;
  }
  if (typeof code !== 'string' || typeof state !== 'string' || !expectedState || state !== expectedState) {
    res.redirect(loginUrl('state_mismatch'));
    return;
  }

  try {
    const { accessToken, scopes } = await exchangeCodeForToken(code);
    const { data: ghUser } = await githubClient(accessToken).rest.users.getAuthenticated();

    const user = await User.findOneAndUpdate(
      { githubId: ghUser.id },
      {
        $set: {
          login: ghUser.login,
          name: ghUser.name ?? undefined,
          avatarUrl: ghUser.avatar_url,
          accessToken,
          scopes,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    await regenerateSession(req);
    req.session.userId = user.id as string;
    await saveSession(req);

    res.redirect(`${env.APP_URL}/zaps`);
  } catch (err) {
    console.error('GitHub OAuth callback failed:', err);
    res.redirect(loginUrl('oauth_failed'));
  }
});

authRouter.get('/me', async (req, res) => {
  const userId = req.session.userId;
  const user = userId ? await User.findById(userId) : null;
  if (!user) {
    throw new HttpError(401, 'Not signed in');
  }
  res.json(toPublicUser(user));
});

authRouter.post('/logout', async (req, res) => {
  await destroySession(req);
  res.clearCookie(SESSION_COOKIE);
  res.status(204).end();
});
