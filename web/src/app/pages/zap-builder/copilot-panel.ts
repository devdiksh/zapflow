import { Component, ElementRef, effect, inject, input, output, signal, viewChild } from '@angular/core';

import { apiErrorMessage } from '../../core/api-error';
import { CopilotResult, CopilotService } from '../../core/copilot.service';
import { ZapInput } from '../../core/models';

const EXAMPLES = [
  'When a pull request is opened, comment thanks',
  'Welcome people who open a PR and link them to CONTRIBUTING.md',
];

/**
 * "Build with Copilot": describe a Zap in plain English and the builder form
 * below is filled in. The draft is never turned on; the user reviews it first.
 */
@Component({
  selector: 'app-copilot-panel',
  template: `
    <section class="panel">
      <div class="head">
        <span class="spark" aria-hidden="true">✨</span>
        <strong>Build with Copilot</strong>
        <span class="muted">Describe the Zap, then review the form below before turning it on.</span>
      </div>

      @if (copilot.status.isLoading()) {
        <p class="muted small">Checking Copilot…</p>
      } @else if (!copilot.status.value()?.enabled) {
        <p class="muted small">
          Copilot isn’t configured. Set <code>ANTHROPIC_API_KEY</code> in <code>server/.env</code> and restart
          the server to describe Zaps in plain English.
        </p>
      } @else {
        <form class="row" (submit)="submit($event)">
          <label class="sr-only" for="copilot-prompt">Describe your Zap</label>
          <input
            id="copilot-prompt"
            class="input"
            [value]="prompt()"
            (input)="prompt.set(promptInput.value)"
            placeholder="e.g. When a pull request is opened, comment thanks"
            maxlength="500"
            [disabled]="busy()"
            #promptInput
          />
          <button type="submit" class="btn btn-primary" [disabled]="busy() || prompt().trim().length < 3">
            {{ busy() ? 'Drafting…' : 'Draft Zap' }}
          </button>
        </form>

        <div class="examples">
          <span class="muted small">Try:</span>
          @for (example of examples; track example) {
            <button type="button" class="example" [disabled]="busy()" (click)="prompt.set(example)">
              {{ example }}
            </button>
          }
        </div>

        @if (error(); as message) {
          <p class="error-banner small" role="alert">{{ message }}</p>
        }
        @if (result(); as r) {
          <p class="result small" [class.unsupported]="!r.supported" role="status">
            @if (r.supported) {
              <strong>Draft ready.</strong>
            }
            {{ r.message }}
          </p>
        }
      }
    </section>
  `,
  styles: `
    .panel { margin-bottom: 20px; padding: 16px; border: 1px solid #d9d4fb; border-radius: var(--radius); background: linear-gradient(180deg, #f7f5ff, var(--surface)); }
    .head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 8px; margin-bottom: 12px; }
    .head .muted { font-size: 12px; }
    .row { display: flex; gap: 8px; }
    .examples { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 8px; }
    .example { padding: 2px 10px; border: 1px solid var(--border); border-radius: 999px; background: var(--surface); color: var(--text-muted); font: inherit; font-size: 12px; cursor: pointer; }
    .example:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
    .small { margin: 10px 0 0; font-size: 13px; }
    .result { padding: 8px 12px; border-radius: var(--radius-sm); background: var(--success-soft); color: #14653a; }
    .result.unsupported { background: var(--warning-soft); color: #7a5300; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  `,
})
export class CopilotPanel {
  protected readonly copilot = inject(CopilotService);
  protected readonly examples = EXAMPLES;

  /** Focus the prompt as soon as it's shown (arriving from "Build with Copilot"). */
  readonly autofocus = input(false);
  /** Emitted with a draft to load into the builder (never enabled). */
  readonly drafted = output<ZapInput>();

  private readonly promptInput = viewChild<ElementRef<HTMLInputElement>>('promptInput');

  protected readonly prompt = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<CopilotResult | null>(null);

  constructor() {
    effect(() => {
      const input = this.promptInput();
      if (input && this.autofocus()) {
        input.nativeElement.focus();
      }
    });
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    const prompt = this.prompt().trim();
    if (prompt.length < 3 || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    this.result.set(null);
    try {
      const result = await this.copilot.draft(prompt);
      this.result.set(result);
      if (result.draft) {
        this.drafted.emit({ ...result.draft, enabled: false });
      }
    } catch (err) {
      this.error.set(apiErrorMessage(err, 'Copilot couldn’t draft that. Try again.'));
    } finally {
      this.busy.set(false);
    }
  }
}
