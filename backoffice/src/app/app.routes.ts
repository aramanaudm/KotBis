import { Routes } from '@angular/router';
import { adminGuard } from './core/auth/admin.guard';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
  {
    path: '',
    component: Shell,
    canActivate: [adminGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'tableau-de-bord',
      },
      {
        path: 'tableau-de-bord',
        title: 'Tableau de bord · KotBis',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page').then(
            (module) => module.DashboardPage,
          ),
      },
      {
        path: 'bus',
        title: 'Bus · KotBis',
        loadComponent: () =>
          import('./features/buses/pages/buses-page').then((module) => module.BusesPage),
      },
      {
        path: 'arrets',
        title: 'Arrêts · KotBis',
        loadComponent: () =>
          import('./features/stops/pages/stops-page').then((module) => module.StopsPage),
      },
      {
        path: 'trajets',
        title: 'Trajets · KotBis',
        loadComponent: () =>
          import('./features/routes/pages/routes-page').then((module) => module.RoutesPage),
      },
      {
        path: 'zones',
        title: 'Zones · KotBis',
        loadComponent: () =>
          import('./features/zones/pages/zones-page').then((module) => module.ZonesPage),
      },
      {
        path: 'personnel',
        title: 'Personnel · KotBis',
        loadComponent: () =>
          import('./features/staff/pages/staff-page').then((module) => module.StaffPage),
      },
      {
        path: 'utilisateurs',
        title: 'Utilisateurs · KotBis',
        loadComponent: () =>
          import('./features/users/pages/users-page').then((module) => module.UsersPage),
      },
      {
        path: 'signalements',
        title: 'Signalements · KotBis',
        loadComponent: () =>
          import('./features/reports/pages/reports-page').then((module) => module.ReportsPage),
      },
      {
        path: 'avis',
        title: 'Avis · KotBis',
        loadComponent: () =>
          import('./features/reviews/pages/reviews-page').then((module) => module.ReviewsPage),
      },
      {
        path: 'points',
        title: 'Points · KotBis',
        loadComponent: () =>
          import('./features/points/pages/points-page').then((module) => module.PointsPage),
      },
      {
        path: '**',
        title: 'Page introuvable · KotBis',
        loadComponent: () =>
          import('./features/not-found/pages/not-found-page').then((module) => module.NotFoundPage),
      },
    ],
  },
];
