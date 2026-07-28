import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import {
  TransportDeliveryReceiptResponse,
  UpdateTransportDeliveryReceiptRequest,
} from '../../models/transport-delivery-receipt.model';

const BASE = `${API_BASE_URL}/transport-delivery-receipts`;
const REQUEST_BASE = `${API_BASE_URL}/transport-requests`;

@Injectable({ providedIn: 'root' })
export class TransportDeliveryReceiptService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<TransportDeliveryReceiptResponse[]>(BASE);
  }

  getById(id: number) {
    return this.http.get<TransportDeliveryReceiptResponse>(`${BASE}/${id}`);
  }

  getByTransportRequestId(transportRequestId: number) {
    return this.http.get<TransportDeliveryReceiptResponse>(
      `${REQUEST_BASE}/${transportRequestId}/delivery-receipt`,
    );
  }

  createFromTransportRequest(transportRequestId: number, observations?: string | null) {
    return this.http.post<TransportDeliveryReceiptResponse>(
      `${REQUEST_BASE}/${transportRequestId}/delivery-receipt`,
      { observations: observations ?? null },
    );
  }

  update(id: number, body: UpdateTransportDeliveryReceiptRequest) {
    return this.http.put<TransportDeliveryReceiptResponse>(`${BASE}/${id}`, body);
  }
}
