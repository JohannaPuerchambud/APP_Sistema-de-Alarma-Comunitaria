import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  email = '';
  password = '';
  loading = false;

  // 👁 mostrar/ocultar
  showPassword = false;

  // ✅ mínimo 8, letras y números
  // Mensaje de validación
  errorMsg = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  onLogin() {
    this.errorMsg = '';

    if (!this.email || !this.password) {
      this.errorMsg = 'Completa correo y contraseña.';
      return;
    }

    this.loading = true;

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.auth.setToken(res.token);

        if (!this.auth.hasAny([1, 2])) {
          this.auth.clearToken();
          this.errorMsg = 'Acceso exclusivo para administradores.';
          this.loading = false;
          return;
        }

        this.router.navigate(['/dashboard']);
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Credenciales incorrectas';
        this.loading = false;
      },
    });
  }
}
