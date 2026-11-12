import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TransportDeliveryReceiptService } from '../../../core/services/transport-delivery-receipt.service';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import { TransportDeliveryReceiptResponse } from '../../../models/transport-delivery-receipt.model';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { DeliveryReceiptFormComponent } from './delivery-receipt-form.component';

describe('CO-30 item delivery confirmation', () => {
  let service: jasmine.SpyObj<TransportDeliveryReceiptService>;
  let auth: jasmine.SpyObj<AuthService>;
  let confirmation: { confirmSummary: jasmine.Spy };
  let receipt: TransportDeliveryReceiptResponse;

  beforeEach(() => {
    receipt = {
      id: 30, receiptNumber: '30', transportRequestId: 31, transportRequestNumber: '31', receiptDate: '2026-11-08',
      ownerName: null, ownerPhone: null, ownerAddress: null, observations: null, receivedBy: null,
      returnDeliveredTo: null, returnDate: null, returnReceivedBy: null,
      items: [{ id: 11, transportRequestItemId: 7, lineNumber: 1, articleNumber: '30A',
        articleControlType: 'INDIVIDUAL', description: 'Silla', assignedTo: null, requestNumber: '31',
        quantity: 3, allocatedQuantity: 2, deliveryConfirmed: false,
        internalReturnQuantity: null, internalReturnDate: null, conditionNotes: null }],
    };
    service = jasmine.createSpyObj('TransportDeliveryReceiptService', ['getById', 'confirmItemDelivery', 'getCorrections']);
    service.getCorrections.and.returnValue(of([]));
    service.getById.and.returnValue(of(receipt));
    service.confirmItemDelivery.and.returnValue(of({ ...receipt, items: [{ ...receipt.items[0], deliveryConfirmed: true }] }));
    auth = jasmine.createSpyObj('AuthService', ['canAccessAction']);
    auth.canAccessAction.and.returnValue(true);
    confirmation = { confirmSummary: jasmine.createSpy('confirmSummary').and.resolveTo(true) };
    TestBed.configureTestingModule({ imports: [DeliveryReceiptFormComponent], providers: [
      provideRouter([]), provideNoopAnimations(),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '30' }) } } },
      { provide: TransportDeliveryReceiptService, useValue: service },
      { provide: TransportRequestService, useValue: { getById: () => of({ status: 'APROBADA' }) } },
      { provide: AuthService, useValue: auth },
      { provide: ConfirmationService, useValue: confirmation },
    ] });
  });

  it('confirms the allocated quantity and refreshes the delivered badge', async () => {
    const fixture = TestBed.createComponent(DeliveryReceiptFormComponent); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Marcar como entregado');
    await fixture.componentInstance.confirmItemDelivery(receipt.items[0]); fixture.detectChanges();
    const summary = confirmation.confirmSummary.calls.mostRecent().args[0];
    expect(summary.title).toBe('Confirmar entrega de Silla');
    expect(summary.paragraphs[0]).toContain('2 unidades de Silla');
    expect(summary.paragraphs.join(' ')).toContain('Se solicitaron 3 y se confirmarán las 2 asignadas');
    expect(summary.paragraphs.join(' ')).toContain('pasará a ENTREGADA');
    expect(summary.confirmText).toBe('Sí, confirmar entrega');
    expect(service.confirmItemDelivery).toHaveBeenCalledOnceWith(30, 11);
    expect(fixture.componentInstance.receipt?.items[0].deliveryConfirmed).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Entregado');
  });

  it('preserves unsaved form data before confirmation', async () => {
    const fixture = TestBed.createComponent(DeliveryReceiptFormComponent); fixture.detectChanges();
    fixture.componentInstance.form.controls.observations.setValue('Corrección pendiente');
    fixture.componentInstance.form.markAsDirty();
    await fixture.componentInstance.confirmItemDelivery(receipt.items[0]);
    expect(service.confirmItemDelivery).not.toHaveBeenCalled();
    expect(fixture.componentInstance.form.controls.observations.value).toBe('Corrección pendiente');
    expect(fixture.componentInstance.errorMessage).toContain('Guarda los cambios');
  });

  it('requires the delivery action permission', async () => {
    auth.canAccessAction.and.returnValue(false);
    const fixture = TestBed.createComponent(DeliveryReceiptFormComponent); fixture.detectChanges();
    await fixture.componentInstance.confirmItemDelivery(receipt.items[0]);
    expect(service.confirmItemDelivery).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).not.toContain('Marcar como entregado');
  });

  it('keeps the item pending when the server rejects confirmation', async () => {
    service.confirmItemDelivery.and.returnValue(throwError(() => ({ error: { userMessage: 'Actualiza el recibo.' } })));
    const fixture = TestBed.createComponent(DeliveryReceiptFormComponent); fixture.detectChanges();
    await fixture.componentInstance.confirmItemDelivery(receipt.items[0]);
    expect(fixture.componentInstance.errorMessage).toBe('Actualiza el recibo.');
    expect(fixture.componentInstance.receipt?.items[0].deliveryConfirmed).toBeFalse();
    expect(fixture.componentInstance.deliveringItemId).toBeNull();
  });
  it('does not deliver when the confirmation is cancelled', async () => {
    confirmation.confirmSummary.and.resolveTo(false);
    const fixture = TestBed.createComponent(DeliveryReceiptFormComponent); fixture.detectChanges();
    await fixture.componentInstance.confirmItemDelivery(receipt.items[0]);
    expect(service.confirmItemDelivery).not.toHaveBeenCalled();
  });

  it('confirms the accumulated return before saving and sends the reviewed body once', async () => {
    receipt.items[0].internalReturnQuantity = 1;
    service.update = jasmine.createSpy('update').and.returnValue(of(receipt));
    const fixture = TestBed.createComponent(DeliveryReceiptFormComponent); fixture.detectChanges();
    const component = fixture.componentInstance;
    component.receiptItems.at(0).patchValue({ internalReturnQuantity: 2 });
    await component.submit();
    const summary = confirmation.confirmSummary.calls.mostRecent().args[0];
    expect(summary.title).toBe('Confirmar devolución registrada');
    expect(summary.paragraphs[0]).toContain('cambiará de 1 a 2 unidades');
    expect(summary.confirmText).toBe('Guardar devolución');
    expect(service.update).toHaveBeenCalledTimes(1);
    expect(service.update.calls.mostRecent().args[1].items![0].internalReturnQuantity).toBe(2);
  });

  it('does not save when nothing changed', async () => {
    service.update = jasmine.createSpy('update');
    const fixture = TestBed.createComponent(DeliveryReceiptFormComponent); fixture.detectChanges();
    await fixture.componentInstance.submit();
    expect(confirmation.confirmSummary).not.toHaveBeenCalled();
    expect(service.update).not.toHaveBeenCalled();
  });
});
