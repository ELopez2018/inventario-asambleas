import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api.config';
import { StoreService } from './store.service';

describe('StoreService CRUD', () => {
  let http: HttpTestingController;
  let service: StoreService;
  const url = `${API_BASE_URL}/stores`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(StoreService);
  });

  afterEach(() => http.verify());

  it('creates a store with POST /stores', () => {
    const body = { description: 'PEREIRA', address: 'CALLE 10', priorityOrder: null };
    service.create(body).subscribe();

    const req = http.expectOne(url);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('gets a store with GET /stores/{id}', () => {
    service.getById(12).subscribe();
    const req = http.expectOne(`${url}/12`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('updates a store with PUT /stores/{id}', () => {
    const body = { description: 'PEREIRA', address: 'CALLE 10', gpsCoordinates: null, phone: null };
    service.update(12, body).subscribe();

    const req = http.expectOne(`${url}/12`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('updates availability with PUT /stores/{id}/availability', () => {
    service.updateAvailability(12, false).subscribe();
    const req = http.expectOne(`${url}/12/availability`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ available: false });
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('deletes a store with DELETE /stores/{id}', () => {
    service.delete(12).subscribe();
    const req = http.expectOne(`${url}/12`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
