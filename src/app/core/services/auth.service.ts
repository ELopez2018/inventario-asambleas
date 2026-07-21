import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  AdminSetPasswordRequest,
  ChangePasswordRequest,
  CreateCredentialRequest,
  CredentialResponse,
  CurrentUser,
  LoginRequest,
  LoginResponse,
  PasswordChangeRequiredResponse,
  PasswordChangeResponse,
  RoleCode,
  RoleResponse,
  SetPasswordChangeRequiredRequest,
  SetUserRolesRequest,
} from '../../models/auth.model';

const TOKEN_KEY = 'ar_token';
const USER_KEY = 'ar_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private sanitizeRoles(roles: unknown): RoleCode[] {
    if (!Array.isArray(roles)) {
      return [];
    }

    const allowedRoles: RoleCode[] = ['SUPER', 'AUX', 'USER'];

    return roles
      .filter(
        (role): role is RoleCode =>
          typeof role === 'string' && allowedRoles.includes(role as RoleCode),
      )
      .filter((role, index, self) => self.indexOf(role) === index);
  }

  private sanitizeCurrentUser(rawUser: Partial<CurrentUser>): CurrentUser {
    return {
      userId: Number(rawUser.userId || 0),
      username: String(rawUser.username || ''),
      passwordChangeRequired: Boolean(rawUser.passwordChangeRequired),
      requiredAction: rawUser.requiredAction === 'CHANGE_PASSWORD' ? 'CHANGE_PASSWORD' : null,
      roles: this.sanitizeRoles(rawUser.roles),
    };
  }

  login(credentials: LoginRequest) {
    return this.http.post<LoginResponse>(`${API_BASE_URL}/auth/login`, credentials).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.accessToken);
        const currentUser = this.sanitizeCurrentUser({
          userId: res.userId,
          username: res.username,
          passwordChangeRequired: res.passwordChangeRequired,
          requiredAction: res.requiredAction,
          roles: res.roles,
        });
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser satisfies CurrentUser));
      }),
    );
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

  hasRole(role: RoleCode): boolean {
    return this.getCurrentUser()?.roles.includes(role) ?? false;
  }
}
