import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import {
  CreateTransportRequestRequest,
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

  getById(id: number) {
    return this.http.get<TransportRequestResponse>(`${BASE}/${id}`);
  }

  create(body: CreateTransportRequestRequest) {
    return this.http.post<TransportRequestResponse>(BASE, body);
  }

  update(id: number, body: UpdateTransportRequestRequest) {
    return this.http.put<TransportRequestResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
