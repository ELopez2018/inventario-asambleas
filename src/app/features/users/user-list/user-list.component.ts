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
  templateUrl: './user-list.component.html',
  styleUrl: './user-list.component.css',
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
