import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { StoreService } from '../../../core/services/store.service';
import { UserService } from '../../../core/services/user.service';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import { ItemFormComponent } from './item-form.component';

describe('ItemFormComponent', () => {
  const item: InventoryItemResponse = {
    id: 12,
    description: 'Silla',
    ownerUserId: 5,
    stateId: 1,
    stateTitle: 'Bueno',
    stateDescription: null,
    existenceQuantity: 10,
    availableQuantity: 7,
    reservedQuantity: 2,
    inUseQuantity: 1,
    storeStocks: [{
      storeId: 3,
      storeName: 'Principal',
      quantity: 7,
      existenceQuantity: 10,
      availableQuantity: 7,
      reservedQuantity: 2,
      inUseQuantity: 1,
    }],
  };
  let itemService: jasmine.SpyObj<InventoryItemService>;

  beforeEach(() => {
    itemService = jasmine.createSpyObj('InventoryItemService', ['create', 'update', 'getById']);
    itemService.create.and.returnValue(of(item));
    itemService.update.and.returnValue(of(item));
    itemService.getById.and.returnValue(of(item));
    TestBed.configureTestingModule({
      imports: [ItemFormComponent],
      providers: [
        provideRouter([]),
        { provide: InventoryItemService, useValue: itemService },
        { provide: UserService, useValue: { getAll: () => of([
          { id: 5, firstName: 'Ana', lastName: 'Lopez', phone: null, email: 'ana@example.com' },
        ]) } },
        { provide: StoreService, useValue: { getAll: () => of([
          { id: 2, description: 'Cerrado', available: false },
          { id: 3, description: 'Principal', available: true },
        ]) } },
      ],
    });
  });

  it('opens the new item form and saves its initial stock', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Nuevo articulo');
    expect(component.storeStocks.getRawValue()).toEqual([{ storeId: 3, quantity: 0 }]);
    component.form.patchValue({ description: ' Silla ', ownerUserId: 5 });
    component.storeStocks.at(0).patchValue({ quantity: 10 });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[type="submit"]').disabled).toBeFalse();
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true }));

    expect(itemService.create).toHaveBeenCalledOnceWith({
      description: 'Silla', ownerUserId: 5, stateId: 1,
      storeStocks: [{ storeId: 3, quantity: 10 }],
    });
    expect(navigate).toHaveBeenCalledWith(['/inventory-items']);
  });

  it('opens the edit form and preserves total existence when saving', () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id: '12' }) } },
    });
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(ItemFormComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.storeStocks.getRawValue()).toEqual([
      { storeId: 3, quantity: 10 },
    ]);
    fixture.componentInstance.submit();
    expect(itemService.update).toHaveBeenCalledOnceWith(12, {
      description: 'Silla', ownerUserId: 5, stateId: 1,
      storeStocks: [{ storeId: 3, quantity: 10 }],
    });
    expect(itemService.create).not.toHaveBeenCalled();
  });
});
