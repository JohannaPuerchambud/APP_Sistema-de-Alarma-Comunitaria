import { Routes } from '@angular/router';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadComponent: () => import('./pages/login/login').then((m) => m.Login) },
  {
    path: '',
    loadComponent: () => import('./layouts/admin').then((m) => m.AdminLayout),
    canActivate: [roleGuard([1, 2])],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      {
        path: 'dashboard',
        canActivate: [roleGuard([1, 2])],
        loadComponent: () =>
          import('./pages/map-viewer/map-viewer').then((m) => m.MapViewerComponent),
      },

      {
        path: 'users',
        canActivate: [roleGuard([1, 2])],
        loadComponent: () => import('./pages/users/users').then((m) => m.Users),
      },
      {
        path: 'neighborhoods',
        canActivate: [roleGuard([1])],
        loadComponent: () =>
          import('./pages/neighborhoods/neighborhoods').then((m) => m.Neighborhoods),
      },
      { path: 'map-viewer', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'upcs',
        canActivate: [roleGuard([1])],
        loadComponent: () => import('./pages/upcs/upcs').then((m) => m.UpcsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
