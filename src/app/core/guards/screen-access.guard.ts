import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const screenAccessGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const screenCode = route.data?.['screenCode'] as string | undefined;

  if (!screenCode) {
    return true;
  }

  if (screenCode === 'DASHBOARD') {
    return true;
  }

  return auth.ensureMyScreensLoaded().pipe(
    map(() => {
      if (auth.canAccessScreen(screenCode) || auth.canAccessRoute(state.url)) {
        return true;
      }

      return router.createUrlTree(['/dashboard']);
    }),
    catchError(() => of(router.createUrlTree(['/dashboard']))),
  );
};
