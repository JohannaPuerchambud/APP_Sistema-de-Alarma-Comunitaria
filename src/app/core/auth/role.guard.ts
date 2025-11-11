import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

export function roleGuard(roles: (1|2|3)[] = []) {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLogged()) return router.parseUrl('/login');

    // Usuario final fuera del web
    if (auth.isUsuario()) return router.parseUrl('/login?denied=role');

    if (roles.length && !auth.hasAny(roles)) return router.parseUrl('/');
    return true;
  };
}
