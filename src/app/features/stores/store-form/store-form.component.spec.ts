import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { StoreService } from '../../../core/services/store.service';
import { StoreResponse } from '../../../models/store.model';
import { StoreFormComponent } from './store-form.component';

const EXISTING: StoreResponse = {
  id: 7,
  description: 'PEREIRA',
  address: 'CALLE 10',
  gpsCoordinates: null,
  phone: null,
  priorityOrder: 20,
  available: true,
};

describe('StoreFormComponent', () => {
  let fixture: ComponentFixture<StoreFormComponent>;
  let service: jasmine.SpyObj<StoreService>;
  let router: Router;

  function setup(id: string | null) {
    service = jasmine.createSpyObj<StoreService>('StoreService', ['getById', 'create', 'update']);
    service.getById.and.returnValue(of(EXISTING));
    TestBed.configureTestingModule({
      imports: [StoreFormComponent, NoopAnimationsModule],
      providers: [
        provideRouter([]),
        { provide: StoreService, useValue: service },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } },
        },
      ],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(StoreFormComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('requires description and address and rejects negative or decimal priority', () => {
    const component = setup(null);

    expect(component.form.invalid).toBeTrue();
    component.form.patchValue({ description: 'A', address: 'B', priorityOrder: -1 });
    expect(component.form.controls.priorityOrder.hasError('min')).toBeTrue();
    component.form.patchValue({ priorityOrder: 1.5 });
    expect(component.form.controls.priorityOrder.hasError('integer')).toBeTrue();
    component.form.patchValue({ priorityOrder: null });
    expect(component.form.valid).toBeTrue();
  });

  it('creates a store sending trimmed text, null for empty optionals and no priority', () => {
    const component = setup(null);
    service.create.and.returnValue(of(EXISTING));
    component.form.patchValue({ description: ' PEREIRA ', address: ' CALLE 10 ', phone: '  ' });

    component.submit();

    expect(service.create).toHaveBeenCalledWith({
      description: 'PEREIRA',
      address: 'CALLE 10',
      gpsCoordinates: null,
      phone: null,
      priorityOrder: null,
    });
    expect(router.navigate).toHaveBeenCalledWith(['/stores']);
  });

  it('preloads the store and updates sending the four fields without priority', () => {
    const component = setup('7');
    service.update.and.returnValue(of(EXISTING));

    expect(component.form.getRawValue().description).toBe('PEREIRA');
    component.submit();

    expect(service.update).toHaveBeenCalledWith(7, {
      description: 'PEREIRA',
      address: 'CALLE 10',
      gpsCoordinates: null,
      phone: null,
    });
  });

  it('keeps the form open and shows the backend message on duplicate store', () => {
    const component = setup(null);
    service.create.and.returnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { errorCode: 'INV-STORE-DUPLICATE-001', userMessage: 'Ya existe la bodega.' },
          }),
      ),
    );
    component.form.patchValue({ description: 'A', address: 'B' });

    component.submit();

    expect(component.errorMessage).toBe('Ya existe la bodega.');
    expect(component.saving).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
