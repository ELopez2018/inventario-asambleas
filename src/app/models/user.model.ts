export interface UserResponse {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
}

export interface ResendWelcomeEmailResponse {
  userId: number;
  sent: boolean;
  message: string;
}

export interface CreateUserRequest {
  firstName: string;
  lastName: string;
  phone?: string;
  email: string;
}

export type UpdateUserRequest = CreateUserRequest;
