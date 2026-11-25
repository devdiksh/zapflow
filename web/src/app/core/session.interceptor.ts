import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AuthService } from './auth.service';

/**
 * If any API call comes back 401 (session expired, server restarted with a new
 * secret...), drop the local user and send them to the login page.
 * /api/auth/me is excluded: a 401 there is the normal "signed out" answer.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !req.url.endsWith('/api/auth/me')) {
        auth.sessionExpired();
      }
      return throwError(() => err);
    }),
  );
};
