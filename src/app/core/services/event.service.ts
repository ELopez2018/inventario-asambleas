import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_BASE_URL } from '../api.config';
import { CreateEventRequest, EventResponse, UpdateEventRequest } from '../../models/event.model';

const BASE = `${API_BASE_URL}/events`;

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);

  getAll() {
    return this.http.get<EventResponse[]>(BASE);
  }

  getById(id: number) {
    return this.http.get<EventResponse>(`${BASE}/${id}`);
  }

  getActive() {
    return this.http.get<EventResponse | null>(`${BASE}/active`);
  }

  create(body: CreateEventRequest) {
    return this.http.post<EventResponse>(BASE, body);
  }

  update(id: number, body: UpdateEventRequest) {
    return this.http.put<EventResponse>(`${BASE}/${id}`, body);
  }

  delete(id: number) {
    return this.http.delete<void>(`${BASE}/${id}`);
  }

  activate(id: number) {
    return this.http.patch<EventResponse>(`${BASE}/${id}/active`, {});
  }
}
