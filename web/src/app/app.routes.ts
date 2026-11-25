import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth.guard';
import { Shell } from './layout/shell';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in · ZapFlow',
    loadComponent: () => import('./pages/login/login-page').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      {
        path: 'zaps',
        title: 'Zaps · ZapFlow',
        loadComponent: () => import('./pages/zaps/zaps-page').then((m) => m.ZapsPage),
      },
      {
        path: 'zaps/new',
        title: 'New Zap · ZapFlow',
        loadComponent: () =>
          import('./pages/zap-builder/zap-builder-page').then((m) => m.ZapBuilderPage),
      },
      {
        path: 'zaps/:id',
        title: 'Edit Zap · ZapFlow',
        loadComponent: () =>
          import('./pages/zap-builder/zap-builder-page').then((m) => m.ZapBuilderPage),
      },
      { path: '', pathMatch: 'full', redirectTo: 'zaps' },
    ],
  },
  { path: '**', redirectTo: '' },
];
