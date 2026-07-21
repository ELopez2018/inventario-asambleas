import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const passwordChangeGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const currentUser = auth.getCurrentUser();

  if (currentUser?.passwordChangeRequired) {
    return router.createUrlTree(['/change-password']);
  }

  return true;
};
