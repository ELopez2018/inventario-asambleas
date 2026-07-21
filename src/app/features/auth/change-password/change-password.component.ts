import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-change-password',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      confirmNewPassword: ['', Validators.required],
    },
    {
      validators: (group) => {
        const newPassword = group.get('newPassword')?.value;
        const confirmNewPassword = group.get('confirmNewPassword')?.value;
        return newPassword === confirmNewPassword ? null : { passwordMismatch: true };
      },
    },
  );

  loading = false;
  errorMessage = '';
  successMessage = '';
  hideCurrentPassword = true;
  hideNewPassword = true;
  hideConfirmPassword = true;

  submit(): void {
    if (this.form.invalid || this.loading) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.auth.changePassword(this.form.getRawValue()).subscribe({
      next: () => {
        this.successMessage = 'Contrasena actualizada correctamente.';
        void this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;

        if (err.status === 400) {
          this.errorMessage =
            err.error?.detail ||
            err.error?.message ||
            'Datos invalidos para el cambio de contrasena.';
          return;
        }

        if (err.status === 401) {
          this.errorMessage = 'La contrasena actual no es valida.';
          return;
        }

        this.errorMessage = 'No se pudo actualizar la contrasena. Intente nuevamente.';
      },
      complete: () => {
        this.loading = false;
      },
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
