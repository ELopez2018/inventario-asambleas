import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { RoleCode, RoleResponse } from '../../../models/auth.model';
import { UserResponse } from '../../../models/user.model';

@Component({
  selector: 'app-admin-credentials',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './admin-credentials.component.html',
  styleUrl: './admin-credentials.component.css',
})
export class AdminCredentialsComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);

  readonly createForm = this.fb.group({
    userId: [0, [Validators.required, Validators.min(1)]],
    username: ['', [Validators.required, Validators.maxLength(100)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    passwordChangeRequired: [true],
    roles: this.fb.control<RoleCode[]>(['USER'], [Validators.required]),
  });

  readonly resetPasswordForm = this.fb.group({
    userId: [0, [Validators.required, Validators.min(1)]],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
    passwordChangeRequired: [true],
  });

  readonly changeRequiredForm = this.fb.group({
    userId: [0, [Validators.required, Validators.min(1)]],
    required: [true],
  });

  readonly rolesForm = this.fb.group({
    userId: [0, [Validators.required, Validators.min(1)]],
    roles: this.fb.control<RoleCode[]>(['USER'], [Validators.required]),
  });
  readonly canCreateCredential = computed(() =>
    this.auth.canAccessAction('ADMIN_CREDENTIALS', 'create'),
  );
  readonly canSetPassword = computed(() =>
    this.auth.canAccessAction('ADMIN_CREDENTIALS', 'setPassword'),
  );
  readonly canForcePasswordChange = computed(() =>
    this.auth.canAccessAction('ADMIN_CREDENTIALS', 'forcePasswordChange'),
  );
  readonly canSetRoles = computed(() => this.auth.canAccessAction('ADMIN_CREDENTIALS', 'setRoles'));

  users: UserResponse[] = [];
  rolesCatalog: RoleResponse[] = [];
  loading = false;
  saving = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    if (!this.auth.hasRole('SUPER')) {
      this.errorMessage = 'Acceso no autorizado para administrar credenciales.';
      return;
    }

    this.loading = true;

    forkJoin({
      users: this.userService.getAll(),
      roles: this.auth.listRoles(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ users, roles }) => {
          this.users = users;
          this.rolesCatalog = roles;
        },
        error: () => {
          this.errorMessage = 'No se pudieron cargar usuarios y roles.';
        },
      });
  }

  onUserSelected(userId: number): void {
    const selectedUser = this.users.find((user) => user.id === Number(userId));

    if (!selectedUser) {
      return;
    }

    const suggestedUsername = selectedUser.email?.trim() || '';

    this.createForm.patchValue({
      userId: selectedUser.id,
      username: suggestedUsername,
    });

    this.resetPasswordForm.patchValue({ userId: selectedUser.id });
    this.changeRequiredForm.patchValue({ userId: selectedUser.id });
    this.rolesForm.patchValue({ userId: selectedUser.id });
  }

  createCredential(): void {
    if (!this.canCreateCredential()) {
      return;
    }

    if (this.createForm.invalid || this.saving) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const raw = this.createForm.getRawValue();

    this.auth
      .createCredential(raw.userId, {
        username: raw.username.trim(),
        password: raw.password,
        passwordChangeRequired: raw.passwordChangeRequired,
        roles: raw.roles,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Credencial creada correctamente.';
        },
        error: (err) => {
          this.errorMessage = this.resolveError(err, 'No se pudo crear la credencial.');
        },
      });
  }

  setUserPassword(): void {
    if (!this.canSetPassword()) {
      return;
    }

    if (this.resetPasswordForm.invalid || this.saving) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const raw = this.resetPasswordForm.getRawValue();

    this.auth
      .setUserPassword(raw.userId, {
        newPassword: raw.newPassword,
        passwordChangeRequired: raw.passwordChangeRequired,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Contrasena temporal actualizada.';
        },
        error: (err) => {
          this.errorMessage = this.resolveError(
            err,
            'No se pudo actualizar la contrasena temporal.',
          );
        },
      });
  }

  setPasswordChangeRequired(): void {
    if (!this.canForcePasswordChange()) {
      return;
    }

    if (this.changeRequiredForm.invalid || this.saving) {
      this.changeRequiredForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const raw = this.changeRequiredForm.getRawValue();

    this.auth
      .setPasswordChangeRequired(raw.userId, { required: raw.required })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.successMessage =
            'Estado de cambio obligatorio de contrasena actualizado correctamente.';
        },
        error: (err) => {
          this.errorMessage = this.resolveError(
            err,
            'No se pudo actualizar el estado de cambio obligatorio.',
          );
        },
      });
  }

  setUserRoles(): void {
    if (!this.canSetRoles()) {
      return;
    }

    if (this.rolesForm.invalid || this.saving) {
      this.rolesForm.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    const raw = this.rolesForm.getRawValue();

    this.auth
      .setUserRoles(raw.userId, { roles: raw.roles })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          this.successMessage = 'Roles actualizados correctamente.';
        },
        error: (err) => {
          this.errorMessage = this.resolveError(err, 'No se pudieron actualizar los roles.');
        },
      });
  }

  private resolveError(err: any, fallbackMessage: string): string {
    if (err?.status === 403) {
      return 'Acceso no autorizado: se requiere rol SUPER.';
    }

    if (err?.status === 404) {
      return err?.error?.detail || 'Usuario o credencial no encontrados.';
    }

    if (err?.status === 409) {
      return err?.error?.detail || 'La credencial ya existe o el username esta en uso.';
    }

    if (err?.status === 400) {
      return err?.error?.detail || err?.error?.message || 'Datos invalidos en el formulario.';
    }

    return fallbackMessage;
  }
}
