import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { CreateUserRequest } from '../../../models/user.model';

@Component({
  selector: 'app-user-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <section class="mx-auto max-w-3xl">
      <div class="mb-5">
        <a routerLink="/users" class="inline-flex items-center gap-1 text-sm font-medium text-indigo-700">
          <mat-icon class="text-base">arrow_back</mat-icon>
          Usuarios
        </a>
        <h1 class="mt-3 text-2xl font-semibold text-slate-950">
          {{ userId ? 'Editar usuario' : 'Nuevo usuario' }}
        </h1>
      </div>

      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        @if (loading) {
          <div class="flex justify-center p-8">
            <mat-spinner diameter="36" />
          </div>
        } @else {
          <div class="grid gap-4 md:grid-cols-2">
            <mat-form-field appearance="outline">
              <mat-label>Nombre</mat-label>
              <input matInput formControlName="firstName" maxlength="100" />
              @if (form.controls.firstName.hasError('required')) {
                <mat-error>El nombre es obligatorio.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Apellido</mat-label>
              <input matInput formControlName="lastName" maxlength="100" />
              @if (form.controls.lastName.hasError('required')) {
                <mat-error>El apellido es obligatorio.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Telefono</mat-label>
              <input matInput formControlName="phone" maxlength="30" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Email</mat-label>
              <input matInput type="email" formControlName="email" maxlength="150" />
              @if (form.controls.email.hasError('required')) {
                <mat-error>El email es obligatorio.</mat-error>
              } @else if (form.controls.email.hasError('email')) {
                <mat-error>Ingrese un email valido.</mat-error>
              }
            </mat-form-field>
          </div>

          @if (errorMessage) {
            <div class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ errorMessage }}
            </div>
          }

          <div class="flex justify-end gap-2">
            <a mat-button routerLink="/users">Cancelar</a>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving">
              @if (saving) {
                <mat-spinner diameter="18" class="mr-2 inline-block" />
              }
              Guardar
            </button>
          </div>
        }
      </form>
    </section>
  `,
})
export class UserFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly userService = inject(UserService);

  readonly userId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly form = this.fb.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
  });

  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit() {
    if (!this.userId) {
      return;
    }

    this.loading = true;
    this.userService
      .getById(this.userId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (user) =>
          this.form.patchValue({
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone ?? '',
            email: user.email,
          }),
        error: () => (this.errorMessage = 'No se pudo cargar el usuario.'),
      });
  }

  submit() {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const raw = this.form.getRawValue();
    const body: CreateUserRequest = {
      firstName: raw.firstName.trim(),
      lastName: raw.lastName.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim() || undefined,
    };

    const request = this.userId
      ? this.userService.update(this.userId, body)
      : this.userService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/users']),
      error: () => (this.errorMessage = 'No se pudo guardar el usuario.'),
    });
  }
}
