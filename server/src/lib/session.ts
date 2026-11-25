import type { Request } from 'express';
import session, { type Store } from 'express-session';

import { env, isProduction } from '../config.js';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    /** Random value sent to GitHub during OAuth and checked on the way back (CSRF protection). */
    oauthState?: string;
  }
}

export const SESSION_COOKIE = 'zapflow.sid';

/**
 * Cookie session. `sameSite: 'lax'` means the cookie is sent on the top-level
 * redirect back from GitHub, but not on cross-site POSTs, which is our CSRF
 * protection for the JSON API.
 */
export function sessionMiddleware(store?: Store) {
  return session({
    name: SESSION_COOKIE,
    secret: env.SESSION_SECRET,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  });
}

/** Issues a fresh session id (prevents session fixation on login). */
export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => (err ? reject(err) : resolve()));
  });
}

export function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

export function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(err) : resolve()));
  });
}
