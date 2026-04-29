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
  passwordPattern = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

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

    if (!this.passwordPattern.test(this.password)) {
      this.errorMsg = 'La contraseña debe tener mínimo 8 caracteres e incluir letras y números.';
      return;
    }

    this.loading = true;

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: (res) => {
        this.auth.setToken(res.token);
        this.router.navigate(['/users']);
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Credenciales incorrectas';
        this.loading = false;
      },
    });
  }
}
