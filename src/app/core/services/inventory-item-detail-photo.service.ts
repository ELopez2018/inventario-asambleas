import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import {
  InventoryItemDetailPhotoResponse,
  UpdateInventoryItemDetailPhotoRequest,
  UploadInventoryItemDetailPhotosPayload,
} from '../../models/inventory-item-detail-photo.model';

const BASE = `${API_BASE_URL}/inventory-item-detail-photos`;

@Injectable({ providedIn: 'root' })
export class InventoryItemDetailPhotoService {
  private readonly http = inject(HttpClient);

  uploadBatch(payload: UploadInventoryItemDetailPhotosPayload) {
    const formData = new FormData();
    formData.append('eventId', String(payload.eventId));
    formData.append('storeId', String(payload.storeId));
    formData.append('itemDetailId', String(payload.itemDetailId));
    formData.append('gpsLatitude', String(payload.gpsLatitude));
    formData.append('gpsLongitude', String(payload.gpsLongitude));

    if (payload.capturedAt) {
      formData.append('capturedAt', payload.capturedAt);
    }

    if (payload.observations) {
      formData.append('observations', payload.observations);
    }

    for (const file of payload.files) {
      formData.append('files', file, file.name);
    }

    return this.http.post<InventoryItemDetailPhotoResponse[]>(`${BASE}/batch`, formData);
  }

  listByScope(eventId: number, storeId: number, itemDetailId: number) {
    return this.http.get<InventoryItemDetailPhotoResponse[]>(
      `${BASE}?eventId=${eventId}&storeId=${storeId}&itemDetailId=${itemDetailId}`,
    );
  }

  getById(id: number) {
    return this.http.get<InventoryItemDetailPhotoResponse>(`${BASE}/${id}`);
  }

  getContent(id: number) {
    return this.http.get(`${BASE}/${id}/content`, { responseType: 'blob' });
  }

  getContentUrl(id: number): string {
    return `${BASE}/${id}/content`;
  }

  update(id: number, body: UpdateInventoryItemDetailPhotoRequest) {
    return this.http.put<InventoryItemDetailPhotoResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
