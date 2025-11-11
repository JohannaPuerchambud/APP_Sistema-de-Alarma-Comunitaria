import { Injectable } from '@angular/core';
import { jwtDecode } from 'jwt-decode';

type Claims = {
  id: number;
  name: string;
  role: 1|2|3;
  neighborhood?: number|null;
  exp?: number;
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private key = 'token';

  get token(): string | null { return localStorage.getItem(this.key); }
  set token(t: string | null) { t ? localStorage.setItem(this.key, t) : localStorage.removeItem(this.key); }

  claims(): Claims | null {
    if (!this.token) return null;
    try { return jwtDecode<Claims>(this.token); } catch { return null; }
  }

  isLogged(): boolean {
    const c = this.claims();
    return !!c && (!c.exp || Date.now()/1000 < c.exp);
  }

  role(): 1|2|3 | null { return this.claims()?.role ?? null; }
  neighborhood(): number | null { return (this.claims()?.neighborhood ?? null) as any; }

  isAdminGeneral() { return this.role() === 1; }
  isAdminBarrio()  { return this.role() === 2; }
  isUsuario()      { return this.role() === 3; }

  hasAny(roles: (1|2|3)[]) { const r = this.role(); return !!r && roles.includes(r); }
  logout() { this.token = null; }
}
