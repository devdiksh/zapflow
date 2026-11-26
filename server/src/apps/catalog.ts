/**
 * The app catalog: which apps exist, what they can trigger on and do, and
 * which ones actually run today. The builder UI, the API validation and the
 * Copilot prompt all read from here, so adding an app starts in one place.
 *
 * Only GitHub runs. The others are listed so the picker reflects the product
 * direction; their triggers/actions are what we'd build first.
 */

export type AppStatus = 'available' | 'coming_soon';

/** A value a trigger produces that actions can use, e.g. {{pr.title}}. */
export interface FieldDef {
  key: string;
  label: string;
  /** Used for the live preview in the builder. */
  sample: string;
}

export interface TriggerDef {
  id: string;
  label: string;
  description: string;
  fields: FieldDef[];
}

export interface ActionDef {
  id: string;
  label: string;
  description: string;
}

export interface AppDef {
  id: string;
  name: string;
  description: string;
  status: AppStatus;
  /** Brand-ish colour for the app tile. */
  color: string;
  triggers: TriggerDef[];
  actions: ActionDef[];
}

export const PULL_REQUEST_FIELDS: FieldDef[] = [
  { key: 'pr.title', label: 'PR title', sample: 'Add dark mode toggle' },
  { key: 'pr.number', label: 'PR number', sample: '42' },
  { key: 'pr.author', label: 'PR author', sample: 'octocat' },
  { key: 'pr.url', label: 'PR URL', sample: 'https://github.com/octo-org/web-app/pull/42' },
  { key: 'repo.name', label: 'Repository', sample: 'octo-org/web-app' },
];

export const DEFAULT_COMMENT_TEMPLATE = 'Thanks @{{pr.author}} for opening "{{pr.title}}"! 🎉';

export const APPS: AppDef[] = [
  {
    id: 'github',
    name: 'GitHub',
    description: 'Pull requests, issues and repositories.',
    status: 'available',
    color: '#1f2328',
    triggers: [
      {
        id: 'pull_request.opened',
        label: 'Pull request opened',
        description: 'Runs when a new pull request is opened in a repository.',
        fields: PULL_REQUEST_FIELDS,
      },
    ],
    actions: [
      {
        id: 'comment_on_pr',
        label: 'Comment on pull request',
        description: 'Posts a comment on the pull request that triggered the Zap.',
      },
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Messages and channels.',
    status: 'coming_soon',
    color: '#4a154b',
    triggers: [{ id: 'message.posted', label: 'New message in channel', description: '', fields: [] }],
    actions: [{ id: 'send_message', label: 'Send channel message', description: '' }],
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Issues and sprints.',
    status: 'coming_soon',
    color: '#0052cc',
    triggers: [{ id: 'issue.created', label: 'Issue created', description: '', fields: [] }],
    actions: [{ id: 'create_issue', label: 'Create issue', description: '' }],
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issues and projects.',
    status: 'coming_soon',
    color: '#5e6ad2',
    triggers: [{ id: 'issue.created', label: 'Issue created', description: '', fields: [] }],
    actions: [{ id: 'create_issue', label: 'Create issue', description: '' }],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    description: 'Merge requests and pipelines.',
    status: 'coming_soon',
    color: '#e24329',
    triggers: [{ id: 'merge_request.opened', label: 'Merge request opened', description: '', fields: [] }],
    actions: [{ id: 'comment_on_mr', label: 'Comment on merge request', description: '' }],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    description: 'Deployments.',
    status: 'coming_soon',
    color: '#000000',
    triggers: [{ id: 'deployment.succeeded', label: 'Deployment succeeded', description: '', fields: [] }],
    actions: [{ id: 'redeploy', label: 'Redeploy project', description: '' }],
  },
];
