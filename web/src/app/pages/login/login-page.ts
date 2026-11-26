import { Component, computed, inject, input } from '@angular/core';

import { AuthService } from '../../core/auth.service';
import { Logo } from '../../layout/logo';

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: 'You cancelled the GitHub sign-in.',
  state_mismatch: 'Your sign-in attempt expired. Please try again.',
  oauth_failed: 'GitHub sign-in failed. Please try again.',
};

@Component({
  selector: 'app-login-page',
  imports: [Logo],
  template: `
    <div class="wrap">
      <div class="card panel">
        <app-logo />
        <h1>Automate your GitHub workflow</h1>
        <p class="muted">
          Connect a trigger to an action. For example, comment on every pull request the moment it's opened.
        </p>

        @if (errorMessage(); as message) {
          <p class="error-banner" role="alert">{{ message }}</p>
        }

        <button type="button" class="btn btn-primary github" (click)="auth.signIn()">
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
            <path
              fill="currentColor"
              d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"
            />
          </svg>
          Sign in with GitHub
        </button>
        <p class="hint">
          We ask for access to your repositories so ZapFlow can add a webhook and post comments for you.
        </p>
      </div>
    </div>
  `,
  styles: `
    .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
    .panel { width: 100%; max-width: 420px; padding: 32px; display: flex; flex-direction: column; gap: 16px; }
    h1 { font-size: 22px; }
    p { margin: 0; }
    .github { height: 42px; background: #1f2328; border-color: #1f2328; }
    .github:hover:not(:disabled) { background: #000; }
  `,
})
export class LoginPage {
  protected readonly auth = inject(AuthService);

  /** `?error=...` set by the server when the OAuth callback fails (bound via withComponentInputBinding). */
  readonly error = input<string>();

  protected readonly errorMessage = computed(() => {
    const code = this.error();
    return code ? (ERROR_MESSAGES[code] ?? ERROR_MESSAGES['oauth_failed']) : null;
  });
}
