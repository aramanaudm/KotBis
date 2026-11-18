import type { Routes } from '@angular/router';

import { staffGuard } from './admin-signalements/staff.guard';

export const routes: Routes = [
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
    path: 'signalements',
    loadComponent: () => import('./community/report-list.page').then((m) => m.ReportListPage),
  },
  {
    path: 'admin/signalements',
    canActivate: [staffGuard],
    loadComponent: () =>
      import('./admin-signalements/admin-signalements.page').then((m) => m.AdminSignalementsPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];