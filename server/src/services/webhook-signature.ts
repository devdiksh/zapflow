import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies GitHub's `X-Hub-Signature-256` header: an HMAC-SHA256 of the exact
 * request bytes, keyed with the webhook secret. It must be computed over the
 * raw body (not re-serialized JSON) and compared in constant time.
 */
export function verifyGithubSignature(
  secret: string,
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader?.startsWith('sha256=')) {
    return false;
  }
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`);
  const received = Buffer.from(signatureHeader);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
