import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import { CreateUserRequest, UpdateUserRequest, UserResponse } from '../../models/user.model';

const BASE = `${API_BASE_URL}/users`;

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<UserResponse[]>(BASE);
  }

  getById(id: number) {
    return this.http.get<UserResponse>(`${BASE}/${id}`);
  }

  create(body: CreateUserRequest) {
    return this.http.post<UserResponse>(BASE, body);
  }

  update(id: number, body: UpdateUserRequest) {
    return this.http.put<UserResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
