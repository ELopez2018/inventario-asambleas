import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { UserService } from '../../../core/services/user.service';
import {
  AppScreenActionResponse,
  AppScreenResponse,
  EffectiveScreenActionAccessResponse,
  EffectiveScreenAccessResponse,
  RoleCode,
  RoleResponse,
  ScreenAccessOverride,
} from '../../../models/auth.model';
import { UserResponse } from '../../../models/user.model';

@Component({
  selector: 'app-screen-access-admin',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  templateUrl: './screen-access-admin.component.html',
  styleUrl: './screen-access-admin.component.css',
})
export class ScreenAccessAdminComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  readonly canManageRoleScreens = computed(() =>
    this.auth.canAccessAction('SCREEN_ACCESS_ADMIN', 'manageRoleScreens'),
  );
  readonly canManageRoleActions = computed(() =>
    this.auth.canAccessAction('SCREEN_ACCESS_ADMIN', 'manageRoleActions'),
  );
  readonly canManageUserOverrides = computed(() =>
    this.auth.canAccessAction('SCREEN_ACCESS_ADMIN', 'manageUserOverrides'),
  );
  readonly canManageUserActionOverrides = computed(() =>
    this.auth.canAccessAction('SCREEN_ACCESS_ADMIN', 'manageUserActionOverrides'),
  );

  roles: RoleResponse[] = [];
  users: UserResponse[] = [];
  screens: AppScreenResponse[] = [];
  actions: AppScreenActionResponse[] = [];
  userScreens: EffectiveScreenAccessResponse[] = [];
  userActions: EffectiveScreenActionAccessResponse[] = [];
  selectedRole: RoleCode | null = null;
  selectedUserId = 0;
  roleScreenCodes = new Set<string>();
  roleActionCodes = new Set<string>();
  userOverrides = new Map<string, ScreenAccessOverride | null>();
  userActionOverrides = new Map<string, ScreenAccessOverride | null>();

  loading = false;
  loadingRole = false;
  loadingUser = false;
  savingRole = false;
  savingRoleActions = false;
  savingUser = false;
  savingUserActions = false;
  errorMessage = '';
  successMessage = '';

  ngOnInit(): void {
    this.loading = true;

    forkJoin({
      roles: this.auth.listRoles(),
      users: this.userService.getAll(),
      screens: this.auth.listScreens(),
      actions: this.auth.listScreenActions(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ roles, users, screens, actions }) => {
          this.roles = roles;
          this.users = users;
          this.screens = [...screens].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
          );
          this.actions = [...actions].sort(
            (a, b) =>
              a.screenCode.localeCompare(b.screenCode) ||
              a.sortOrder - b.sortOrder ||
              a.title.localeCompare(b.title),
          );
        },
        error: () => (this.errorMessage = 'No se pudo cargar la administracion de permisos.'),
      });
  }

  onRoleSelected(roleCode: RoleCode): void {
    this.selectedRole = roleCode;
    this.loadingRole = true;
    this.errorMessage = '';
    this.successMessage = '';

    forkJoin({
      screens: this.auth.getRoleScreens(roleCode),
      actions: this.auth.getRoleScreenActions(roleCode),
    })
      .pipe(finalize(() => (this.loadingRole = false)))
      .subscribe({
        next: ({ screens, actions }) => {
          this.roleScreenCodes = new Set(screens.screenCodes);
          this.roleActionCodes = new Set(actions.actionCodes);
        },
        error: () => (this.errorMessage = 'No se pudieron cargar los permisos del rol.'),
      });
  }

  toggleRoleScreen(screenCode: string, checked: boolean): void {
    if (checked) {
      this.roleScreenCodes.add(screenCode);
      return;
    }

    this.roleScreenCodes.delete(screenCode);
  }

  toggleRoleAction(actionCode: string, checked: boolean): void {
    if (checked) {
      this.roleActionCodes.add(actionCode);
      return;
    }

    this.roleActionCodes.delete(actionCode);
  }

  saveRoleScreens(): void {
    if (!this.canManageRoleScreens()) {
      return;
    }

    if (!this.selectedRole || this.savingRole) {
      return;
    }

    this.savingRole = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.auth
      .setRoleScreens(this.selectedRole, { screenCodes: [...this.roleScreenCodes] })
      .pipe(finalize(() => (this.savingRole = false)))
      .subscribe({
        next: (response) => {
          this.roleScreenCodes = new Set(response.screenCodes);
          this.successMessage = response.message || 'Pantallas del rol actualizadas.';
        },
        error: () => (this.errorMessage = 'No se pudieron guardar las pantallas del rol.'),
      });
  }

  saveRoleActions(): void {
    if (!this.canManageRoleActions()) {
      return;
    }

    if (!this.selectedRole || this.savingRoleActions) {
      return;
    }

    this.savingRoleActions = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.auth
      .setRoleScreenActions(this.selectedRole, { actionCodes: [...this.roleActionCodes] })
      .pipe(finalize(() => (this.savingRoleActions = false)))
      .subscribe({
        next: (response) => {
          this.roleActionCodes = new Set(response.actionCodes);
          this.successMessage = response.message || 'Acciones del rol actualizadas.';
        },
        error: () => (this.errorMessage = 'No se pudieron guardar las acciones del rol.'),
      });
  }

  onUserSelected(userId: number): void {
    this.selectedUserId = Number(userId);
    this.userScreens = [];
    this.userActions = [];
    this.userOverrides.clear();
    this.userActionOverrides.clear();

    if (!this.selectedUserId) {
      return;
    }

    this.loadingUser = true;
    this.errorMessage = '';
    this.successMessage = '';

    forkJoin({
      screens: this.auth.getUserScreens(this.selectedUserId),
      actions: this.auth.getUserScreenActions(this.selectedUserId),
    })
      .pipe(finalize(() => (this.loadingUser = false)))
      .subscribe({
        next: ({ screens, actions }) => {
          this.userScreens = [...screens].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
          );
          this.userActions = [...actions].sort(
            (a, b) =>
              a.screenCode.localeCompare(b.screenCode) ||
              a.sortOrder - b.sortOrder ||
              a.title.localeCompare(b.title),
          );
          this.userOverrides = new Map(
            this.userScreens.map((screen) => [screen.code, screen.userOverride]),
          );
          this.userActionOverrides = new Map(
            this.userActions.map((action) => [action.code, action.userOverride]),
          );
        },
        error: () => (this.errorMessage = 'No se pudieron cargar los permisos del usuario.'),
      });
  }

  setUserOverride(screenCode: string, override: ScreenAccessOverride | null): void {
    this.userOverrides.set(screenCode, override);
  }

  setUserActionOverride(actionCode: string, override: ScreenAccessOverride | null): void {
    this.userActionOverrides.set(actionCode, override);
  }

  saveUserOverrides(): void {
    if (!this.canManageUserOverrides()) {
      return;
    }

    if (!this.selectedUserId || this.savingUser) {
      return;
    }

    this.savingUser = true;
    this.errorMessage = '';
    this.successMessage = '';

    const overrides = [...this.userOverrides.entries()]
      .filter(([, accessOverride]) => accessOverride !== null)
      .map(([screenCode, accessOverride]) => ({
        screenCode,
        accessOverride: accessOverride as ScreenAccessOverride,
      }));

    this.auth
      .setUserScreenOverrides(this.selectedUserId, { overrides })
      .pipe(finalize(() => (this.savingUser = false)))
      .subscribe({
        next: (screens) => {
          this.userScreens = [...screens].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
          );
          this.userOverrides = new Map(
            this.userScreens.map((screen) => [screen.code, screen.userOverride]),
          );
          this.successMessage = 'Ajustes del usuario actualizados.';
        },
        error: () => (this.errorMessage = 'No se pudieron guardar los ajustes del usuario.'),
      });
  }

  saveUserActionOverrides(): void {
    if (!this.canManageUserActionOverrides()) {
      return;
    }

    if (!this.selectedUserId || this.savingUserActions) {
      return;
    }

    this.savingUserActions = true;
    this.errorMessage = '';
    this.successMessage = '';

    const overrides = [...this.userActionOverrides.entries()]
      .filter(([, accessOverride]) => accessOverride !== null)
      .map(([actionCode, accessOverride]) => ({
        actionCode,
        accessOverride: accessOverride as ScreenAccessOverride,
      }));

    this.auth
      .setUserScreenActionOverrides(this.selectedUserId, { overrides })
      .pipe(finalize(() => (this.savingUserActions = false)))
      .subscribe({
        next: (screens) => {
          this.userActions = this.flattenActions(screens);
          this.userActionOverrides = new Map(
            this.userActions.map((action) => [action.code, action.userOverride]),
          );
          this.successMessage = 'Ajustes de acciones del usuario actualizados.';
        },
        error: () => (this.errorMessage = 'No se pudieron guardar las acciones del usuario.'),
      });
  }

  getActionsForScreen(screenCode: string): AppScreenActionResponse[] {
    return this.actions.filter((action) => action.screenCode === screenCode);
  }

  private flattenActions(
    screens: EffectiveScreenAccessResponse[],
  ): EffectiveScreenActionAccessResponse[] {
    return screens
      .flatMap((screen) => screen.actions ?? [])
      .sort(
        (a, b) =>
          a.screenCode.localeCompare(b.screenCode) ||
          a.sortOrder - b.sortOrder ||
          a.title.localeCompare(b.title),
      );
  }
}
