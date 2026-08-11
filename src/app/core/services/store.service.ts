import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  StorePriorityUpdateRequest,
  StoreResponse,
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

  updatePriority(id: number, priorityOrder: number) {
    const body: StorePriorityUpdateRequest = { priorityOrder };
    return this.http.put<void>(`${BASE}/${id}/priority`, body);
  }
}
