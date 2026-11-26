import { RequestError } from 'octokit';

import { findUserWithToken } from '../models/user.js';
import { Zap, type RunStatus, type ZapDoc } from '../models/zap.js';
import { githubClient } from './github.js';
import { pullRequestFieldValues, type PullRequestEvent } from './pull-request-event.js';
import { renderTemplate } from './template.js';

interface ActionContext {
  zap: ZapDoc;
  event: PullRequestEvent;
  /** Trigger output, used for field mapping ({{pr.title}} …). */
  values: Record<string, string>;
  accessToken: string;
}

/** Action implementations, keyed by `${action.app}.${action.type}`. New actions plug in here. */
const ACTIONS: Record<string, (ctx: ActionContext) => Promise<{ url?: string }>> = {
  'github.comment_on_pr': async ({ zap, event, values, accessToken }) => {
    const body = renderTemplate(zap.action.config.template, values);
    const { data: comment } = await githubClient(accessToken).rest.issues.createComment({
      owner: event.repository.owner.login,
      repo: event.repository.name,
      issue_number: event.pull_request.number,
      body,
    });
    return { url: comment.html_url };
  },
};

/**
 * Runs every enabled Zap whose trigger is "PR opened" on this repo. Each Zap
 * acts with its owner's token, and one failing Zap doesn't stop the others.
 */
export async function runPullRequestOpened(event: PullRequestEvent): Promise<void> {
  const repo = event.repository.full_name;
  const zaps = await Zap.find({
    enabled: true,
    'trigger.app': 'github',
    'trigger.event': 'pull_request.opened',
    'trigger.config.repo': repo,
  });
  console.log(`[runner] PR #${event.pull_request.number} opened in ${repo}: ${zaps.length} Zap(s) to run`);

  const values = pullRequestFieldValues(event);
  await Promise.all(zaps.map((zap) => runZap(zap, event, values)));
}

async function runZap(zap: ZapDoc, event: PullRequestEvent, values: Record<string, string>) {
  try {
    const action = ACTIONS[`${zap.action.app}.${zap.action.type}`];
    if (!action) {
      throw new Error(`Unsupported action ${zap.action.app}.${zap.action.type}`);
    }
    const owner = await findUserWithToken(zap.ownerId);
    if (!owner) {
      throw new Error('The owner of this Zap no longer exists');
    }

    const result = await action({ zap, event, values, accessToken: owner.accessToken });
    await recordRun(zap, 'success');
    console.log(`[runner] Zap "${zap.name}" succeeded${result.url ? `: ${result.url}` : ''}`);
  } catch (err) {
    const message = describeRunError(err, event.repository.full_name);
    await recordRun(zap, 'error', message);
    console.warn(`[runner] Zap "${zap.name}" failed: ${message}`);
  }
}

async function recordRun(zap: ZapDoc, status: RunStatus, error?: string) {
  await Zap.updateOne(
    { _id: zap._id },
    error
      ? { $set: { lastRunAt: new Date(), lastRunStatus: status, lastRunError: error } }
      : { $set: { lastRunAt: new Date(), lastRunStatus: status }, $unset: { lastRunError: 1 } },
    // A run isn't an edit: don't bump updatedAt (the list is sorted by it).
    { timestamps: false },
  );
}

function describeRunError(err: unknown, repo: string): string {
  if (err instanceof RequestError) {
    if (err.status === 401) {
      return 'GitHub access expired. Sign in to ZapFlow again to reconnect.';
    }
    if (err.status === 403 || err.status === 404) {
      return `No permission to comment on pull requests in ${repo}.`;
    }
    return `GitHub returned ${err.status}: ${err.message}`.slice(0, 500);
  }
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}
