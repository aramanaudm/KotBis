import type { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'favoris', loadComponent: () => import('./favoris/favoris.page').then((m) => m.FavorisPage) },
  { path: 'home', loadComponent: () => import('./home/home.page').then((m) => m.HomePage) },
  { path: 'mon-espace', loadComponent: () => import('./pages/mon-espace/mon-espace.page').then((m) => m.MonEspacePage) },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
];