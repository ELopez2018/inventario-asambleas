import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../api.config';
import {
  CreateInventoryItemRequest,
  InventoryItemResponse,
  UpdateInventoryItemRequest,
} from '../../models/inventory-item.model';

const BASE = `${API_BASE_URL}/inventory-items`;

@Injectable({ providedIn: 'root' })
export class InventoryItemService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<InventoryItemResponse[]>(BASE);
  }

  getById(id: number) {
    return this.http.get<InventoryItemResponse>(`${BASE}/${id}`);
  }

  exportExcel(): Observable<HttpResponse<Blob>> {
    return this.http.get(`${BASE}/export/excel`, {
      observe: 'response',
      responseType: 'blob',
    });
  }

  create(body: CreateInventoryItemRequest) {
    return this.http.post<InventoryItemResponse>(BASE, body);
  }

  update(id: number, body: UpdateInventoryItemRequest) {
    return this.http.put<InventoryItemResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
