import { Schema, Types, model, type HydratedDocument } from 'mongoose';

import type { ZapAction, ZapTrigger } from '../validation/zap.js';

export type RunStatus = 'success' | 'error';

export interface ZapFields {
  ownerId: Types.ObjectId;
  name: string;
  enabled: boolean;
  /** What starts the Zap. `config` is app-specific (e.g. `{ repo: 'owner/name' }`). */
  trigger: ZapTrigger;
  /** What the Zap does. `config` is app-specific (e.g. `{ template }`). */
  action: ZapAction;
  /** Id of the GitHub repo webhook this Zap relies on (shared by Zaps on the same repo). */
  webhookId?: number;
  lastRunAt?: Date;
  lastRunStatus?: RunStatus;
  lastRunError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ZapDoc = HydratedDocument<ZapFields>;

// `type` is a reserved word in Mongoose schema definitions, hence `type: { type: String }`.
const triggerSchema = new Schema(
  {
    app: { type: String, required: true },
    event: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const actionSchema = new Schema(
  {
    app: { type: String, required: true },
    type: { type: String, required: true },
    config: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

const zapSchema = new Schema<ZapFields>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    enabled: { type: Boolean, default: false },
    trigger: { type: triggerSchema, required: true },
    action: { type: actionSchema, required: true },
    webhookId: { type: Number },
    lastRunAt: { type: Date },
    lastRunStatus: { type: String, enum: ['success', 'error'] },
    lastRunError: { type: String },
  },
  { timestamps: true },
);

// The webhook runner looks up enabled Zaps by trigger + repo on every delivery.
zapSchema.index({ 'trigger.app': 1, 'trigger.event': 1, 'trigger.config.repo': 1, enabled: 1 });

export const Zap = model<ZapFields>('Zap', zapSchema);

/** The shape the API exposes. Internal fields (owner, webhook id) stay on the server. */
export function toZapDto(zap: ZapDoc) {
  return {
    id: zap.id as string,
    name: zap.name,
    enabled: zap.enabled,
    trigger: zap.trigger,
    action: zap.action,
    lastRunAt: zap.lastRunAt ?? null,
    lastRunStatus: zap.lastRunStatus ?? null,
    lastRunError: zap.lastRunError ?? null,
    createdAt: zap.createdAt,
    updatedAt: zap.updatedAt,
  };
}
