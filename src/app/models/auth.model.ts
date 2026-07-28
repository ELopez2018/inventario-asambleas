import type { EventResponse } from './event.model';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  userId: number;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  authenticated: boolean;
  passwordChangeRequired: boolean;
  requiredAction: 'CHANGE_PASSWORD' | null;
  roles: RoleCode[];
  activeEvent: EventResponse | null;
  message: string;
}

export interface CurrentUser {
  userId: number;
  username: string;
  firstName: string;
  lastName: string;
  passwordChangeRequired: boolean;
  requiredAction: 'CHANGE_PASSWORD' | null;
  roles: RoleCode[];
  activeEvent: EventResponse | null;
}

export type RoleCode = 'SUPER' | 'ADMIN' | 'AUX' | 'USER';

export interface RoleResponse {
  id: number;
  code: RoleCode;
  description: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface PasswordChangeResponse {
  passwordChanged: boolean;
  passwordChangeRequired: boolean;
  message: string;
}

export interface PasswordChangeRequiredResponse {
  userId: number;
  passwordChangeRequired: boolean;
  message: string;
}

export interface SetPasswordChangeRequiredRequest {
  required: boolean;
}

export interface CreateCredentialRequest {
  username: string;
  password: string;
  passwordChangeRequired: boolean;
  roles: RoleCode[];
}

export interface AdminSetPasswordRequest {
  newPassword: string;
  passwordChangeRequired: boolean;
}

export interface SetUserRolesRequest {
  roles: RoleCode[];
}

export interface CredentialResponse {
  userId: number;
  username: string;
  passwordChangeRequired: boolean;
  roles: RoleCode[];
  message: string;
}

export type ScreenAccessOverride = 'ALLOW' | 'DENY';
export type ScreenAccessSource = 'ROLE' | 'USER_ALLOW' | 'USER_DENY' | 'NONE';

export interface AppScreenResponse {
  code: string;
  title: string;
  route: string;
  icon: string | null;
  section: string;
  sortOrder: number;
  showInMenu: boolean;
  requiresAuth: boolean;
  notes: string | null;
}

export interface AppScreenActionResponse {
  code: string;
  screenCode: string;
  actionKey: string;
  title: string;
  icon: string | null;
  style: string | null;
  sortOrder: number;
  confirmationRequired: boolean;
  notes: string | null;
}

export interface EffectiveScreenActionAccessResponse extends AppScreenActionResponse {
  roleGranted: boolean;
  userOverride: ScreenAccessOverride | null;
  allowed: boolean;
  accessSource: ScreenAccessSource;
}

export interface EffectiveScreenAccessResponse extends AppScreenResponse {
  roleGranted: boolean;
  userOverride: ScreenAccessOverride | null;
  allowed: boolean;
  accessSource: ScreenAccessSource;
  actions: EffectiveScreenActionAccessResponse[];
}

export interface RoleScreenAccessResponse {
  roleCode: RoleCode;
  screenCodes: string[];
  message: string;
}

export interface SetRoleScreenAccessRequest {
  screenCodes: string[];
}

export interface RoleScreenActionAccessResponse {
  roleCode: RoleCode;
  actionCodes: string[];
  message: string;
}

export interface SetRoleScreenActionAccessRequest {
  actionCodes: string[];
}

export interface UserScreenOverrideRequest {
  screenCode: string;
  accessOverride: ScreenAccessOverride;
}

export interface SetUserScreenOverridesRequest {
  overrides: UserScreenOverrideRequest[];
}

export interface UserScreenActionOverrideRequest {
  actionCode: string;
  accessOverride: ScreenAccessOverride;
}

export interface SetUserScreenActionOverridesRequest {
  overrides: UserScreenActionOverrideRequest[];
}
