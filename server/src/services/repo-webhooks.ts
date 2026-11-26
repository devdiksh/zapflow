import type { Octokit } from 'octokit';

import { env } from '../config.js';
import { Zap } from '../models/zap.js';

/**
 * ZapFlow keeps at most ONE webhook per repository, identified by its URL
 * (WEBHOOK_PUBLIC_URL). Every enabled Zap on that repo shares it, and one
 * delivery fans out to all matching Zaps in the runner. With one hook per Zap
 * instead, two Zaps on a repo would mean two deliveries, so each would run twice.
 */

const HOOK_EVENTS = ['pull_request'];

function splitRepo(fullName: string) {
  const [owner = '', repo = ''] = fullName.split('/');
  return { owner, repo };
}

function hookConfig() {
  return {
    url: env.WEBHOOK_PUBLIC_URL,
    // GitHub defaults to form-encoded payloads; we want JSON.
    content_type: 'json',
    secret: env.GITHUB_WEBHOOK_SECRET,
    insecure_ssl: '0',
  };
}

async function findOurHooks(octokit: Octokit, owner: string, repo: string) {
  const hooks = await octokit.paginate(octokit.rest.repos.listWebhooks, { owner, repo, per_page: 100 });
  return hooks.filter((hook) => hook.config.url === env.WEBHOOK_PUBLIC_URL);
}

/**
 * Makes sure `repo` has exactly one ZapFlow webhook for pull_request events
 * and returns its id. Reuses an existing hook (re-applying our config, in case
 * the secret changed) and cleans up duplicates left behind by a race.
 */
export async function ensureRepoWebhook(octokit: Octokit, repoFullName: string): Promise<number> {
  const { owner, repo } = splitRepo(repoFullName);
  const [existing, ...duplicates] = await findOurHooks(octokit, owner, repo);

  for (const duplicate of duplicates) {
    await octokit.rest.repos.deleteWebhook({ owner, repo, hook_id: duplicate.id });
  }

  if (existing) {
    await octokit.rest.repos.updateWebhook({
      owner,
      repo,
      hook_id: existing.id,
      active: true,
      events: HOOK_EVENTS,
      config: hookConfig(),
    });
    return existing.id;
  }

  const { data: hook } = await octokit.rest.repos.createWebhook({
    owner,
    repo,
    name: 'web',
    active: true,
    events: HOOK_EVENTS,
    config: hookConfig(),
  });
  return hook.id;
}

/**
 * Removes ZapFlow's webhook from `repo` once no enabled Zap, from any user,
 * still needs it. Call it after the Zap's own change has been saved.
 */
export async function releaseRepoWebhook(octokit: Octokit, repoFullName: string): Promise<void> {
  const stillNeeded = await Zap.exists({
    enabled: true,
    'trigger.app': 'github',
    'trigger.config.repo': repoFullName,
  });
  if (stillNeeded) {
    return;
  }

  const { owner, repo } = splitRepo(repoFullName);
  for (const hook of await findOurHooks(octokit, owner, repo)) {
    await octokit.rest.repos.deleteWebhook({ owner, repo, hook_id: hook.id });
  }
}
