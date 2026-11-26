import { z } from 'zod';

import { HttpError } from '../lib/http-error.js';

/**
 * Request validation for Zaps. Only combinations that can actually run are
 * accepted. A new app adds its own trigger/action object here and the
 * schemas become unions.
 */

export const repoFullNameSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/, 'Pick a repository (owner/name)');

export const triggerSchema = z.object({
  app: z.literal('github', { error: 'Only GitHub triggers can run right now' }),
  event: z.literal('pull_request.opened', { error: 'Unsupported GitHub trigger' }),
  config: z.object({ repo: repoFullNameSchema }),
});

export const actionSchema = z.object({
  app: z.literal('github', { error: 'Only GitHub actions can run right now' }),
  type: z.literal('comment_on_pr', { error: 'Unsupported GitHub action' }),
  config: z.object({
    template: z
      .string()
      .trim()
      .min(1, 'Write the comment to post')
      .max(4000, 'Keep the comment under 4000 characters'),
  }),
});

const zapFields = {
  name: z.string().trim().min(1, 'Give your Zap a name').max(120),
  enabled: z.boolean(),
  trigger: triggerSchema,
  action: actionSchema,
};

export const zapCreateSchema = z.strictObject({
  ...zapFields,
  enabled: zapFields.enabled.default(false),
});

/** PATCH: any subset of fields; no defaults, so omitted fields stay as they are. */
export const zapUpdateSchema = z.strictObject(zapFields).partial();

export type ZapTrigger = z.infer<typeof triggerSchema>;
export type ZapAction = z.infer<typeof actionSchema>;
export type ZapCreateInput = z.infer<typeof zapCreateSchema>;
export type ZapUpdateInput = z.infer<typeof zapUpdateSchema>;

/** Parses a request body or throws a 400 listing each problem by field path. */
export function parseBody<T extends z.ZodType>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new HttpError(
      400,
      'Invalid input',
      result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return result.data;
}
