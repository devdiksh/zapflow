import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { zapCreateSchema, zapUpdateSchema } from './zap.js';

const validZap = {
  name: 'Thank PR authors',
  trigger: { app: 'github', event: 'pull_request.opened', config: { repo: 'octo-org/web-app' } },
  action: { app: 'github', type: 'comment_on_pr', config: { template: 'Thanks @{{pr.author}}!' } },
};

describe('zap validation', () => {
  it('accepts a GitHub PR-opened → comment Zap and defaults enabled to false', () => {
    const parsed = zapCreateSchema.parse(validZap);
    assert.equal(parsed.enabled, false);
    assert.equal(parsed.trigger.config.repo, 'octo-org/web-app');
  });

  it('rejects apps that are not runnable yet', () => {
    const result = zapCreateSchema.safeParse({
      ...validZap,
      action: { app: 'slack', type: 'send_message', config: { template: 'hi' } },
    });
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.message, 'Only GitHub actions can run right now');
  });

  it('rejects a malformed repo and an empty template', () => {
    const result = zapCreateSchema.safeParse({
      ...validZap,
      trigger: { ...validZap.trigger, config: { repo: 'not a repo' } },
      action: { ...validZap.action, config: { template: '   ' } },
    });
    assert.equal(result.success, false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    assert.deepEqual(paths, ['trigger.config.repo', 'action.config.template']);
  });

  it('rejects unknown fields such as ownerId (no mass assignment)', () => {
    const result = zapCreateSchema.safeParse({ ...validZap, ownerId: 'someone-else' });
    assert.equal(result.success, false);
  });

  it('PATCH accepts a partial body without applying defaults', () => {
    assert.deepEqual(zapUpdateSchema.parse({ name: 'Renamed' }), { name: 'Renamed' });
    assert.deepEqual(zapUpdateSchema.parse({ enabled: true }), { enabled: true });
  });
});
