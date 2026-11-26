import { Component, input, output } from '@angular/core';

/** An accessible on/off switch. The parent owns the state. */
@Component({
  selector: 'app-toggle',
  template: `
    <button
      type="button"
      role="switch"
      [attr.aria-checked]="checked()"
      [attr.aria-label]="label()"
      [disabled]="disabled()"
      (click)="toggled.emit(!checked())"
    >
      <span class="knob"></span>
    </button>
  `,
  styles: `
    button { position: relative; width: 40px; height: 22px; padding: 0; border: none; border-radius: 999px; background: var(--border-strong); cursor: pointer; transition: background 0.15s; }
    button[aria-checked='true'] { background: var(--success); }
    button:disabled { opacity: 0.5; cursor: progress; }
    button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .knob { position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%; background: #fff; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); transition: transform 0.15s; }
    button[aria-checked='true'] .knob { transform: translateX(18px); }
  `,
})
export class Toggle {
  readonly checked = input.required<boolean>();
  readonly disabled = input(false);
  readonly label = input('Toggle');
  readonly toggled = output<boolean>();
}
