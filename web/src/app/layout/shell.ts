import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../core/auth.service';
import { Logo } from './logo';

/** Signed-in layout: header with nav, avatar and sign out. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Logo],
  template: `
    <header class="header">
      <div class="inner">
        <a routerLink="/zaps" class="brand"><app-logo /></a>
        <nav>
          <a routerLink="/zaps" routerLinkActive="active">Zaps</a>
        </nav>
        <span class="spacer"></span>
        @if (auth.user(); as user) {
          <div class="user">
            @if (user.avatarUrl) {
              <img [src]="user.avatarUrl" alt="" width="28" height="28" />
            }
            <span class="login">{{ user.login }}</span>
            <button type="button" class="btn btn-sm btn-ghost" (click)="auth.signOut()">Sign out</button>
          </div>
        }
      </div>
    </header>
    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    .header { position: sticky; top: 0; z-index: 10; background: var(--surface); border-bottom: 1px solid var(--border); }
    .inner { display: flex; align-items: center; gap: 24px; max-width: 920px; height: 56px; margin: 0 auto; padding: 0 24px; }
    .brand:hover { text-decoration: none; }
    nav a { color: var(--text-muted); font-weight: 500; padding: 6px 2px; }
    nav a.active { color: var(--text); box-shadow: inset 0 -2px 0 var(--accent); }
    nav a:hover { color: var(--text); text-decoration: none; }
    .spacer { flex: 1; }
    .user { display: flex; align-items: center; gap: 8px; }
    .user img { border-radius: 50%; border: 1px solid var(--border); }
    .login { font-weight: 500; }
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
}
