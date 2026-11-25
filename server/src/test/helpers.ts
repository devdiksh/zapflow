import type { AddressInfo } from 'node:net';

/**
 * Test env: set before anything imports ../config.js (which validates on import).
 * Tests that need the app import it dynamically after calling this.
 */
export function setTestEnv(overrides: Record<string, string> = {}) {
  Object.assign(process.env, {
    NODE_ENV: 'test',
    SESSION_SECRET: 'test-session-secret-0123456789',
    GITHUB_CLIENT_ID: 'test-client-id',
    GITHUB_CLIENT_SECRET: 'test-client-secret',
    WEBHOOK_PUBLIC_URL: 'https://smee.io/test-channel',
    GITHUB_WEBHOOK_SECRET: 'test-webhook-secret-0123456789',
    ANTHROPIC_API_KEY: '', // tests never call Claude, even if the shell has a key
    ...overrides,
  });
}

/** Starts the app on a random port. No MongoDB needed for routes that don't hit the DB. */
export async function startTestServer() {
  setTestEnv();
  const { createApp } = await import('../app.js');
  const server = createApp().listen(0);
  await new Promise<void>((resolve) => server.once('listening', () => resolve()));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
