import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import { StoreOrdersReport } from '../../models/store-orders-report.model';

const BASE = `${API_BASE_URL}/reports/stores`;

@Injectable({ providedIn: 'root' })
export class StoreOrdersReportService {
  private readonly http = inject(HttpClient);

  getByStore(storeId: number) {
    return this.http.get<StoreOrdersReport>(`${BASE}/${storeId}/orders`);
  }
}
