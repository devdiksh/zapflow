import { z } from 'zod';

/**
 * The parts of GitHub's `pull_request` webhook payload we use. Validating it
 * means a surprising payload is ignored instead of crashing the runner.
 */
export const pullRequestEventSchema = z.object({
  action: z.string(),
  pull_request: z.object({
    number: z.number().int(),
    title: z.string(),
    html_url: z.string(),
    user: z.object({ login: z.string() }).nullable(),
  }),
  repository: z.object({
    name: z.string(),
    full_name: z.string(),
    owner: z.object({ login: z.string() }),
  }),
});

export type PullRequestEvent = z.infer<typeof pullRequestEventSchema>;

/**
 * The values a "Pull request opened" trigger exposes to actions. Keys match
 * PULL_REQUEST_FIELDS in apps/catalog.ts (a test keeps them in sync).
 */
export function pullRequestFieldValues(event: PullRequestEvent): Record<string, string> {
  const pr = event.pull_request;
  return {
    'pr.title': pr.title,
    'pr.number': String(pr.number),
    'pr.author': pr.user?.login ?? 'ghost',
    'pr.url': pr.html_url,
    'repo.name': event.repository.full_name,
  };
}
