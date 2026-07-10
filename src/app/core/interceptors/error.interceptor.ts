import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((err) => {
      const isLoginRequest = req.url.includes('/auth/login');

      if (err.status === 401 && !isLoginRequest) {
        auth.clearSession();
        snackBar.open('Su sesion expiro. Inicie sesion nuevamente.', 'Cerrar', { duration: 4000 });
        void router.navigate(['/login']);
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
