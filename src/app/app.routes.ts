import { Routes } from '@angular/router';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', loadComponent: () => import('./pages/login/login').then(m => m.Login) },
  {
    path: '',
    loadComponent: () => import('./layouts/admin').then(m => m.AdminLayout),
    canActivate: [roleGuard([1, 2])],
    children: [
      // Redirección por defecto
      { path: '', pathMatch: 'full', redirectTo: 'map-viewer' }, // 👈 CAMBIO: Ir al visualizador
      
      {
        path: 'users',
        canActivate: [roleGuard([1, 2])],
        loadComponent: () => import('./pages/users/users').then(m => m.Users)
      },
      {
        path: 'neighborhoods',
        canActivate: [roleGuard([1])], // Solo Admin General
        loadComponent: () => import('./pages/neighborhoods/neighborhoods').then(m => m.Neighborhoods)
      },
      {
        path: 'map-delimit', // 👈 CAMBIO: Ruta para editar
        canActivate: [roleGuard([1])], // Solo Admin General
        loadComponent: () => import('./pages/mapa/mapa').then(m => m.Mapa)
      },
      {
        path: 'map-viewer', // 👈 NUEVA RUTA: Para visualizar
        canActivate: [roleGuard([1, 2])], // Admins pueden ver
        loadComponent: () => import('./pages/map-viewer/map-viewer').then(m => m.MapViewerComponent)
      },
    ]
  },
  { path: '**', redirectTo: '' }
];