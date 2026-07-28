import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, of, tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  AdminSetPasswordRequest,
  AppScreenActionResponse,
  AppScreenResponse,
  ChangePasswordRequest,
  CreateCredentialRequest,
  EffectiveScreenActionAccessResponse,
  CredentialResponse,
  CurrentUser,
  EffectiveScreenAccessResponse,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequiredResponse,
  PasswordChangeResponse,
  RoleCode,
  RoleScreenActionAccessResponse,
  RoleScreenAccessResponse,
  SetRoleScreenActionAccessRequest,
  SetRoleScreenAccessRequest,
  RoleResponse,
  SetPasswordChangeRequiredRequest,
  SetUserScreenActionOverridesRequest,
  SetUserScreenOverridesRequest,
  SetUserRolesRequest,
} from '../../models/auth.model';

const TOKEN_KEY = 'ar_token';
const USER_KEY = 'ar_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly allowedScreensState = signal<EffectiveScreenAccessResponse[]>([]);
  private screensLoaded = false;

  readonly allowedScreens = this.allowedScreensState.asReadonly();

  private sanitizeRoles(roles: unknown): RoleCode[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    const allowedRoles: RoleCode[] = ['SUPER', 'ADMIN', 'AUX', 'USER'];

    return roles
      .filter(
        (role): role is RoleCode =>
          typeof role === 'string' && allowedRoles.includes(role as RoleCode),
      )
      .filter((role, index, self) => self.indexOf(role) === index);
  }

  private sanitizeCurrentUser(rawUser: Partial<CurrentUser>): CurrentUser {
    const activeEvent = rawUser.activeEvent;

    return {
      userId: Number(rawUser.userId || 0),
      username: String(rawUser.username || ''),
      firstName: String(rawUser.firstName || '').trim(),
      lastName: String(rawUser.lastName || '').trim(),
      passwordChangeRequired: Boolean(rawUser.passwordChangeRequired),
      requiredAction: rawUser.requiredAction === 'CHANGE_PASSWORD' ? 'CHANGE_PASSWORD' : null,
      roles: this.sanitizeRoles(rawUser.roles),
      activeEvent:
        activeEvent && typeof activeEvent === 'object'
          ? {
              id: Number(activeEvent.id || 0),
              description: String(activeEvent.description || ''),
              address: String(activeEvent.address || ''),
              startDate: activeEvent.startDate ?? null,
              endDate: activeEvent.endDate ?? null,
              observations: activeEvent.observations ?? null,
              active: Boolean(activeEvent.active),
              activeLockedByUserId: activeEvent.activeLockedByUserId ?? null,
            }
          : null,
    };
  }

  login(credentials: LoginRequest) {
    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, credentials).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        const currentUser = this.sanitizeCurrentUser({
          userId: res.userId,
          username: res.username,
          firstName: res.firstName ?? '',
          lastName: res.lastName ?? '',
          passwordChangeRequired: res.passwordChangeRequired,
          requiredAction: res.requiredAction,
          roles: res.roles,
          activeEvent: res.activeEvent,
        });
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser satisfies CurrentUser));
      }),
    );
  }

  loadMyScreens() {
    return this.http.get<EffectiveScreenAccessResponse[]>(`${API_BASE_URL}/auth/me/screens`).pipe(
      map((screens) =>
        screens
          .filter((screen) => screen.allowed)
          .map((screen) => ({
            ...screen,
            actions: (screen.actions ?? []).filter((action) => action.allowed),
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
      ),
      tap((screens) => {
        this.allowedScreensState.set(screens);
        this.screensLoaded = true;
      }),
    );
  }

  ensureMyScreensLoaded() {
    if (this.screensLoaded) {
      return of(this.allowedScreens());
    }

    return this.loadMyScreens();
  }

  changePassword(body: ChangePasswordRequest) {
    return this.http
      .post<PasswordChangeResponse>(`${API_BASE_URL}/auth/change-password`, body)
      .pipe(
        tap((res) => {
          const currentUser = this.getCurrentUser();

          if (!currentUser) {
            return;
          }

          const nextUser = this.sanitizeCurrentUser({
            ...currentUser,
            passwordChangeRequired: res.passwordChangeRequired,
            requiredAction: null,
          });

          localStorage.setItem(USER_KEY, JSON.stringify(nextUser satisfies CurrentUser));
        }),
      );
  }

  setPasswordChangeRequired(userId: number, body: SetPasswordChangeRequiredRequest) {
    return this.http.patch<PasswordChangeRequiredResponse>(
      `${API_BASE_URL}/auth/users/${userId}/password-change-required`,
      body,
    );
  }

  listRoles() {
    return this.http.get<RoleResponse[]>(`${API_BASE_URL}/auth/roles`);
  }

  listScreens() {
    return this.http.get<AppScreenResponse[]>(`${API_BASE_URL}/auth/screens`);
  }

  listScreenActions() {
    return this.http.get<AppScreenActionResponse[]>(`${API_BASE_URL}/auth/screen-actions`);
  }

  getRoleScreens(roleCode: RoleCode) {
    return this.http.get<RoleScreenAccessResponse>(`${API_BASE_URL}/auth/roles/${roleCode}/screens`);
  }

  setRoleScreens(roleCode: RoleCode, body: SetRoleScreenAccessRequest) {
    return this.http.put<RoleScreenAccessResponse>(
      `${API_BASE_URL}/auth/roles/${roleCode}/screens`,
      body,
    );
  }

  getRoleScreenActions(roleCode: RoleCode) {
    return this.http.get<RoleScreenActionAccessResponse>(
      `${API_BASE_URL}/auth/roles/${roleCode}/screen-actions`,
    );
  }

  setRoleScreenActions(roleCode: RoleCode, body: SetRoleScreenActionAccessRequest) {
    return this.http.put<RoleScreenActionAccessResponse>(
      `${API_BASE_URL}/auth/roles/${roleCode}/screen-actions`,
      body,
    );
  }

  getUserScreens(userId: number) {
    return this.http.get<EffectiveScreenAccessResponse[]>(
      `${API_BASE_URL}/auth/users/${userId}/screens`,
    );
  }

  getUserScreenActions(userId: number) {
    return this.http.get<EffectiveScreenActionAccessResponse[]>(
      `${API_BASE_URL}/auth/users/${userId}/screen-actions`,
    );
  }

  setUserScreenActionOverrides(userId: number, body: SetUserScreenActionOverridesRequest) {
    return this.http.put<EffectiveScreenAccessResponse[]>(
      `${API_BASE_URL}/auth/users/${userId}/screen-actions`,
      body,
    );
  }

  setUserScreenOverrides(userId: number, body: SetUserScreenOverridesRequest) {
    return this.http.put<EffectiveScreenAccessResponse[]>(
      `${API_BASE_URL}/auth/users/${userId}/screens`,
      body,
    );
  }

  createCredential(userId: number, body: CreateCredentialRequest) {
    return this.http.post<CredentialResponse>(
      `${API_BASE_URL}/auth/users/${userId}/credentials`,
      body,
    );
  }

  setUserPassword(userId: number, body: AdminSetPasswordRequest) {
    return this.http.patch<CredentialResponse>(
      `${API_BASE_URL}/auth/users/${userId}/password`,
      body,
    );
  }

  setUserRoles(userId: number, body: SetUserRolesRequest) {
    return this.http.put<CredentialResponse>(`${API_BASE_URL}/auth/users/${userId}/roles`, body);
  }

  logout() {
    this.clearSession();
    void this.router.navigate(['/login']);
  }

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.allowedScreensState.set([]);
    this.screensLoaded = false;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getCurrentUser(): CurrentUser | null {
    const raw = localStorage.getItem(USER_KEY);

    if (!raw) {
      return null;
    }

    try {
      return this.sanitizeCurrentUser(JSON.parse(raw) as Partial<CurrentUser>);
    } catch {
      this.clearSession();
      return null;
    }
  }

  getCurrentUserDisplayName(): string {
    const currentUser = this.getCurrentUser();
    const fullName = [currentUser?.firstName, currentUser?.lastName]
      .filter(Boolean)
      .join(' ')
      .trim();

    return fullName || 'Usuario';
  }

  updateCurrentUserName(firstName: string, lastName: string): void {
    const currentUser = this.getCurrentUser();

    if (!currentUser) {
      return;
    }

    const nextUser = this.sanitizeCurrentUser({
      ...currentUser,
      firstName,
      lastName,
    });

    localStorage.setItem(USER_KEY, JSON.stringify(nextUser satisfies CurrentUser));
  }

  hasRole(role: RoleCode): boolean {
    return this.getCurrentUser()?.roles.includes(role) ?? false;
  }

  hasAnyRole(roles: RoleCode[]): boolean {
    const currentRoles = this.getCurrentUser()?.roles ?? [];
    return roles.some((role) => currentRoles.includes(role));
  }

  canAccessScreen(code: string): boolean {
    return this.allowedScreens().some((screen) => screen.code === code && screen.allowed);
  }

  canAccessRoute(route: string): boolean {
    return this.allowedScreens().some(
      (screen) => screen.allowed && route.startsWith(this.normalizeRoute(screen.route)),
    );
  }

  canAccessAction(screenCode: string, actionKeyOrCode: string): boolean {
    return this.allowedScreens().some(
      (screen) =>
        screen.code === screenCode &&
        screen.allowed &&
        (screen.actions ?? []).some(
          (action) =>
            action.allowed &&
            (action.actionKey === actionKeyOrCode || action.code === actionKeyOrCode),
        ),
    );
  }

  private normalizeRoute(route: string): string {
    return route.startsWith('/') ? route : `/${route}`;
  }
}
