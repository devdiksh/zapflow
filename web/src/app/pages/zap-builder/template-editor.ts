import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  input,
  model,
  viewChild,
} from '@angular/core';

import { FieldDef } from '../../core/models';
import { renderTemplate, unknownPlaceholders } from '../../shared/render-template';

/**
 * Field mapping: a template textarea, chips that insert the trigger's
 * fields at the cursor, and a live preview filled with sample data.
 */
@Component({
  selector: 'app-template-editor',
  template: `
    <textarea
      #textarea
      class="textarea"
      [id]="inputId()"
      [value]="value()"
      (input)="value.set(textarea.value)"
      rows="4"
      spellcheck="true"
    ></textarea>

    <div class="chips" aria-label="Insert a field">
      <span class="chips-label">Insert data from the trigger:</span>
      @for (field of fields(); track field.key) {
        <button type="button" class="chip" (click)="insert(field)" [title]="'Inserts ' + token(field.key)">
          <span class="plus">+</span> {{ field.label }}
        </button>
      }
    </div>

    @if (unknown().length) {
      <p class="warn">
        Unknown field{{ unknown().length > 1 ? 's' : '' }}:
        @for (key of unknown(); track key) {
          <code>{{ token(key) }}</code>&nbsp;
        }
        will be posted as typed.
      </p>
    }

    <div class="preview">
      <div class="preview-head">
        <span>Preview</span>
        <span class="muted">with sample data</span>
      </div>
      <div class="preview-body">{{ preview() || 'Your comment will appear here.' }}</div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .chips { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .chips-label { font-size: 12px; color: var(--text-muted); margin-right: 2px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border: 1px solid var(--accent-soft); border-radius: 999px; background: var(--accent-soft); color: var(--accent); font: inherit; font-size: 12px; font-weight: 500; cursor: pointer; }
    .chip:hover { border-color: var(--accent); }
    .plus { font-weight: 700; }
    .warn { margin: 8px 0 0; padding: 6px 10px; border-radius: var(--radius-sm); background: var(--warning-soft); font-size: 12px; }
    .preview { margin-top: 14px; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .preview-head { display: flex; gap: 6px; padding: 6px 12px; background: var(--surface-muted); border-bottom: 1px solid var(--border); font-size: 12px; font-weight: 600; }
    .preview-head .muted { font-weight: 400; }
    .preview-body { padding: 12px; white-space: pre-wrap; word-break: break-word; }
  `,
})
export class TemplateEditor {
  readonly value = model.required<string>();
  readonly fields = input.required<FieldDef[]>();
  readonly inputId = input('template');

  private readonly textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea');
  private readonly injector = inject(Injector);

  protected readonly preview = computed(() =>
    renderTemplate(this.value(), Object.fromEntries(this.fields().map((field) => [field.key, field.sample]))),
  );

  protected readonly unknown = computed(() =>
    unknownPlaceholders(this.value(), this.fields().map((field) => field.key)),
  );

  /** `{{key}}`, built in code because `{{` in a template would start an interpolation. */
  protected token(key: string): string {
    return `{{${key}}}`;
  }

  /** Inserts `{{key}}` where the cursor is (or replaces the selection). */
  protected insert(field: FieldDef): void {
    const el = this.textarea().nativeElement;
    const token = this.token(field.key);
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    this.value.set(el.value.slice(0, start) + token + el.value.slice(end));

    // Put the caret after the inserted field once Angular has updated the textarea.
    afterNextRender(
      () => {
        el.focus();
        el.setSelectionRange(start + token.length, start + token.length);
      },
      { injector: this.injector },
    );
  }
}
