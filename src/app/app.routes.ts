import { Routes } from '@angular/router';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  // Pág. de inicio: puedes mandarla a login o a dashboard (según tu flujo)
  { path: '', pathMatch: 'full', redirectTo: 'login' },

  // Login sin layout
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },

  // Shell con sidebar: TODAS las rutas hijas pasan por AdminLayout
  {
    path: '',
    // usa loadComponent si el AdminLayout es standalone (Angular 15+)
    loadComponent: () => import('./layouts/admin').then(m => m.AdminLayout),
    // Bloquea el shell completo para Admin General (1) o Admin de Barrio (2)
    canActivate: [roleGuard([1, 2])],
    children: [
      
      {
        path: 'users',
        canActivate: [roleGuard([1, 2])],
        loadComponent: () => import('./pages/users/users').then(m => m.Users)
      },
      {
        path: 'neighborhoods',
        // Solo Admin General
        canActivate: [roleGuard([1])],
        loadComponent: () => import('./pages/neighborhoods/neighborhoods').then(m => m.Neighborhoods)
      },
      {
        path: 'mapa',
        canActivate: [roleGuard([1, 2])],
        loadComponent: () => import('./pages/mapa/mapa').then(m => m.Mapa)
      },
      // redirección por si alguien entra solo a "/"
      { path: '', pathMatch: 'full', redirectTo: 'users' },
    ]
  },

  // wildcard
  { path: '**', redirectTo: '' }
];
