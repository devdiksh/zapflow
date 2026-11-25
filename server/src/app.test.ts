import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { startTestServer } from './test/helpers.js';

describe('API routes (no database needed)', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
  });
  after(() => server.close());

  it('GET /api/auth/me is 401 without a session', async () => {
    const res = await fetch(`${server.baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
  });

  it('GET /api/auth/github redirects to GitHub with scopes and a state', async () => {
    const res = await fetch(`${server.baseUrl}/api/auth/github`, { redirect: 'manual' });
    assert.equal(res.status, 302);

    const location = new URL(res.headers.get('location')!);
    assert.equal(location.origin + location.pathname, 'https://github.com/login/oauth/authorize');
    assert.equal(location.searchParams.get('client_id'), 'test-client-id');
    assert.equal(location.searchParams.get('scope'), 'read:user repo admin:repo_hook');
    assert.match(location.searchParams.get('state') ?? '', /^[a-f0-9]{32}$/);
    assert.ok(res.headers.get('set-cookie'), 'state must be kept in a session cookie');
  });

  it('callback rejects a state that does not match the session', async () => {
    const res = await fetch(`${server.baseUrl}/api/auth/github/callback?code=abc&state=forged`, {
      redirect: 'manual',
    });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'http://localhost:4200/login?error=state_mismatch');
  });

  it('Zap and GitHub routes require a session', async () => {
    for (const path of ['/api/zaps', '/api/github/repos']) {
      const res = await fetch(`${server.baseUrl}${path}`);
      assert.equal(res.status, 401, path);
    }
  });

  it('serves the app catalog with GitHub as the only runnable app', async () => {
    const res = await fetch(`${server.baseUrl}/api/apps`);
    const body = (await res.json()) as { apps: { id: string; status: string }[] };
    const available = body.apps.filter((app) => app.status === 'available').map((app) => app.id);
    assert.deepEqual(available, ['github']);
    assert.ok(body.apps.length >= 5, 'the picker should list several developer tools');
  });

  it('reports Copilot as off without an API key, and drafting needs a session', async () => {
    const status = await fetch(`${server.baseUrl}/api/copilot/status`);
    assert.deepEqual(await status.json(), { enabled: false });

    const draft = await fetch(`${server.baseUrl}/api/copilot/draft`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prompt: 'When a PR is opened, comment thanks' }),
    });
    assert.equal(draft.status, 401);
  });

  it('unknown API paths return a JSON 404', async () => {
    const res = await fetch(`${server.baseUrl}/api/nope`);
    assert.equal(res.status, 404);
    assert.deepEqual(await res.json(), { error: 'Not found' });
  });
});
