import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import {
  CreateInventoryItemDetailRequest,
  InventoryItemDetailResponse,
  UpdateInventoryItemDetailRequest,
} from '../../models/inventory-item-detail.model';

const BASE = `${API_BASE_URL}/inventory-item-details`;

@Injectable({ providedIn: 'root' })
export class InventoryItemDetailService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<InventoryItemDetailResponse[]>(BASE);
  }

  getById(id: number) {
    return this.http.get<InventoryItemDetailResponse>(`${BASE}/${id}`);
  }

  create(body: CreateInventoryItemDetailRequest) {
    return this.http.post<InventoryItemDetailResponse>(BASE, body);
  }

  update(id: number, body: UpdateInventoryItemDetailRequest) {
    return this.http.put<InventoryItemDetailResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
