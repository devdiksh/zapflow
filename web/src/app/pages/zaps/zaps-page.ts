import { httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { apiErrorMessage } from '../../core/api-error';
import { CatalogService } from '../../core/catalog.service';
import { Zap } from '../../core/models';
import { ZapsService } from '../../core/zaps.service';
import { AppIcon } from '../../shared/app-icon';
import { TimeAgoPipe } from '../../shared/time-ago.pipe';
import { Toggle } from '../../shared/toggle';

@Component({
  selector: 'app-zaps-page',
  imports: [RouterLink, AppIcon, Toggle, TimeAgoPipe],
  templateUrl: './zaps-page.html',
  styleUrl: './zaps-page.scss',
  host: {
    // Coming back from GitHub after opening a PR? Show the latest run status.
    '(window:focus)': 'refresh()',
  },
})
export class ZapsPage {
  private readonly zapsApi = inject(ZapsService);
  protected readonly catalog = inject(CatalogService);

  protected readonly zaps = httpResource<Zap[]>(() => '/api/zaps', { defaultValue: [] });
  /** Ids of Zaps with a toggle/delete request in flight. */
  protected readonly busy = signal<ReadonlySet<string>>(new Set());
  protected readonly actionError = signal<string | null>(null);

  protected refresh(): void {
    if (!this.zaps.isLoading()) {
      this.zaps.reload();
    }
  }

  protected async toggle(zap: Zap, enabled: boolean): Promise<void> {
    this.actionError.set(null);
    this.setBusy(zap.id, true);
    try {
      const updated = await this.zapsApi.update(zap.id, { enabled });
      this.zaps.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      this.actionError.set(`Couldn’t turn “${zap.name}” ${enabled ? 'on' : 'off'}: ${apiErrorMessage(err)}`);
    } finally {
      this.setBusy(zap.id, false);
    }
  }

  protected async remove(zap: Zap): Promise<void> {
    if (!confirm(`Delete “${zap.name}”? This can’t be undone.`)) {
      return;
    }
    this.actionError.set(null);
    this.setBusy(zap.id, true);
    try {
      await this.zapsApi.delete(zap.id);
      this.zaps.update((list) => list.filter((item) => item.id !== zap.id));
    } catch (err) {
      this.actionError.set(`Couldn’t delete “${zap.name}”: ${apiErrorMessage(err)}`);
    } finally {
      this.setBusy(zap.id, false);
    }
  }

  protected triggerLabel(zap: Zap): string {
    return this.catalog.trigger(zap.trigger.app, zap.trigger.event)?.label ?? zap.trigger.event;
  }

  protected actionLabel(zap: Zap): string {
    return this.catalog.action(zap.action.app, zap.action.type)?.label ?? zap.action.type;
  }

  protected loadErrorMessage(): string {
    return apiErrorMessage(this.zaps.error(), 'Couldn’t load your Zaps.');
  }

  private setBusy(id: string, isBusy: boolean): void {
    this.busy.update((current) => {
      const next = new Set(current);
      if (isBusy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }
}
