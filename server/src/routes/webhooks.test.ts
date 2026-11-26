import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { startTestServer } from '../test/helpers.js';

const SECRET = 'test-webhook-secret-0123456789'; // matches setTestEnv()

function deliver(baseUrl: string, event: string, body: string, signature?: string) {
  return fetch(`${baseUrl}/api/webhooks/github`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-github-event': event,
      'x-github-delivery': 'test-delivery',
      ...(signature ? { 'x-hub-signature-256': signature } : {}),
    },
    body,
  });
}

const sign = (body: string) => `sha256=${createHmac('sha256', SECRET).update(body).digest('hex')}`;

describe('POST /api/webhooks/github', () => {
  let server: Awaited<ReturnType<typeof startTestServer>>;

  before(async () => {
    server = await startTestServer();
  });
  after(() => server.close());

  it('rejects unsigned deliveries', async () => {
    const res = await deliver(server.baseUrl, 'pull_request', '{"action":"opened"}');
    assert.equal(res.status, 401);
  });

  it('rejects deliveries signed with another secret', async () => {
    const body = '{"action":"opened"}';
    const badSignature = `sha256=${createHmac('sha256', 'wrong').update(body).digest('hex')}`;
    const res = await deliver(server.baseUrl, 'pull_request', body, badSignature);
    assert.equal(res.status, 401);
  });

  it('verifies against the raw bytes, not re-serialized JSON', async () => {
    // Whitespace and key order would change if the body were parsed first.
    const body = '{ "zen": "Keep it logically awesome.",   "hook_id": 1 }';
    const res = await deliver(server.baseUrl, 'ping', body, sign(body));
    assert.equal(res.status, 200);
  });

  it('acknowledges PR events it does not act on', async () => {
    const body = JSON.stringify({ action: 'closed' });
    const res = await deliver(server.baseUrl, 'pull_request', body, sign(body));
    assert.equal(res.status, 200);
  });

  it('answers 400 to a signed but non-JSON body', async () => {
    const body = 'payload=%7B%7D';
    const res = await deliver(server.baseUrl, 'pull_request', body, sign(body));
    assert.equal(res.status, 400);
  });
});
