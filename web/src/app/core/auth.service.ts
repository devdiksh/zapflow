import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { User } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** `undefined` until the first /api/auth/me call finishes, then the user or `null`. */
  private readonly currentUser = signal<User | null | undefined>(undefined);
  readonly user = this.currentUser.asReadonly();

  private pending: Promise<User | null> | null = null;

  /** Resolves the session once; route guards call this on every navigation. */
  ensureLoaded(): Promise<User | null> {
    const known = this.currentUser();
    if (known !== undefined) {
      return Promise.resolve(known);
    }
    this.pending ??= firstValueFrom(this.http.get<User>('/api/auth/me'))
      .catch(() => null)
      .then((user) => {
        this.currentUser.set(user);
        this.pending = null;
        return user;
      });
    return this.pending;
  }

  /** Full-page redirect: the OAuth dance happens on the server and GitHub. */
  signIn(): void {
    window.location.href = '/api/auth/github';
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.sessionExpired();
    }
  }

  /** Called when the API says we're no longer signed in. */
  sessionExpired(): void {
    this.currentUser.set(null);
    void this.router.navigate(['/login']);
  }
}
