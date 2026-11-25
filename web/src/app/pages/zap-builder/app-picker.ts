import { Component, input, model } from '@angular/core';

import { AppDef } from '../../core/models';
import { AppIcon } from '../../shared/app-icon';

/**
 * Grid of developer tools. Apps that don't run yet are shown (so people see
 * where the product is going) but can't be picked.
 */
@Component({
  selector: 'app-app-picker',
  imports: [AppIcon],
  template: `
    <div class="grid" role="radiogroup" [attr.aria-label]="role() === 'trigger' ? 'Trigger app' : 'Action app'">
      @for (app of apps(); track app.id) {
        @let available = app.status === 'available';
        <button
          type="button"
          role="radio"
          class="tile"
          [class.selected]="selected() === app.id"
          [attr.aria-checked]="selected() === app.id"
          [disabled]="!available"
          [title]="available ? app.description : comingSoonHint(app)"
          (click)="selected.set(app.id)"
        >
          <app-app-icon [app]="app" [size]="28" />
          <span class="name">{{ app.name }}</span>
          @if (!available) {
            <span class="soon">Coming soon</span>
          }
        </button>
      }
    </div>
  `,
  styles: `
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(124px, 1fr)); gap: 8px; }
    .tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px 8px; border: 1px solid var(--border); border-radius: var(--radius); background: var(--surface); font: inherit; cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
    .tile:hover:not(:disabled) { border-color: var(--accent); }
    .tile.selected { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
    .tile:disabled { cursor: not-allowed; background: var(--surface-muted); }
    .tile:disabled app-app-icon { filter: grayscale(1); opacity: 0.45; }
    .name { font-weight: 600; font-size: 13px; }
    .tile:disabled .name { color: var(--text-subtle); }
    .soon { font-size: 11px; color: var(--text-subtle); }
  `,
})
export class AppPicker {
  readonly apps = input.required<AppDef[]>();
  readonly role = input.required<'trigger' | 'action'>();
  readonly selected = model<string | null>(null);

  protected comingSoonHint(app: AppDef): string {
    const items = this.role() === 'trigger' ? app.triggers : app.actions;
    const examples = items.map((item) => item.label).join(', ');
    return `${app.name} is coming soon${examples ? `: ${examples}` : ''}`;
  }
}
