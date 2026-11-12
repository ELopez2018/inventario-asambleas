import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import { TransportDeliveryReceiptResponse } from '../../models/transport-delivery-receipt.model';
import {
  AllocationPreviewRequest,
  AllocationPreviewResponse,
  CreateTransportRequestRequest,
  TransportRequestAutocompleteOptionsResponse,
  TransportRequestNextNumberResponse,
  TransportRequestResponse,
  UpdateTransportRequestRequest,
} from '../../models/transport-request.model';

const BASE = `${API_BASE_URL}/transport-requests`;

@Injectable({ providedIn: 'root' })
export class TransportRequestService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<TransportRequestResponse[]>(BASE);
  }

  getPending() {
    return this.http.get<TransportRequestResponse[]>(`${BASE}/pending`);
  }

  getAttended() {
    return this.http.get<TransportRequestResponse[]>(`${BASE}/attended`);
  }

  getById(id: number) {
    return this.http.get<TransportRequestResponse>(`${BASE}/${id}`);
  }

  getNextRequestNumber() {
    return this.http.get<TransportRequestNextNumberResponse>(`${BASE}/next-request-number`);
  }

  getExamplePdf() {
    return this.http.get(`${BASE}/example`, { responseType: 'blob' });
  }

  getAutocompleteOptions() {
    return this.http.get<TransportRequestAutocompleteOptionsResponse>(
      `${BASE}/autocomplete-options`,
    );
  }

  create(body: CreateTransportRequestRequest) {
    return this.http.post<TransportRequestResponse>(BASE, body);
  }

  update(id: number, body: UpdateTransportRequestRequest) {
    return this.http.put<TransportRequestResponse>(`${BASE}/${id}`, body);
  }

  createDeliveryReceipt(id: number, observations?: string | null) {
    return this.http.post<TransportDeliveryReceiptResponse>(`${BASE}/${id}/delivery-receipt`, {
      observations: observations ?? null,
    });
  }

  /** Calcula sin guardar lo que asignaría el modo automático. */
  previewAllocation(body: AllocationPreviewRequest) {
    return this.http.post<AllocationPreviewResponse>(`${BASE}/allocation-preview`, body);
  }

  redistribute() {
    return this.http.post<void>(`${BASE}/redistribute`, null);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
