import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import { UserResponse } from '../../../models/user.model';

function resolveBackendMessage(err: HttpErrorResponse, fallback: string): string {
  const problem = err.error as { message?: string; userMessage?: string; detail?: string } | null;

  return problem?.message ?? problem?.userMessage ?? problem?.detail ?? fallback;
}

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = ['name', 'email', 'phone', 'actions'];
  readonly canCreateUsers = computed(() => this.auth.canAccessAction('USERS', 'create'));
  readonly canEditUsers = computed(() => this.auth.canAccessAction('USERS', 'edit'));
  readonly canDeleteUsers = computed(() => this.auth.canAccessAction('USERS', 'delete'));
  readonly canResendWelcomeEmail = computed(() =>
    this.auth.canAccessAction('USERS', 'resendWelcomeEmail'),
  );
  users: UserResponse[] = [];
  loading = false;
  resendingWelcomeEmailUserId: number | null = null;
  errorMessage = '';

  ngOnInit() {
    this.loadUsers();
  }

  loadUsers() {
    this.loading = true;
    this.errorMessage = '';

    this.userService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (users) => (this.users = users),
        error: () => (this.errorMessage = 'No se pudieron cargar los usuarios.'),
      });
  }

  deleteUser(user: UserResponse) {
    const confirmed = confirm(`Eliminar a ${user.firstName} ${user.lastName}?`);

    if (!confirmed) {
      return;
    }

    this.userService.delete(user.id).subscribe({
      next: () => this.loadUsers(),
      error: () => (this.errorMessage = 'No se pudo eliminar el usuario.'),
    });
  }

  async resendWelcomeEmail(user: UserResponse) {
    if (!this.canResendWelcomeEmail() || this.resendingWelcomeEmailUserId !== null) {
      return;
    }

    this.resendingWelcomeEmailUserId = user.id;

    try {
      const confirmation = await Swal.fire({
        title: 'Reenviar correo de bienvenida',
        text:
          `Se generará una nueva clave temporal para ${user.firstName} ${user.lastName}, ` +
          'se invalidará la clave actual y se enviará un nuevo correo. ¿Continuar?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, reenviar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#3f51b5',
        focusCancel: true,
      });

      if (!confirmation.isConfirmed) {
        return;
      }

      const response = await firstValueFrom(this.userService.resendWelcomeEmail(user.id));
      this.snackBar.open(response.message, 'Cerrar', { duration: 7000 });
    } catch (err) {
      if (err instanceof HttpErrorResponse && err.status === 503) {
        this.snackBar.open(
          resolveBackendMessage(err, 'No fue posible enviar el correo de bienvenida.'),
          'Cerrar',
          { duration: 9000 },
        );
      }
    } finally {
      this.resendingWelcomeEmailUserId = null;
    }
  }
}
