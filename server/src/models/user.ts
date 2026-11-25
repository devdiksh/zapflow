import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    githubId: { type: Number, required: true, unique: true },
    login: { type: String, required: true },
    name: { type: String },
    avatarUrl: { type: String },
    /**
     * GitHub OAuth token, used server-side only (repo list, webhooks, comments).
     * `select: false` keeps it out of every query unless explicitly asked for
     * with `.select('+accessToken')`, so it can't leak into an API response by accident.
     * In production this would be encrypted at rest (KMS / envelope encryption).
     */
    accessToken: { type: String, required: true, select: false },
    scopes: { type: [String], default: [] },
  },
  { timestamps: true },
);

export type UserFields = InferSchemaType<typeof userSchema>;
export type UserDoc = HydratedDocument<UserFields>;

export const User = model('User', userSchema);

/** The shape the API exposes for the signed-in user. Never includes the token. */
export function toPublicUser(user: UserDoc) {
  return {
    id: user.id as string,
    login: user.login,
    name: user.name ?? null,
    avatarUrl: user.avatarUrl ?? null,
  };
}

/** Loads a user together with their GitHub token, for server-side GitHub calls. */
export async function findUserWithToken(userId: unknown) {
  return User.findById(userId).select('+accessToken');
}
