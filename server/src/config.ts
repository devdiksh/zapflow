import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

/**
 * All environment variables are read and validated once, here.
 * The server refuses to start with a clear message instead of failing later
 * in the middle of an OAuth flow or a webhook delivery.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/zapflow'),
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 characters'),

  /** Where the Angular app lives; we send the browser back here after login. */
  APP_URL: z.url().default('http://localhost:4200'),

  /** GitHub OAuth App credentials (github.com → Settings → Developer settings → OAuth Apps). */
  GITHUB_CLIENT_ID: z.string().min(1, 'create a GitHub OAuth App and set its client id'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'set the GitHub OAuth App client secret'),
  /** Must match the OAuth App's "Authorization callback URL" exactly. Goes through the Angular proxy. */
  GITHUB_CALLBACK_URL: z.url().default('http://localhost:4200/api/auth/github/callback'),

  /**
   * Public URL GitHub delivers webhooks to. In dev, a smee.io channel that
   * `smee-client` forwards to http://localhost:3000/api/webhooks/github.
   */
  WEBHOOK_PUBLIC_URL: z.url('set WEBHOOK_PUBLIC_URL to your smee.io channel (or other public URL)'),
  /** Shared secret GitHub uses to sign deliveries (X-Hub-Signature-256). */
  GITHUB_WEBHOOK_SECRET: z.string().min(16, 'GITHUB_WEBHOOK_SECRET must be at least 16 characters'),

  /** Optional: enables the Copilot (natural language → draft Zap). Empty means off. */
  ANTHROPIC_API_KEY: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  console.error(`Invalid environment configuration (see server/.env.example):\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
