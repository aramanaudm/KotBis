import type { Routes } from '@angular/router';

import { adminAccessGuard } from './core/auth/admin-access.guard';

export const routes: Routes = [
  // BUS-FE-053 : l'administration des signalements vit dans le back-office web.
  // Toute adresse /admin/... est refusée dans l'application voyageur.
  { path: 'admin', canMatch: [adminAccessGuard], children: [] },
  { path: 'mon-espace', loadComponent: () => import('./pages/mon-espace/mon-espace.page').then(m => m.MonEspacePage) },
  {
    path: 'favoris',
    loadComponent: () => import('./favoris/favoris.page').then((m) => m.FavorisPage),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
    children: [
      {
        path: 'signaler',
        loadComponent: () => import('./community/report-form.page').then((m) => m.ReportFormPage),
      },
      {
        path: 'avis/modifier/:id',
        loadComponent: () => import('./community/review-form.page').then((m) => m.ReviewFormPage),
      },
      {
        path: 'avis/nouveau',
        loadComponent: () => import('./community/review-form.page').then((m) => m.ReviewFormPage),
      },
      {
        path: 'avis',
        loadComponent: () => import('./community/review-list.page').then((m) => m.ReviewListPage),
      },
    ],
  },
  { path: 'avis', redirectTo: 'home/avis', pathMatch: 'full' },
  { path: 'signaler', redirectTo: 'home/signaler', pathMatch: 'full' },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];