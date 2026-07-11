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
  templateUrl: './user-form.component.html',
  styleUrl: './user-form.component.css',
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
