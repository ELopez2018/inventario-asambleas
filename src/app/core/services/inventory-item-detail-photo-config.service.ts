import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import {
  CreateInventoryItemDetailPhotoConfigRequest,
  InventoryItemDetailPhotoConfigResponse,
  UpdateInventoryItemDetailPhotoConfigRequest,
} from '../../models/inventory-item-detail-photo.model';

const BASE = `${API_BASE_URL}/inventory-item-detail-photo-configs`;

@Injectable({ providedIn: 'root' })
export class InventoryItemDetailPhotoConfigService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<InventoryItemDetailPhotoConfigResponse[]>(BASE);
  }

  getById(id: number) {
    return this.http.get<InventoryItemDetailPhotoConfigResponse>(`${BASE}/${id}`);
  }

  create(body: CreateInventoryItemDetailPhotoConfigRequest) {
    return this.http.post<InventoryItemDetailPhotoConfigResponse>(BASE, body);
  }

  update(id: number, body: UpdateInventoryItemDetailPhotoConfigRequest) {
    return this.http.put<InventoryItemDetailPhotoConfigResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
