import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject } from 'rxjs';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { StoreService } from '../../../core/services/store.service';
import { InventoryAdjustmentResponse } from '../../../models/inventory-adjustment.model';
import { InventoryAdjustmentDialogComponent } from './inventory-adjustment-dialog.component';

describe('InventoryAdjustmentDialogComponent', () => {
  let service: jasmine.SpyObj<InventoryItemService>;
  let ref: { close: jasmine.Spy; disableClose: boolean; keydownEvents: () => Subject<KeyboardEvent>; backdropClick: () => Subject<MouseEvent> };
  let keydown: Subject<KeyboardEvent>;

  beforeEach(() => {
    service = jasmine.createSpyObj('InventoryItemService', ['adjust', 'getAdjustments']);
    service.getAdjustments.and.returnValue(of([]));
    keydown = new Subject<KeyboardEvent>();
    ref = { close: jasmine.createSpy('close'), disableClose: false, keydownEvents: () => keydown, backdropClick: () => new Subject<MouseEvent>() };
    TestBed.configureTestingModule({
      imports: [InventoryAdjustmentDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: InventoryItemService, useValue: service },
        { provide: MatDialogRef, useValue: ref },
        { provide: MAT_DIALOG_DATA, useValue: { item: { id: 1, description: 'Silla', storeStocks: [{ storeId: 10 }] } } },
        { provide: StoreService, useValue: { getAll: () => of([
          { id: 10, description: 'Principal', available: true },
          { id: 11, description: 'Cerrada', available: false },
        ]) } },
      ],
    });
  });

  it('requires a reason and a positive quantity and offers available stores', () => {
    const fixture = TestBed.createComponent(InventoryAdjustmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ quantity: 3, reason: '   ' });
    component.save();
    expect(service.adjust).not.toHaveBeenCalled();
    expect(component.stores.map((store) => store.id)).toEqual([10]);
    expect(component.form.controls.reason.invalid).toBeTrue();
    component.form.patchValue({ quantity: 0, reason: 'Conteo' });
    component.save();
    expect(service.adjust).not.toHaveBeenCalled();
  });

  it('shows a review step before sending and never posts on cancel or Escape', () => {
    const fixture = TestBed.createComponent(InventoryAdjustmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ quantity: 3, reason: 'Sillas <b>dañadas</b>' });
    component.save();
    expect(service.adjust).not.toHaveBeenCalled();
    expect(component.step).toBe('review');
    expect(component.summary?.title).toBe('Confirmar ajuste de inventario');
    expect(component.summary?.paragraphs[0]).toContain('se retirarán 3 unidades de Silla de la existencia de Principal');
    fixture.detectChanges();
    expect(fixture.nativeElement.innerHTML).toContain('&lt;b&gt;');
    keydown.next(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.step).toBe('form');
    expect(ref.close).not.toHaveBeenCalled();
    expect(component.form.controls.reason.value).toBe('Sillas <b>dañadas</b>');
    expect(service.adjust).not.toHaveBeenCalled();
  });

  it('sends a reduction with the trimmed reason and prevents duplicate submissions', () => {
    const pending = new Subject<InventoryAdjustmentResponse>();
    service.adjust.and.returnValue(pending);
    const fixture = TestBed.createComponent(InventoryAdjustmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ quantity: 3, reason: '  Sillas dañadas  ' });
    component.save();
    component.apply();
    component.apply();
    expect(service.adjust).toHaveBeenCalledOnceWith(1, { storeId: 10, quantityDelta: -3, reason: 'Sillas dañadas' });
    pending.error({ error: { userMessage: 'Revisa las existencias.' } });
    expect(component.error).toBe('Revisa las existencias.');
    expect(component.form.controls.reason.value).toBe('  Sillas dañadas  ');
    expect(component.saving).toBeFalse();
    expect(ref.close).not.toHaveBeenCalled();
  });

  it('sends additions as positive quantities and shows the affected documents', () => {
    const result = { id: 8, storeId: 10, quantityDelta: 2, reason: 'Reposición', existenceBefore: 5, existenceAfter: 7,
      impacts: [{ requestId: 1, requestNumber: 'CO-31-1', receiptId: 2, receiptNumber: 'CO-30-2', requestItemId: 3,
        allocationId: 4, allocatedBefore: 1, allocatedAfter: 3 }] } as InventoryAdjustmentResponse;
    service.adjust.and.returnValue(of(result));
    const fixture = TestBed.createComponent(InventoryAdjustmentDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ direction: 'add', quantity: 2, reason: 'Reposición' });
    component.save();
    expect(component.summary?.paragraphs[0]).toContain('se agregarán 2 unidades');
    component.apply();
    expect(service.adjust).toHaveBeenCalledOnceWith(1, { storeId: 10, quantityDelta: 2, reason: 'Reposición' });
    expect(component.step).toBe('result');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('CO-30 CO-30-2');
    component.close();
    expect(ref.close).toHaveBeenCalledWith(jasmine.objectContaining({ id: 8 }));
  });
});
