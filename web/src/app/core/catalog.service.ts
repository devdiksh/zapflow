import { httpResource } from '@angular/common/http';
import { Injectable, computed } from '@angular/core';

import { ActionDef, AppDef, Catalog, TriggerDef } from './models';

/** The app catalog from GET /api/apps, loaded once and shared by every page. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly resource = httpResource<Catalog>(() => '/api/apps');

  readonly apps = computed<AppDef[]>(() => this.resource.value()?.apps ?? []);
  readonly defaultCommentTemplate = computed(
    () => this.resource.value()?.defaults.commentTemplate ?? '',
  );

  app(appId: string | null | undefined): AppDef | undefined {
    return this.apps().find((app) => app.id === appId);
  }

  trigger(appId: string | null | undefined, eventId: string | null | undefined): TriggerDef | undefined {
    return this.app(appId)?.triggers.find((trigger) => trigger.id === eventId);
  }

  action(appId: string | null | undefined, typeId: string | null | undefined): ActionDef | undefined {
    return this.app(appId)?.actions.find((action) => action.id === typeId);
  }
}
