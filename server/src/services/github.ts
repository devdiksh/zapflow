import { Octokit } from 'octokit';

import { env } from '../config.js';

/**
 * Scopes we ask for at sign-in:
 * - read:user        → profile (login, avatar)
 * - repo             → list the user's repos and comment on PRs (incl. private repos)
 * - admin:repo_hook  → create/delete the webhook that triggers Zaps
 * A GitHub App would let us ask for much narrower, per-repo permissions (see README).
 */
export const GITHUB_SCOPES = ['read:user', 'repo', 'admin:repo_hook'];

export function githubClient(accessToken: string) {
  return new Octokit({ auth: accessToken, userAgent: 'zapflow' });
}

export function githubAuthorizeUrl(state: string): string {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', env.GITHUB_CALLBACK_URL);
  url.searchParams.set('scope', GITHUB_SCOPES.join(' '));
  url.searchParams.set('state', state);
  return url.toString();
}

/** Exchanges the OAuth `code` from the callback for a user access token. */
export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; scopes: string[] }> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.GITHUB_CALLBACK_URL,
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub token exchange failed with HTTP ${res.status}`);
  }
  const data = (await res.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!data.access_token) {
    throw new Error(`GitHub token exchange failed: ${data.error_description ?? data.error ?? 'no token'}`);
  }
  return {
    accessToken: data.access_token,
    scopes: data.scope ? data.scope.split(',').filter(Boolean) : [],
  };
}
