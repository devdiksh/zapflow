import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import { setTestEnv } from '../test/helpers.js';

// copilot.ts reads config on import, so set the test env first.
setTestEnv();
const { buildSystemPrompt, matchRepo, toZapDraft } = await import('./copilot.js');
type Reply = Parameters<typeof toZapDraft>[0];

const REPOS = ['octo-org/web-app', 'octo-org/API', 'mona/dotfiles'];

const reply = (overrides: Partial<NonNullable<Reply['zap']>> = {}): Reply => ({
  supported: true,
  message: 'Drafted a Zap that thanks PR authors.',
  zap: {
    name: 'Thank PR authors',
    trigger: { app: 'github', event: 'pull_request.opened', repo: 'octo-org/web-app' },
    action: { app: 'github', type: 'comment_on_pr', template: 'Thanks @{{pr.author}}!' },
    ...overrides,
  },
});

describe('copilot draft handling', () => {
  before(() => setTestEnv());

  it('produces a builder draft that is always off', () => {
    const result = toZapDraft(reply(), REPOS);
    assert.equal(result.supported, true);
    assert.equal(result.draft?.enabled, false);
    assert.equal(result.draft?.trigger.config.repo, 'octo-org/web-app');
    assert.equal(result.draft?.action.config.template, 'Thanks @{{pr.author}}!');
  });

  it('matches repos case-insensitively and by unambiguous bare name, using the canonical spelling', () => {
    assert.equal(matchRepo('OCTO-ORG/api', REPOS), 'octo-org/API');
    assert.equal(matchRepo('dotfiles', REPOS), 'mona/dotfiles');
    assert.equal(matchRepo('someone/else', REPOS), null);
    assert.equal(matchRepo(null, REPOS), null);
  });

  it('never keeps a repo the user does not have: the user picks one instead', () => {
    const result = toZapDraft(
      reply({ trigger: { app: 'github', event: 'pull_request.opened', repo: 'evil/repo' } }),
      REPOS,
    );
    assert.equal(result.draft?.trigger.config.repo, '');
  });

  it('falls back to the default comment when the drafted one is empty', () => {
    const result = toZapDraft(
      reply({ action: { app: 'github', type: 'comment_on_pr', template: '   ' } }),
      REPOS,
    );
    assert.match(result.draft?.action.config.template ?? '', /\{\{pr\.author\}\}/);
  });

  it('passes through "not possible yet" answers without a draft', () => {
    const result = toZapDraft(
      { supported: false, message: 'Slack is coming soon.', zap: null },
      REPOS,
    );
    assert.deepEqual(result, { supported: false, message: 'Slack is coming soon.', draft: null });
  });

  it('gives Claude the fields, the coming-soon apps and only the user’s repos', () => {
    const prompt = buildSystemPrompt(REPOS);
    assert.match(prompt, /\{\{pr\.title\}\}/);
    assert.match(prompt, /Slack/);
    assert.match(prompt, /- mona\/dotfiles/);
  });
});
