export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  userId: number;
  username: string;
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  authenticated: boolean;
  passwordChangeRequired: boolean;
  requiredAction: 'CHANGE_PASSWORD' | null;
  roles: RoleCode[];
  message: string;
}

export interface CurrentUser {
  userId: number;
  username: string;
  passwordChangeRequired: boolean;
  requiredAction: 'CHANGE_PASSWORD' | null;
  roles: RoleCode[];
}

export type RoleCode = 'SUPER' | 'AUX' | 'USER';

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
