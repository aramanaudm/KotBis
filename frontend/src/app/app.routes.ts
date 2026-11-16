import type { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'alertes',
    loadComponent: () => import('./alertes/alertes.page').then((m) => m.AlertesPage),
  },
  {
    path: 'favoris',
    loadComponent: () => import('./favoris/favoris.page').then((m) => m.FavorisPage),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'favoris',
    pathMatch: 'full',
  },
];
