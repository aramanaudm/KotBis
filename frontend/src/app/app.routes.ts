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
        path: 'avis',
        loadComponent: () => import('./community/review-list.page').then((m) => m.ReviewListPage),
      },
    ],
  },
  { path: 'avis', redirectTo: 'home/avis', pathMatch: 'full' },
  {
    path: '',
    redirectTo: 'favoris',
    pathMatch: 'full',
  },
];
