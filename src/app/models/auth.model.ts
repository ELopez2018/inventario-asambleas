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
  message: string;
}

export interface CurrentUser {
  userId: number;
  username: string;
}
