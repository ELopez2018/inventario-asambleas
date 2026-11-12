import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CreateStoreRequest,
  StorePriorityUpdateRequest,
  StoreResponse,
  UpdateStoreRequest,
  compareStoresByPriority,
} from '../../models/store.model';

const BASE = `${API_BASE_URL}/stores`;

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http
      .get<StoreResponse[]>(BASE)
      .pipe(map((stores) => [...stores].sort(compareStoresByPriority)));
  }

  getById(id: number) {
    return this.http.get<StoreResponse>(`${BASE}/${id}`);
  }

  create(body: CreateStoreRequest) {
    return this.http.post<StoreResponse>(BASE, body);
  }

  update(id: number, body: UpdateStoreRequest) {
    return this.http.put<StoreResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  updateAvailability(id: number, available: boolean) {
    return this.http.put<void>(`${BASE}/${id}/availability`, { available });
  }

  updatePriority(id: number, priorityOrder: number) {
    const body: StorePriorityUpdateRequest = { priorityOrder };
    return this.http.put<void>(`${BASE}/${id}/priority`, body);
  }
}
