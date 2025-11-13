import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class Login {
  email = '';
  password = '';
  loading = false;

  constructor(private auth: AuthService, private router: Router) {}

  onLogin() {
    if (!this.email || !this.password) return;

    this.loading = true;

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        // Guardar token usando el AuthService unificado
        this.auth.setToken(res.token);

        // Redirigir al mapa principal del panel
        this.router.navigate(['/users']);
      },
      error: () => {
        alert('Credenciales incorrectas');
        this.loading = false;
      }
    });
  }
}
