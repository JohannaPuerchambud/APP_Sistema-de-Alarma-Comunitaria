// src/app/core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { jwtDecode } from 'jwt-decode';

type Claims = {
  id: number;
  name: string;
  last_name: string; 
  role: 1 | 2 | 3;
  neighborhood?: number | null;
  exp?: number;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://localhost:4000/api/auth';
  private key = 'token';

  constructor(private http: HttpClient) {}

  // =========================
  //  HTTP: login / register
  // =========================
  login(data: { email: string; password: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, data);
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  // =========================
  //  TOKEN EN LOCALSTORAGE
  // =========================
  get token(): string | null {
    return localStorage.getItem(this.key);
  }

  set token(t: string | null) {
    if (t) {
      localStorage.setItem(this.key, t);
    } else {
      localStorage.removeItem(this.key);
    }
  }

  // Métodos de compatibilidad con tu código actual
  setToken(token: string) { this.token = token; }
  getToken(): string | null { return this.token; }
  clearToken() { this.token = null; }

  // =========================
  //  CLAIMS / ROLES
  // =========================
  claims(): Claims | null {
    if (!this.token) return null;
    try {
      return jwtDecode<Claims>(this.token);
    } catch {
      return null;
    }
  }

  isLogged(): boolean {
    const c = this.claims();
    return !!c && (!c.exp || Date.now() / 1000 < c.exp);
  }

  role(): 1 | 2 | 3 | null {
    return this.claims()?.role ?? null;
  }

  neighborhood(): number | null {
    return (this.claims()?.neighborhood ?? null) as any;
  }

  isAdminGeneral() { return this.role() === 1; }
  isAdminBarrio()  { return this.role() === 2; }
  isUsuario()      { return this.role() === 3; }

  hasAny(roles: (1 | 2 | 3)[]) {
    const r = this.role();
    return !!r && roles.includes(r);
  }

  logout() {
    this.token = null;
  }
}
