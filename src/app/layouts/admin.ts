import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { jwtDecode } from 'jwt-decode';


@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminLayout implements OnInit {
  userName: string = '';
  userRole: string = '';

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadUserData();
  }

  loadUserData() {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);

        // Asegúrate de usar los mismos nombres que usas en tu backend
        this.userName = decoded.name || 'Usuario';
        const role = decoded.role || decoded.role_id;

        // Traducción del rol numérico a texto legible
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
