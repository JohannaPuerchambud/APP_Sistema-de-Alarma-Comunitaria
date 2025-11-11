import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    RouterLink,
    RouterLinkActive, // <- clave para routerLinkActive y routerLinkActiveOptions
    RouterOutlet
  ],
  templateUrl: './admin.html',
  styleUrls: ['./admin.css'] // <- plural
})
export class AdminLayout implements OnInit {
  userName: string = '';
  userRole: string = '';

  constructor(
    private router: Router,
    public auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        this.userName = decoded.name || 'Usuario';
        const role = decoded.role || decoded.role_id;

        if (role === 1 || role === '1') this.userRole = 'Admin General';
        else if (role === 2 || role === '2') this.userRole = 'Admin Barrio';
        else this.userRole = 'Usuario';
      } catch (error) {
        console.error('Error al decodificar token:', error);
      }
    }
  }

  logout() {
    localStorage.clear();
    this.router.navigate(['/']);
  }
}
