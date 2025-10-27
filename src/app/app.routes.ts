import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Neighborhoods } from './pages/neighborhoods/neighborhoods';
import { Users } from './pages/users/users';
import { Mapa } from './pages/mapa/mapa';
import { AdminLayout } from './layouts/admin';

export const routes: Routes = [
  { path: '', component: Login },

  {
    path: '',
    component: AdminLayout, // 👈 layout del panel
    children: [
      { path: 'dashboard', redirectTo: 'neighborhoods', pathMatch: 'full' },
      { path: 'neighborhoods', component: Neighborhoods },
      { path: 'users', component: Users },
      { path: 'mapa', component: Mapa }
    ]
  },

  { path: '**', redirectTo: '' }
];
