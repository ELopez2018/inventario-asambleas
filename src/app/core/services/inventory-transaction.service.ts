import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import {
  CreateInventoryTransactionRequest,
  InventoryTransactionResponse,
  UpdateInventoryTransactionRequest,
} from '../../models/inventory-transaction.model';

const BASE = `${API_BASE_URL}/inventory-transactions`;

@Injectable({ providedIn: 'root' })
export class InventoryTransactionService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<InventoryTransactionResponse[]>(BASE);
  }

  getById(id: number) {
    return this.http.get<InventoryTransactionResponse>(`${BASE}/${id}`);
  }

  create(body: CreateInventoryTransactionRequest) {
    return this.http.post<InventoryTransactionResponse>(BASE, body);
  }

  update(id: number, body: UpdateInventoryTransactionRequest) {
    return this.http.put<InventoryTransactionResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }
}
