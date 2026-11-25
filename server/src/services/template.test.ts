import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_COMMENT_TEMPLATE, PULL_REQUEST_FIELDS } from '../apps/catalog.js';
import { pullRequestFieldValues, pullRequestEventSchema } from './pull-request-event.js';
import { renderTemplate } from './template.js';

const event = pullRequestEventSchema.parse({
  action: 'opened',
  number: 7,
  pull_request: {
    number: 7,
    title: 'Fix login redirect',
    html_url: 'https://github.com/octo-org/web-app/pull/7',
    user: { login: 'mona' },
  },
  repository: { name: 'web-app', full_name: 'octo-org/web-app', owner: { login: 'octo-org' } },
});

describe('renderTemplate', () => {
  it('renders the default comment from a PR-opened event', () => {
    assert.equal(
      renderTemplate(DEFAULT_COMMENT_TEMPLATE, pullRequestFieldValues(event)),
      'Thanks @mona for opening "Fix login redirect"! 🎉',
    );
  });

  it('fills every field and tolerates spaces inside the braces', () => {
    const template = '{{ pr.number }} {{pr.url}} {{repo.name}}';
    assert.equal(
      renderTemplate(template, pullRequestFieldValues(event)),
      '7 https://github.com/octo-org/web-app/pull/7 octo-org/web-app',
    );
  });

  it('leaves unknown placeholders visible instead of dropping them', () => {
    assert.equal(renderTemplate('Hi {{pr.autor}}', { 'pr.author': 'mona' }), 'Hi {{pr.autor}}');
  });

  it('inserts values literally, even ones that look like replacement patterns', () => {
    assert.equal(renderTemplate('{{pr.title}}', { 'pr.title': "Costs $& and $1 {{x}}" }), "Costs $& and $1 {{x}}");
  });

  it('does not resolve inherited object keys', () => {
    assert.equal(renderTemplate('{{constructor}}', {}), '{{constructor}}');
  });

  it('exposes exactly the fields the catalog advertises to the builder', () => {
    assert.deepEqual(
      Object.keys(pullRequestFieldValues(event)).sort(),
      PULL_REQUEST_FIELDS.map((field) => field.key).sort(),
    );
  });
});
