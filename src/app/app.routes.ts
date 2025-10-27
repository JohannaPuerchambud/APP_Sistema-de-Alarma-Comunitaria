import { Routes } from '@angular/router';
import { Login } from './pages/login/login';
import { Dashboard } from './pages/dashboard/dashboard';
import { Neighborhoods } from './pages/neighborhoods/neighborhoods';
import { Users } from './pages/users/users';
import {Mapa} from './pages/mapa/mapa';

export const routes: Routes = [
    { path: '', component: Login },
    { path: 'dashboard', component: Dashboard },
    { path: 'neighborhoods', component: Neighborhoods },
    { path: 'users', component: Users },
    {path: 'mapa', component: Mapa},
    { path: '**', redirectTo: '' }
];
