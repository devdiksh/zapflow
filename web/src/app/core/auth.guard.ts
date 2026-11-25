import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Only signed-in users get past; everyone else goes to /login. */
export const authGuard: CanActivateFn = async () => {
  const user = await inject(AuthService).ensureLoaded();
  return user ? true : inject(Router).createUrlTree(['/login']);
};

/** The login page is for signed-out users; signed-in users go straight to their Zaps. */
export const guestGuard: CanActivateFn = async () => {
  const user = await inject(AuthService).ensureLoaded();
  return user ? inject(Router).createUrlTree(['/zaps']) : true;
};
