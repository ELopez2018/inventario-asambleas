import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../api.config';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { AuthService } from './auth.service';
import { EventContextService } from './event-context.service';
import { TransportDeliveryReceiptService } from './transport-delivery-receipt.service';

describe('TransportDeliveryReceiptService optional lookup', () => {
  let http: HttpTestingController;
  let service: TransportDeliveryReceiptService;
  let notify: jasmine.Spy;

  beforeEach(() => {
    notify = jasmine.createSpy('open');
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: { open: notify } },
        { provide: AuthService, useValue: {} },
        { provide: EventContextService, useValue: {} },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TransportDeliveryReceiptService);
  });

  afterEach(() => http.verify());

  it('does not show an error notification when the optional CO-30 does not exist', () => {
    let status = 0;
    service.getByTransportRequestId(31, true).subscribe({ error: (err) => status = err.status });
    http.expectOne(`${API_BASE_URL}/transport-requests/31/delivery-receipt`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
    expect(notify).not.toHaveBeenCalled();
  });

  it('still reports a missing CO-30 when opening the receipt itself', () => {
    service.getByTransportRequestId(31).subscribe({ error: () => undefined });
    http.expectOne(`${API_BASE_URL}/transport-requests/31/delivery-receipt`)
      .flush({}, { status: 404, statusText: 'Not Found' });
    expect(notify).toHaveBeenCalledWith('Recurso no encontrado.', 'Cerrar', { duration: 4000 });
  });

  it('still reports server failures during an optional lookup', () => {
    service.getByTransportRequestId(31, true).subscribe({ error: () => undefined });
    http.expectOne(`${API_BASE_URL}/transport-requests/31/delivery-receipt`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    expect(notify).toHaveBeenCalledWith('Error interno del servidor.', 'Cerrar', { duration: 4000 });
  });
});
