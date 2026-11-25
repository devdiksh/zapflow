/** Shapes returned by the ZapFlow API (server/src). */

export interface User {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

// --- App catalog (GET /api/apps) ---------------------------------------------

export type AppStatus = 'available' | 'coming_soon';

export interface FieldDef {
  key: string;
  label: string;
  sample: string;
}

export interface TriggerDef {
  id: string;
  label: string;
  description: string;
  fields: FieldDef[];
}

export interface ActionDef {
  id: string;
  label: string;
  description: string;
}

export interface AppDef {
  id: string;
  name: string;
  description: string;
  status: AppStatus;
  color: string;
  triggers: TriggerDef[];
  actions: ActionDef[];
}

export interface Catalog {
  apps: AppDef[];
  defaults: { commentTemplate: string };
}

// --- Zaps (/api/zaps) ---------------------------------------------------------

export interface ZapTrigger {
  app: string;
  event: string;
  config: { repo: string };
}

export interface ZapAction {
  app: string;
  type: string;
  config: { template: string };
}

export interface ZapInput {
  name: string;
  enabled: boolean;
  trigger: ZapTrigger;
  action: ZapAction;
}

export interface Zap extends ZapInput {
  id: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | null;
  lastRunError: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- GitHub (GET /api/github/repos) -------------------------------------------

export interface Repo {
  fullName: string;
  private: boolean;
  url: string;
  pushedAt: string | null;
}
