import type { Routes } from '@angular/router';

import { staffGuard } from './admin-signalements/staff.guard';

export const routes: Routes = [
  {
    path: 'favoris',
    loadComponent: () => import('./favoris/favoris.page').then((m) => m.FavorisPage),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
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
    redirectTo: 'favoris',
    pathMatch: 'full',
  },
];