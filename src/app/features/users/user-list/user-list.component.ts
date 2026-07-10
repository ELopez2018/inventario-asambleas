import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { UserService } from '../../../core/services/user.service';
import { UserResponse } from '../../../models/user.model';

@Component({
  selector: 'app-user-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <section class="mx-auto max-w-6xl">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-950">Usuarios</h1>
          <p class="text-sm text-slate-600">Contactos disponibles para responsables y movimientos.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/users/new">
          <mat-icon>add</mat-icon>
          Nuevo
        </a>
      </div>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        @if (loading) {
          <div class="flex items-center justify-center p-10">
            <mat-spinner diameter="36" />
          </div>
        } @else if (errorMessage) {
          <div class="p-6 text-sm text-red-700">{{ errorMessage }}</div>
        } @else if (!users.length) {
          <div class="p-6 text-sm text-slate-600">No hay usuarios registrados.</div>
        } @else {
          <div class="overflow-x-auto">
            <table mat-table [dataSource]="users" class="min-w-full">
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Nombre</th>
                <td mat-cell *matCellDef="let user">{{ user.firstName }} {{ user.lastName }}</td>
              </ng-container>

              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef>Email</th>
                <td mat-cell *matCellDef="let user">{{ user.email }}</td>
              </ng-container>

              <ng-container matColumnDef="phone">
                <th mat-header-cell *matHeaderCellDef>Telefono</th>
                <td mat-cell *matCellDef="let user">{{ user.phone || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="w-28 text-right">Acciones</th>
                <td mat-cell *matCellDef="let user" class="text-right">
                  <a mat-icon-button [routerLink]="['/users', user.id, 'edit']" matTooltip="Editar">
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button mat-icon-button type="button" matTooltip="Eliminar" (click)="deleteUser(user)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);

  readonly displayedColumns = ['name', 'email', 'phone', 'actions'];
  users: UserResponse[] = [];
  loading = false;
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
}
