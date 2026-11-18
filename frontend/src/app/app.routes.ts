import type { Routes } from '@angular/router';

export const routes: Routes = [
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
    redirectTo: 'favoris',
    pathMatch: 'full',
  },
];
