import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import { OPTIONAL_RESOURCE } from '../http-context';
import {
  CorrectReceiptItemQuantityRequest,
  MarkReceiptItemNotFoundRequest,
  ReceiptItemCorrectionResponse,
  ReceiptItemCorrectionResultResponse,
  RemoveReceiptItemRequest,
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

  getByTransportRequestId(transportRequestId: number, optional = false) {
    return this.http.get<TransportDeliveryReceiptResponse>(
      `${REQUEST_BASE}/${transportRequestId}/delivery-receipt`,
      { context: new HttpContext().set(OPTIONAL_RESOURCE, optional) },
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

  confirmItemDelivery(id: number, itemId: number) {
    return this.http.post<TransportDeliveryReceiptResponse>(`${BASE}/${id}/items/${itemId}/deliver`, {});
  }

  /** `itemId` es el renglón del CO-30 (`items[].id`). */
  correctItemQuantity(id: number, itemId: number, body: CorrectReceiptItemQuantityRequest) {
    return this.http.patch<ReceiptItemCorrectionResultResponse>(`${BASE}/${id}/items/${itemId}/quantity`, body);
  }

  /** `itemId` es el renglón del CO-30 (`items[].id`). */
  removeItem(id: number, itemId: number, body: RemoveReceiptItemRequest) {
    return this.http.post<ReceiptItemCorrectionResultResponse>(`${BASE}/${id}/items/${itemId}/remove`, body);
  }

  /** Marca unidades como no encontradas; el renglón conserva la cantidad solicitada. `itemId` = `items[].id`. */
  markItemNotFound(id: number, itemId: number, body: MarkReceiptItemNotFoundRequest) {
    return this.http.post<ReceiptItemCorrectionResultResponse>(`${BASE}/${id}/items/${itemId}/not-found`, body);
  }

  /** Historial de correcciones, de la más reciente a la más antigua. */
  getCorrections(id: number) {
    return this.http.get<ReceiptItemCorrectionResponse[]>(`${BASE}/${id}/corrections`);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
