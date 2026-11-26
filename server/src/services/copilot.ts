import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { APPS, DEFAULT_COMMENT_TEMPLATE, PULL_REQUEST_FIELDS } from '../apps/catalog.js';
import { env } from '../config.js';
import { HttpError } from '../lib/http-error.js';
import { actionSchema, type ZapAction, type ZapTrigger } from '../validation/zap.js';

/**
 * Copilot: natural language → a draft Zap the user reviews in the builder.
 *
 * One Claude call with structured outputs, so the reply always matches
 * `copilotReplySchema`. The draft is then checked again on our side (repo
 * must be one of the user's, template must pass the normal Zap validation)
 * and is never enabled: a person turns it on after reviewing it.
 */

const COPILOT_MODEL = 'claude-opus-5-5';

export const copilotReplySchema = z.object({
  supported: z
    .boolean()
    .describe('false when the request needs an app, trigger or action that ZapFlow cannot run yet'),
  message: z
    .string()
    .describe(
      'One or two short sentences for the user: what you drafted and anything they still need to do, ' +
        'or why it is not possible yet and what is possible instead.',
    ),
  zap: z
    .object({
      name: z.string().describe('Short name for the Zap, under 60 characters'),
      trigger: z.object({
        app: z.enum(['github']),
        event: z.enum(['pull_request.opened']),
        repo: z
          .string()
          .nullable()
          .describe('One of the listed repositories as owner/name, or null if the user did not name one of them'),
      }),
      action: z.object({
        app: z.enum(['github']),
        type: z.enum(['comment_on_pr']),
        template: z.string().describe('The comment to post, using {{field}} placeholders'),
      }),
    })
    .nullable()
    .describe('The drafted Zap, or null when supported is false'),
});

export type CopilotReply = z.infer<typeof copilotReplySchema>;

export interface ZapDraft {
  name: string;
  enabled: false;
  trigger: ZapTrigger;
  action: ZapAction;
}

export interface CopilotResult {
  supported: boolean;
  message: string;
  /** Opens in the builder; `trigger.config.repo` is '' when the user still has to pick one. */
  draft: ZapDraft | null;
}

export function copilotEnabled(): boolean {
  return Boolean(env.ANTHROPIC_API_KEY);
}

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: 60_000, maxRetries: 1 });
  return client;
}

export function buildSystemPrompt(repos: readonly string[]): string {
  const fields = PULL_REQUEST_FIELDS.map((field) => `- {{${field.key}}}: ${field.label}`).join('\n');
  const comingSoon = APPS.filter((app) => app.status === 'coming_soon')
    .map((app) => app.name)
    .join(', ');
  const repoList = repos.length ? repos.map((repo) => `- ${repo}`).join('\n') : '(none)';

  return `You draft automations ("Zaps") for ZapFlow. A Zap is one trigger plus one action. The user reviews your draft in a form and turns it on themselves.

What ZapFlow can run today:
- Trigger: GitHub "Pull request opened" in one repository.
- Action: GitHub "Comment on pull request": posts a comment on the pull request that triggered the Zap.

Apps that are coming soon and cannot run yet: ${comingSoon}. Other GitHub triggers (merged, closed, pushed, issues…) and actions cannot run yet either.

The comment can use these fields, written exactly like this:
${fields}

How to draft:
- Write the comment the way the user asked, in their language and tone, and keep it short. Address the author as @{{pr.author}} when thanking or greeting them.
- If the user does not say what the comment should say, use: ${DEFAULT_COMMENT_TEMPLATE}
- For the repository, choose only from the user's repositories listed below. Match case-insensitively; a bare repository name is fine when only one listed repository has it. If they name none, or one that is not listed, use null and tell them to pick a repository in the form.
- If the request needs something ZapFlow cannot run, set supported to false and zap to null, and say briefly what ZapFlow can do instead. If only part of it is possible (for example "comment and also post to Slack"), draft the part that can run and say what you left out.
- Do not say the Zap is on or saved: it is a draft until the user reviews it.

The user's repositories:
${repoList}`;
}

/**
 * Turns Claude's reply into a builder draft, trusting nothing: the repo has to
 * be one of the user's (we use the canonical spelling), the template has to pass
 * the same validation as a hand-made Zap, and the draft is always off.
 */
export function toZapDraft(reply: CopilotReply, repos: readonly string[]): CopilotResult {
  if (!reply.supported || !reply.zap) {
    return { supported: false, message: reply.message, draft: null };
  }

  const template = actionSchema.shape.config.shape.template.safeParse(reply.zap.action.template);
  const name = reply.zap.name.trim().slice(0, 120);

  return {
    supported: true,
    message: reply.message,
    draft: {
      name: name || 'Comment on new pull requests',
      enabled: false,
      trigger: {
        app: 'github',
        event: 'pull_request.opened',
        config: { repo: matchRepo(reply.zap.trigger.repo, repos) ?? '' },
      },
      action: {
        app: 'github',
        type: 'comment_on_pr',
        config: { template: template.success ? template.data : DEFAULT_COMMENT_TEMPLATE },
      },
    },
  };
}

/** Exact owner/name match first (case-insensitive), then an unambiguous bare repo name. */
export function matchRepo(candidate: string | null, repos: readonly string[]): string | null {
  const wanted = candidate?.trim().toLowerCase();
  if (!wanted) {
    return null;
  }
  const exact = repos.find((repo) => repo.toLowerCase() === wanted);
  if (exact) {
    return exact;
  }
  const byName = repos.filter((repo) => repo.toLowerCase().split('/')[1] === wanted.split('/').pop());
  return byName.length === 1 ? (byName[0] ?? null) : null;
}

export async function draftZap(prompt: string, repos: readonly string[]): Promise<CopilotResult> {
  let response;
  try {
    response = await anthropic().beta.messages.parse({
      model: COPILOT_MODEL,
      max_tokens: 16000,
      // A small extraction task: low effort keeps the builder snappy.
      output_config: { effort: 'low', format: betaZodOutputFormat(copilotReplySchema) },
      // If a safety classifier declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: buildSystemPrompt(repos),
      messages: [{ role: 'user', content: prompt }],
    });
  } catch (err) {
    throw toCopilotError(err);
  }

  if (response.stop_reason === 'refusal') {
    throw new HttpError(422, 'Copilot can’t help with that request.');
  }
  if (!response.parsed_output) {
    throw new HttpError(502, 'Copilot returned an unexpected answer. Try rephrasing your request.');
  }
  return toZapDraft(response.parsed_output, repos);
}

function toCopilotError(err: unknown): HttpError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    return new HttpError(502, 'Copilot is misconfigured: the Anthropic API key was rejected.');
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpError(429, 'Copilot is busy right now. Try again in a moment.');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new HttpError(502, 'Copilot couldn’t reach Claude. Check the server’s network connection.');
  }
  if (err instanceof Anthropic.APIError) {
    return new HttpError(502, `Copilot request failed (${err.status ?? 'no status'}). Try again.`);
  }
  console.error('Copilot failed:', err);
  return new HttpError(500, 'Copilot failed unexpectedly.');
}
