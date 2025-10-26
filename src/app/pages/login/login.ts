import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth';

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
        this.auth.setToken(res.token);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        alert('Credenciales incorrectas');
        this.loading = false;
      }
    });
  }
}
