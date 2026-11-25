import { Component, inject } from '@angular/core';

import { AuthService } from '../../core/auth.service';

/** Placeholder until the Zap list lands (feat/zap-builder-ui). */
@Component({
  selector: 'app-zaps-page',
  template: `
    <div class="page">
      <h1>Your Zaps</h1>
      <p class="muted">Signed in as {{ auth.user()?.login }}. Zaps will show up here.</p>
    </div>
  `,
})
export class ZapsPage {
  protected readonly auth = inject(AuthService);
}
