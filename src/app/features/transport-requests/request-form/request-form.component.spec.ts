import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepper } from '@angular/material/stepper';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { EventContextService } from '../../../core/services/event-context.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { StoreService } from '../../../core/services/store.service';
import { TransportDeliveryReceiptService } from '../../../core/services/transport-delivery-receipt.service';
import { TransportRequestPdfService } from '../../../core/services/transport-request-pdf.service';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import { UserService } from '../../../core/services/user.service';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import { StoreResponse } from '../../../models/store.model';
import { TransportRequestResponse, TransportRequestStatus } from '../../../models/transport-request.model';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { RequestFormComponent } from './request-form.component';

describe('RequestFormComponent CO-31 partial editing', () => {
  let original: TransportRequestResponse;
  let requests: jasmine.SpyObj<TransportRequestService>;
  let receipts: jasmine.SpyObj<TransportDeliveryReceiptService>;
  let auth: jasmine.SpyObj<AuthService>;
  let navigate: jasmine.Spy;
  let confirmation: { confirmSummary: jasmine.Spy };
  let route: { snapshot: { paramMap: ReturnType<typeof convertToParamMap> } };

  let inventoryItems: InventoryItemResponse[];
  let stores: StoreResponse[];

  beforeEach(() => {
    inventoryItems = [];
    stores = [];
    original = {
      id: 31, requestNumber: 'CO-31-031', status: 'APROBADA', stockReserved: true,
      requestDate: '2026-11-08', requestedFrom: 'Logística', requestedTo: 'Transporte',
      targetDepartment: null, targetPlace: 'Destino original', eventId: 4,
      desiredDate: null, desiredTime: null, estimatedAmount: null, observations: 'Original',
      receivedBy: null, receivedDate: null, receivedTime: null, authorizedBy: null,
      items: [{
        id: 7, lineNumber: 1, quantity: 10, description: ' Silla ', sizeAndWeight: '',
        lineTotal: 0, newItem: false, articleControlType: 'LOTE',
        allocations: [{
          id: 9, itemId: 2, itemDescription: 'Silla', sourceStoreId: 3,
          sourceStoreName: 'Principal', requestedQuantity: 10, allocatedQuantity: 10,
          pickedQuantity: 0, deliveredQuantity: 0, returnedQuantity: 2, status: 'PLANIFICADA',
        }],
      }],
    };
    requests = jasmine.createSpyObj('TransportRequestService', [
      'getById', 'getAutocompleteOptions', 'getNextRequestNumber', 'update', 'create', 'previewAllocation',
    ]);
    requests.getById.and.callFake(() => of(original));
    requests.getAutocompleteOptions.and.returnValue(of({ requestedFrom: [], targetDepartments: [] }));
    requests.getNextRequestNumber.and.returnValue(of({ requestNumber: 'CO-31-032' }));
    requests.update.and.callFake(() => of(original));
    requests.create.and.callFake(() => of(original));
    receipts = jasmine.createSpyObj('TransportDeliveryReceiptService', ['getByTransportRequestId']);
    receipts.getByTransportRequestId.and.returnValue(of({
      id: 30, receiptNumber: 'CO-30-030', transportRequestId: 31,
      transportRequestNumber: 'CO-31-031', receiptDate: '2026-11-08',
      ownerName: null, ownerPhone: null, ownerAddress: null, observations: null,
      receivedBy: null, returnDeliveredTo: null, returnDate: null, returnReceivedBy: null, items: [],
    }));
    auth = jasmine.createSpyObj('AuthService', ['getCurrentUser', 'canAccessAction']);
    auth.getCurrentUser.and.returnValue(null);
    auth.canAccessAction.and.returnValue(true);
    confirmation = { confirmSummary: jasmine.createSpy('confirmSummary').and.resolveTo(true) };
    route = { snapshot: { paramMap: convertToParamMap({ id: '31' }) } };
    TestBed.configureTestingModule({
      imports: [RequestFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: route },
        { provide: TransportRequestService, useValue: requests },
        { provide: TransportDeliveryReceiptService, useValue: receipts },
        { provide: AuthService, useValue: auth },
        { provide: EventContextService, useValue: {
          activeEventId: signal(99), selectedAddress: signal('Otra dirección'),
          selectedDescription: signal('Otra asamblea'),
          events: signal([{ id: 4, description: 'Asamblea original', address: 'Dirección original' }]),
          requireActiveEventId: () => 99,
        } },
        { provide: InventoryItemService, useValue: { getAll: () => of(inventoryItems) } },
        { provide: StoreService, useValue: { getAll: () => of(stores) } },
        { provide: UserService, useValue: {} },
        { provide: TransportRequestPdfService, useValue: {} },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
        { provide: ConfirmationService, useValue: confirmation },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function openForm() {
    const fixture = TestBed.createComponent(RequestFormComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('locks returned items and their destination while allowing new pending rows', async () => {
    const fixture = openForm();
    const component = fixture.componentInstance;
    expect(component.partialEdit).toBeTrue();
    expect(receipts.getByTransportRequestId).toHaveBeenCalledWith(31, true);
    for (const name of ['eventId', 'requestedTo', 'targetDepartment', 'targetPlace', 'items']) {
      expect(component.form.get(name)?.disabled).withContext(name).toBeTrue();
    }
    expect(component.form.controls.requestedFrom.enabled).toBeTrue();
    expect(component.form.controls.observations.enabled).toBeTrue();
    expect(component.eventDescription).toBe('Asamblea original');
    expect(fixture.nativeElement.textContent).toContain('Los artículos entregados o con devoluciones están bloqueados');
    component.addItem();
    component.removeItem(0);
    expect(component.itemsArray.length).toBe(2);
    component.removeItem(1);
    expect(component.itemsArray.length).toBe(1);
    const next = jasmine.createSpy('next');
    component.validateGeneralStep({ next } as unknown as MatStepper);
    component.validateItemsStep({ next } as unknown as MatStepper);
    expect(next).toHaveBeenCalledTimes(2);
    expect(component.form.controls.eventId.value).toBe(4);
  });

  it('sends a full PUT with original locked fields and unmodified item values', async () => {
    const component = openForm().componentInstance;
    component.form.patchValue({
      observations: 'Corregida', requestedFrom: 'Materiales', requestDate: '2026-11-09',
      desiredDate: '2026-11-10', desiredTime: '10:30', estimatedAmount: 250,
      receivedBy: 'Ana', receivedDate: '2026-11-09', receivedTime: '11:45', authorizedBy: 'Luis',
      eventId: 99, requestedTo: 'Otro', targetPlace: 'Otro', targetDepartment: 'Otro',
    });
    component.itemsArray.at(0).patchValue({ quantity: 99, description: 'Otro' });
    await component.submit();
    expect(requests.update).toHaveBeenCalledOnceWith(31, {
      requestDate: '2026-11-09', status: 'APROBADA', requestedFrom: 'Materiales',
      requestedTo: 'Transporte', targetDepartment: null, targetPlace: 'Destino original',
      eventId: 4, desiredDate: '2026-11-10', desiredTime: '10:30:00', estimatedAmount: 250,
      observations: 'Corregida', receivedBy: 'Ana', receivedDate: '2026-11-09',
      receivedTime: '11:45:00', authorizedBy: 'Luis',
      items: [{ id: 7, quantity: 10, description: ' Silla ', sizeAndWeight: '', lineTotal: 0, articleControlType: 'LOTE', allocationMode: 'AUTO' }],
    });
    expect(requests.create).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/transport-requests']);
  });

  it('updates pending CO-30 rows with stable IDs before delivery', async () => {
    original.items[0].allocations[0].returnedQuantity = 0;
    const component = openForm().componentInstance;
    expect(component.itemsArray.at(0).enabled).toBeTrue();
    expect(component.form.controls.requestedTo.enabled).toBeTrue();
    expect(component.form.controls.eventId.disabled).toBeTrue();
    component.itemsArray.at(0).patchValue({ quantity: 6 });
    component.form.controls.targetPlace.setValue('Destino corregido');
    await component.submit();
    const body = requests.update.calls.mostRecent().args[1];
    expect(body.items[0]).toEqual({ id: 7, quantity: 6, description: 'Silla', sizeAndWeight: null,
      lineTotal: 0, articleControlType: 'LOTE', allocationMode: 'AUTO' });
    expect(body.targetPlace).toBe('Destino corregido');
  });

  it('protects a delivered row while allowing another pending row to change', async () => {
    original.items[0].allocations[0].returnedQuantity = 0;
    original.items[0].deliveryConfirmed = true;
    original.items.push({ ...original.items[0], id: 8, deliveryConfirmed: false,
      allocations: [{ ...original.items[0].allocations[0], returnedQuantity: 0 }] });
    const component = openForm().componentInstance;
    expect(component.itemsArray.at(0).disabled).toBeTrue();
    expect(component.itemsArray.at(1).enabled).toBeTrue();
    expect(component.destinationLocked).toBeTrue();
    component.itemsArray.at(0).patchValue({ quantity: 999 });
    component.itemsArray.at(1).patchValue({ quantity: 4 });
    await component.submit();
    const body = requests.update.calls.mostRecent().args[1];
    expect(body.items[0].quantity).toBe(10);
    expect(body.items[1].quantity).toBe(4);
  });

  it('locks all rows and prevents reverting the delivered request state', async () => {
    original.status = 'ENTREGADA';
    original.items[0].allocations[0].returnedQuantity = 0;
    const component = openForm().componentInstance;
    expect(component.itemsLocked).toBeTrue();
    expect(component.itemsArray.disabled).toBeTrue();
    component.addItem();
    expect(component.itemsArray.length).toBe(1);
    expect(component.statusRestriction('APROBADA')).not.toBeNull();
  });

  it('allows ENTREGADA but blocks cancellation and closure with outstanding returns', async () => {
    const component = openForm().componentInstance;
    expect(component.statusRestriction('ENTREGADA')).toBeNull();
    const blocked: TransportRequestStatus[] = ['ANULADA', 'CANCELADA', 'RECHAZADA', 'DEVUELTA', 'REGRESADA', 'CERRADA'];
    for (const status of blocked) {
      expect(component.statusRestriction(status)).withContext(status).not.toBeNull();
      component.form.controls.status.setValue(status);
      await component.submit();
    }
    expect(requests.update).not.toHaveBeenCalled();
    component.form.controls.status.setValue('ENTREGADA');
    await component.submit();
    expect(requests.update).toHaveBeenCalled();
  });

  it('allows closure after all allocated units have been returned', async () => {
    original.items[0].allocations[0].returnedQuantity = 10;
    const component = openForm().componentInstance;
    for (const status of ['DEVUELTA', 'REGRESADA', 'CERRADA'] as const) {
      expect(component.statusRestriction(status)).toBeNull();
    }
    component.form.controls.status.setValue('CERRADA');
    await component.submit();
    expect(requests.update).toHaveBeenCalled();
  });

  it('allows general corrections to a final request but prevents reactivation', async () => {
    original.status = 'DEVUELTA';
    original.stockReserved = false;
    const component = openForm().componentInstance;
    for (const status of ['SOLICITADA', 'APROBADA', 'EN_TRANSITO', 'ENTREGADA'] as const) {
      expect(component.statusRestriction(status)).not.toBeNull();
    }
    component.form.controls.observations.setValue('Corrección final');
    await component.submit();
    expect(requests.update.calls.mostRecent().args[1].status).toBe('DEVUELTA');
  });

  it('keeps full editing available when the CO-30 lookup returns 404', async () => {
    receipts.getByTransportRequestId.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const component = openForm().componentInstance;
    expect(component.partialEdit).toBeFalse();
    expect(component.form.controls.requestedTo.enabled).toBeTrue();
    expect(component.itemsArray.enabled).toBeTrue();
    component.addItem();
    expect(component.itemsArray.length).toBe(2);
    component.removeItem(1);
    expect(component.itemsArray.length).toBe(1);
    component.form.controls.targetPlace.setValue('Nuevo destino');
    await component.submit();
    expect(requests.update.calls.mostRecent().args[1].targetPlace).toBe('Nuevo destino');
  });

  for (const status of [403, 500]) {
    it(`prevents editing when CO-30 cannot be verified (${status})`, async () => {
      receipts.getByTransportRequestId.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      const fixture = openForm();
      expect(fixture.componentInstance.loadFailed).toBeTrue();
      expect(fixture.nativeElement.querySelector('mat-stepper')).toBeNull();
      await fixture.componentInstance.submit();
      expect(requests.update).not.toHaveBeenCalled();
    });
  }

  it('does not submit until both the CO-31 and receipt lookup have finished', async () => {
    const pending = new Subject<never>();
    receipts.getByTransportRequestId.and.returnValue(pending);
    const component = openForm().componentInstance;
    expect(component.loading).toBeTrue();
    await component.submit();
    expect(requests.update).not.toHaveBeenCalled();
    pending.complete();
  });

  for (const errorCode of [
    'INV-TRANSPORT-REQUEST-RECEIPT-001', 'INV-TRANSPORT-REQUEST-EVENT-001',
    'INV-TRANSPORT-REQUEST-DESTINATION-001', 'INV-TRANSPORT-REQUEST-IN-USE-001',
    'INV-TRANSPORT-REQUEST-RETURN-002', 'INV-TRANSPORT-REQUEST-REOPEN-001',
  ]) {
    it(`preserves form corrections and shows the backend message for ${errorCode}`, async () => {
      requests.update.and.returnValue(throwError(() => new HttpErrorResponse({
        status: 400, error: { errorCode, userMessage: 'Mensaje del servidor' },
      })));
      const component = openForm().componentInstance;
      component.form.controls.observations.setValue('No perder esta corrección');
      await component.submit();
      expect(component.errorMessage).toBe('Mensaje del servidor');
      expect(component.form.controls.observations.value).toBe('No perder esta corrección');
      expect(component.saving).toBeFalse();
      expect(navigate).not.toHaveBeenCalled();
    });
  }

  it('requires the existing TRANSPORT_REQUESTS edit permission to save', async () => {
    auth.canAccessAction.and.returnValue(false);
    const component = openForm().componentInstance;
    await component.submit();
    expect(auth.canAccessAction).toHaveBeenCalledWith('TRANSPORT_REQUESTS', 'edit');
    expect(requests.update).not.toHaveBeenCalled();
  });

  it('keeps the new request flow editable without querying a CO-30', async () => {
    route.snapshot.paramMap = convertToParamMap({});
    const component = openForm().componentInstance;
    expect(component.partialEdit).toBeFalse();
    expect(receipts.getByTransportRequestId).not.toHaveBeenCalled();
    component.form.patchValue({ requestDate: '2026-11-08', requestedFrom: 'Logística' });
    component.itemsArray.at(0).patchValue({ descriptionSource: 'Silla', description: 'Silla' });
    await component.submit();
    expect(requests.create).toHaveBeenCalled();
    expect(requests.update).not.toHaveBeenCalled();
  });
  it('does not send an update when nothing changed', async () => {
    const component = openForm().componentInstance;
    await component.submit();
    expect(confirmation.confirmSummary).not.toHaveBeenCalled();
    expect(requests.update).not.toHaveBeenCalled();
    expect(TestBed.inject(MatSnackBar).open).toHaveBeenCalledWith('No hay cambios para guardar.', 'Cerrar', jasmine.any(Object));
  });

  it('keeps the draft and sends nothing when the confirmation is cancelled', async () => {
    confirmation.confirmSummary.and.resolveTo(false);
    const component = openForm().componentInstance;
    component.form.controls.observations.setValue('Borrador');
    await component.submit();
    expect(confirmation.confirmSummary).toHaveBeenCalledTimes(1);
    expect(requests.update).not.toHaveBeenCalled();
    expect(component.form.controls.observations.value).toBe('Borrador');
    expect(component.saving).toBeFalse();
  });

  it('shows the pending CO-30 summary with the item diff before saving', async () => {
    original.items[0].allocations[0].returnedQuantity = 0;
    const component = openForm().componentInstance;
    component.itemsArray.at(0).patchValue({ quantity: 6 });
    await component.submit();
    const summary = confirmation.confirmSummary.calls.mostRecent().args[0];
    expect(summary.title).toBe('Confirmar cambios en el CO-31 CO-31-031');
    expect(summary.paragraphs[0]).toContain('artículos pendientes del CO-30 CO-30-030');
    expect(summary.rows).toContain(jasmine.objectContaining({ before: '10', after: '6' }));
    expect(summary.confirmText).toBe('Aplicar cambios');
    expect(requests.update).toHaveBeenCalledTimes(1);
  });

  it('warns about a full delivery when the status changes to ENTREGADA', async () => {
    const component = openForm().componentInstance;
    component.form.controls.status.setValue('ENTREGADA');
    await component.submit();
    const summary = confirmation.confirmSummary.calls.mostRecent().args[0];
    expect(summary.title).toBe('Confirmar entrega completa del CO-31 CO-31-031');
    expect(summary.confirmText).toBe('Sí, confirmar entrega completa');
  });

  it('keeps the draft and asks for a new review when another user delivered an item', async () => {
    original.items[0].allocations[0].returnedQuantity = 0;
    const component = openForm().componentInstance;
    component.itemsArray.at(0).patchValue({ quantity: 6 });
    original = structuredClone(original);
    original.items[0].deliveryConfirmed = true;
    await component.submit();
    expect(confirmation.confirmSummary).not.toHaveBeenCalled();
    expect(requests.update).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Otro usuario confirmó la entrega');
    expect(component.itemsArray.at(0).disabled).toBeTrue();
  });

  describe('manual store allocation', () => {
    function stock(storeId: number, availableQuantity: number) {
      return { storeId, storeName: `B${storeId}`, quantity: availableQuantity, existenceQuantity: availableQuantity,
        availableQuantity, reservedQuantity: 0, inUseQuantity: 0 };
    }

    beforeEach(() => {
      route.snapshot.paramMap = convertToParamMap({});
      inventoryItems = [{
        id: 2, description: 'Escoba', ownerUserId: 1, stateId: 1, stateTitle: 'Bueno', stateDescription: null,
        existenceQuantity: 30, availableQuantity: 30, reservedQuantity: 0, inUseQuantity: 0,
        storeStocks: [stock(2, 12), stock(5, 10), stock(8, 8)],
      }];
      stores = [
        { id: 2, description: 'MANIZALES', address: null, gpsCoordinates: null, phone: null, priorityOrder: 10, available: true },
        { id: 5, description: 'PEREIRA', address: null, gpsCoordinates: null, phone: null, priorityOrder: 20, available: true },
        { id: 8, description: 'INACTIVA', address: null, gpsCoordinates: null, phone: null, priorityOrder: 30, available: false },
      ];
      requests.previewAllocation.and.returnValue(of({ items: [{
        description: 'Escoba', quantity: 15, newItem: false, allocatedQuantity: 15, unavailableQuantity: 0,
        allocations: [
          { sourceStoreId: 2, sourceStoreName: 'MANIZALES', requestedQuantity: 12, allocatedQuantity: 12, status: 'PLANIFICADA' },
          { sourceStoreId: 5, sourceStoreName: 'PEREIRA', requestedQuantity: 3, allocatedQuantity: 3, status: 'PLANIFICADA' },
        ],
      }] }));
    });

    function openWithItem(quantity = 15) {
      const component = openForm().componentInstance;
      component.itemsArray.at(0).patchValue({ quantity, description: 'Escoba', descriptionSource: 'Escoba' });
      return component;
    }

    it('preloads the automatic suggestion when the toggle is enabled and only offers available stores', () => {
      const component = openWithItem();

      expect(component.canChooseManually(0)).toBeTrue();
      component.setManual(0, true);

      expect(requests.previewAllocation).toHaveBeenCalledWith({
        transportRequestId: null, items: [{ description: 'Escoba', quantity: 15 }],
      });
      expect(component.allocationLines(0).getRawValue()).toEqual([
        { sourceStoreId: 2, allocatedQuantity: 12 },
        { sourceStoreId: 5, allocatedQuantity: 3 },
      ]);
      expect(component.storeChoices(0, null).map((choice) => choice.id)).toEqual([2, 5]);
      expect(component.allocationTotals(0)).toEqual({ requested: 15, assigned: 15, missing: 0 });
    });

    it('does not offer the toggle without the manualAllocation action or for new articles', () => {
      auth.canAccessAction.and.callFake((_screen, action) => action !== 'manualAllocation');
      const component = openWithItem();
      expect(component.canChooseManually(0)).toBeFalse();

      auth.canAccessAction.and.returnValue(true);
      component.itemsArray.at(0).patchValue({ descriptionSource: '__NEW_ITEM__', description: 'Nuevo' });
      expect(component.canChooseManually(0)).toBeFalse();
    });

    it('sends MANUAL with the chosen stores and AUTO without allocations', async () => {
      const component = openWithItem();
      component.setManual(0, true);
      component.addItem();
      component.itemsArray.at(1).patchValue({ description: 'Mesa', descriptionSource: 'Mesa' });
      component.form.patchValue({ requestDate: '2026-11-08', requestedFrom: 'Logística' });

      await component.submit();

      const items = requests.create.calls.mostRecent().args[0].items;
      expect(items[0].allocationMode).toBe('MANUAL');
      expect(items[0].allocations).toEqual([
        { sourceStoreId: 2, allocatedQuantity: 12 },
        { sourceStoreId: 5, allocatedQuantity: 3 },
      ]);
      expect(items[1]).toEqual(jasmine.objectContaining({ allocationMode: 'AUTO' }));
      expect('allocations' in items[1]).toBeFalse();
    });

    it('blocks saving when a store exceeds its available stock', async () => {
      const component = openWithItem(20);
      component.setManual(0, true);
      component.allocationLines(0).at(0).patchValue({ sourceStoreId: 2, allocatedQuantity: 13 });
      component.form.patchValue({ requestDate: '2026-11-08', requestedFrom: 'Logística' });

      await component.submit();

      expect(requests.create).not.toHaveBeenCalled();
      expect(component.errorMessage).toContain('MANIZALES solo tiene 12');
    });

    it('returns to AUTO and clears the stores when the article changes', () => {
      const component = openWithItem();
      component.setManual(0, true);
      expect(component.isManual(0)).toBeTrue();

      component.itemsArray.at(0).patchValue({ descriptionSource: 'Mesa' });
      component.syncDescriptionFromSearch(0);

      expect(component.isManual(0)).toBeFalse();
      expect(component.allocationLines(0).length).toBe(0);
    });

    it('keeps the stores of a MANUAL item when editing without the permission', async () => {
      route.snapshot.paramMap = convertToParamMap({ id: '31' });
      original.stockReserved = false;
      original.items[0].allocationMode = 'MANUAL';
      original.items[0].allocations[0].returnedQuantity = 0;
      auth.canAccessAction.and.callFake((_screen, action) => action !== 'manualAllocation');
      const component = openForm().componentInstance;
      component.form.controls.observations.setValue('Solo observaciones');

      expect(component.isAllocationReadonly(0)).toBeTrue();
      await component.submit();

      expect(requests.update.calls.mostRecent().args[1].items[0]).toEqual(jasmine.objectContaining({
        allocationMode: 'MANUAL', allocations: [{ sourceStoreId: 3, allocatedQuantity: 10 }],
      }));
    });
  });
});
