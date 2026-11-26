import { Component } from '@angular/core';

@Component({
  selector: 'app-logo',
  template: `
    <span class="mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" fill="currentColor" /></svg>
    </span>
    <span class="word">ZapFlow</span>
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 16px; color: var(--text); }
    .mark { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--accent); color: #fff; }
  `,
})
export class Logo {}
