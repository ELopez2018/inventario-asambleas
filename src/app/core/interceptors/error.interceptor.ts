import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { EventContextService } from '../services/event-context.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const eventContext = inject(EventContextService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((err) => {
      const isLoginRequest = req.url.includes('/auth/login');
      const requiresPasswordChange =
        err.error?.requiredAction === 'CHANGE_PASSWORD' ||
        err.error?.errorCode === 'INV-AUTH-PASSWORD-CHANGE-REQUIRED';
      const activeEventConflict = err.error?.errorCode === 'INV-EVENT-ACTIVE-409';
      const transportRequestProblem = [
        'INV-TRANSPORT-REQUEST-STOCK-001',
        'INV-TRANSPORT-REQUEST-STORE-001',
        'INV-TRANSPORT-REQUEST-ITEM-001',
      ].includes(err.error?.errorCode);

      if (err.status === 401 && !isLoginRequest) {
        auth.clearSession();
        snackBar.open('Su sesion expiro. Inicie sesion nuevamente.', 'Cerrar', { duration: 4000 });
        void router.navigate(['/login']);
      } else if (err.status === 403 && requiresPasswordChange) {
        void router.navigate(['/change-password']);
      } else if (err.status === 409 && activeEventConflict) {
        snackBar.open(
          err.error?.userMessage || err.error?.detail || 'Otro usuario ya activo un evento.',
          'Cerrar',
          { duration: 6000 },
        );
        eventContext.loadActiveEvent();
      } else if (err.status === 400 && transportRequestProblem) {
        snackBar.open(
          err.error?.userMessage || err.error?.detail || 'La solicitud de transporte no es valida.',
          'Cerrar',
          { duration: 7000 },
        );
      } else if (err.status === 0) {
        snackBar.open('Sin conexion con el servidor.', 'Cerrar', { duration: 4000 });
      } else if (err.status === 403) {
        snackBar.open('No tiene permisos para esta accion.', 'Cerrar', { duration: 4000 });
      } else if (err.status === 404) {
        snackBar.open('Recurso no encontrado.', 'Cerrar', { duration: 4000 });
      } else if (err.status >= 500) {
        snackBar.open('Error interno del servidor.', 'Cerrar', { duration: 4000 });
      }

      return throwError(() => err);
    }),
  );
};
