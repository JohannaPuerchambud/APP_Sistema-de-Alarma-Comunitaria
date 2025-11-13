// src/app/layouts/admin.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
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
    const claims = this.auth.claims();

    if (!claims) {
      this.userName = 'Usuario';
      this.userRole = '';
      return;
    }

    this.userName = claims.name || 'Usuario';

    const role = claims.role;
    if (role === 1)      this.userRole = 'Admin General';
    else if (role === 2) this.userRole = 'Admin Barrio';
    else                 this.userRole = 'Usuario';
  }

  logout() {
    this.auth.logout();              
    this.router.navigate(['/login']); 
  }
}
