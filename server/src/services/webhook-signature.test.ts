import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';

import { verifyGithubSignature } from './webhook-signature.js';

const sign = (secret: string, body: string) =>
  `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

describe('verifyGithubSignature', () => {
  it('matches the example from the GitHub docs', () => {
    // https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries#testing-the-webhook-payload-validation
    const signature = 'sha256=757107ea0eb2509fc211221cce984b8a37570b6d7586c22c46f4379c8b043e17';
    assert.equal(
      verifyGithubSignature("It's a Secret to Everybody", Buffer.from('Hello, World!'), signature),
      true,
    );
  });

  it('accepts a body signed with our secret', () => {
    const body = JSON.stringify({ action: 'opened', title: 'Ünïcödé 🎉 <b>' });
    assert.equal(verifyGithubSignature('s3cret', Buffer.from(body), sign('s3cret', body)), true);
  });

  it('rejects a different secret', () => {
    const body = '{"action":"opened"}';
    assert.equal(verifyGithubSignature('s3cret', Buffer.from(body), sign('other', body)), false);
  });

  it('rejects a tampered body', () => {
    const signature = sign('s3cret', '{"action":"opened"}');
    assert.equal(verifyGithubSignature('s3cret', Buffer.from('{"action":"closed"}'), signature), false);
  });

  it('rejects missing, legacy sha1 and truncated signatures', () => {
    const body = Buffer.from('{}');
    assert.equal(verifyGithubSignature('s3cret', body, undefined), false);
    assert.equal(verifyGithubSignature('s3cret', body, 'sha1=abc'), false);
    assert.equal(verifyGithubSignature('s3cret', body, 'sha256=abc'), false);
  });
});
