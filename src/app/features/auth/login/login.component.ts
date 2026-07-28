import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { of, switchMap, map } from 'rxjs';
import { AppIdentityService } from '../../../core/services/app-identity.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly appIdentity = inject(AppIdentityService);

  readonly form = this.fb.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  loading = false;
  errorMessage = '';
  hidePassword = true;

  submit() {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.auth
      .login(this.form.getRawValue())
      .pipe(
        switchMap((res) =>
          res.passwordChangeRequired
            ? of(res)
            : this.auth.loadMyScreens().pipe(map(() => res)),
        ),
      )
      .subscribe({
      next: (res) => {
        const targetRoute = res.passwordChangeRequired ? '/change-password' : '/dashboard';
        void this.router.navigate([targetRoute]);
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage =
          err.status === 401
            ? 'Usuario o contrasena incorrectos.'
            : 'Error del servidor. Intente mas tarde.';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }
}
