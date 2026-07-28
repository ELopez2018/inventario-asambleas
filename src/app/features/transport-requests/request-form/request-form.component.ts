import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { EventContextService } from '../../../core/services/event-context.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import { TransportRequestPdfService } from '../../../core/services/transport-request-pdf.service';
import { UserService } from '../../../core/services/user.service';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import {
  CreateTransportRequestRequest,
  TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES,
  TransportRequestItemRequest,
  TransportRequestStatus,
} from '../../../models/transport-request.model';
import { NativeDateTimePickerDirective } from '../../../shared/native-date-time-picker.directive';
import { RequestPdfDialogComponent } from '../request-pdf-dialog/request-pdf-dialog.component';

const DEFAULT_REQUESTED_TO = 'Transporte y Materiales';
const NEW_ITEM_OPTION = '__NEW_ITEM__';

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toApiLocalTime(value: string): string | null {
  if (!value) {
    return null;
  }

  return value.length === 5 ? `${value}:00` : value;
}

function fromApiLocalTime(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function decimalPrecisionValidator(
  maxIntegerDigits: number,
  maxFractionDigits: number,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return { decimalPrecision: true };
    }

    const normalized = String(value).trim();
    const unsigned = normalized.startsWith('-') ? normalized.slice(1) : normalized;
    const [integerPartRaw, fractionPartRaw = ''] = unsigned.split('.');
    const integerPart = integerPartRaw.replace(/^0+(?=\d)/, '');

    if (integerPart.length > maxIntegerDigits || fractionPartRaw.length > maxFractionDigits) {
      return { decimalPrecision: true };
    }

    return null;
  };
}

@Component({
  selector: 'app-request-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatStepperModule,
    MatTooltipModule,
    NativeDateTimePickerDirective,
  ],
  templateUrl: './request-form.component.html',
  styleUrl: './request-form.component.css',
})
export class RequestFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly requestService = inject(TransportRequestService);
  private readonly auth = inject(AuthService);
  readonly eventContext = inject(EventContextService);
  private readonly inventoryItemService = inject(InventoryItemService);
  private readonly userService = inject(UserService);
  private readonly requestPdfService = inject(TransportRequestPdfService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly quantityValidator = decimalPrecisionValidator(16, 2);
  private readonly lineTotalValidator = decimalPrecisionValidator(10, 2);
  readonly newItemOption = NEW_ITEM_OPTION;
  readonly statuses: TransportRequestStatus[] = [
    'SOLICITADA',
    'APROBADA',
    'EN_TRANSITO',
    'ENTREGADA',
    'ANULADA',
    'DEVUELTA',
    'REGRESADA',
    'CANCELADA',
    'RECHAZADA',
    'CERRADA',
  ];
  readonly displayDescriptionSource = (value: unknown): string =>
    value === NEW_ITEM_OPTION ? 'Articulo nuevo' : String(value ?? '');

  readonly requestId = Number(this.route.snapshot.paramMap.get('id')) || null;

  readonly form = this.fb.group({
    requestDate: ['', [Validators.required]],
    status: ['SOLICITADA' as TransportRequestStatus, [Validators.required]],
    requestedFrom: ['', [Validators.required, Validators.maxLength(255)]],
    requestedTo: [DEFAULT_REQUESTED_TO, [Validators.required, Validators.maxLength(255)]],
    targetDepartment: ['', [Validators.maxLength(255)]],
    targetPlace: ['', [Validators.maxLength(255)]],
    desiredDate: [''],
    desiredTime: [''],
    estimatedAmount: [0],
    observations: ['', [Validators.maxLength(1000)]],
    receivedBy: ['', [Validators.maxLength(255)]],
    receivedDate: [''],
    receivedTime: [''],
    authorizedBy: ['', [Validators.maxLength(255)]],
    eventId: [0, [Validators.required, Validators.min(1)]],
    items: this.fb.array([this.createItemGroup()]),
  });

  private readonly targetPlaceDefaultSync = effect(() => {
    const eventAddress = this.eventContext.selectedAddress().trim();
    const targetPlace = this.form.controls.targetPlace;

    if (!this.requestId && eventAddress && !targetPlace.dirty) {
      targetPlace.setValue(eventAddress, { emitEvent: false });
    }
  });

  readonly generalStepForm = this.fb.group({
    ready: [false, Validators.requiredTrue],
  });

  readonly itemsStepForm = this.fb.group({
    ready: [false, Validators.requiredTrue],
  });

  inventoryItems: InventoryItemResponse[] = [];
  requestedFromOptions: string[] = [];
  targetDepartmentOptions: string[] = [];
  requestNumberLabel = '';
  loading = false;
  loadingExamplePdf = false;
  saving = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadInventoryItems();
    this.loadAutocompleteOptions();
    this.loadReceivedByDefault();
    this.form.controls.eventId.setValue(this.eventContext.activeEventId() ?? 0);

    if (this.requestId) {
      this.loadRequest();
      return;
    }

    this.loadNextRequestNumber();
  }

  get itemsArray(): FormArray {
    return this.form.controls.items;
  }

  private createItemGroup() {
    return this.fb.group({
      quantity: [1, [Validators.required, Validators.min(0.01), this.quantityValidator]],
      descriptionSource: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.required, Validators.maxLength(255)]],
      sizeAndWeight: ['', [Validators.maxLength(255)]],
      lineTotal: ['', [this.lineTotalValidator]],
    });
  }

  getFilteredInventoryItems(value: unknown): InventoryItemResponse[] {
    const search = String(value ?? '')
      .trim()
      .toLocaleLowerCase('es-CO');

    const items = [...this.inventoryItems].sort((a, b) =>
      a.description.localeCompare(b.description, 'es-CO'),
    );

    if (!search) {
      return items.slice(0, 25);
    }

    return items.filter((item) => item.description.toLocaleLowerCase('es-CO').includes(search));
  }

  getFilteredTextOptions(options: string[], value: unknown): string[] {
    const search = String(value ?? '')
      .trim()
      .toLocaleLowerCase('es-CO');
    const sortedOptions = [...options].sort((a, b) => a.localeCompare(b, 'es-CO'));

    if (!search) {
      return sortedOptions.slice(0, 25);
    }

    return sortedOptions
      .filter((option) => option.toLocaleLowerCase('es-CO').includes(search))
      .slice(0, 25);
  }

  isNewItemDescription(index: number): boolean {
    return this.itemsArray.at(index).get('descriptionSource')?.value === NEW_ITEM_OPTION;
  }

  releasesStock(): boolean {
    return TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES.includes(this.form.controls.status.value);
  }

  onDescriptionOptionSelected(event: MatAutocompleteSelectedEvent, index: number): void {
    const itemGroup = this.itemsArray.at(index);
    const descriptionSource = itemGroup.get('descriptionSource');
    const description = itemGroup.get('description');
    const value = String(event.option.value ?? '');

    if (value === NEW_ITEM_OPTION) {
      descriptionSource?.setValue(NEW_ITEM_OPTION);
      description?.setValue('');
      description?.markAsTouched();
      return;
    }

    description?.setValue(value);
    description?.markAsTouched();
  }

  syncDescriptionFromSearch(index: number): void {
    const itemGroup = this.itemsArray.at(index);
    const descriptionSource = itemGroup.get('descriptionSource');
    const description = itemGroup.get('description');

    if (descriptionSource?.value === NEW_ITEM_OPTION) {
      return;
    }

    description?.setValue(String(descriptionSource?.value ?? ''));
  }

  private loadInventoryItems(): void {
    this.inventoryItemService.getAll().subscribe({
      next: (items) => {
        this.inventoryItems = items;
      },
      error: () => {
        this.inventoryItems = [];
      },
    });
  }

  private loadAutocompleteOptions(): void {
    this.requestService.getAutocompleteOptions().subscribe({
      next: (options) => {
        this.requestedFromOptions = options.requestedFrom ?? [];
        this.targetDepartmentOptions = options.targetDepartments ?? [];
      },
      error: () => {
        this.requestedFromOptions = [];
        this.targetDepartmentOptions = [];
      },
    });
  }

  private loadReceivedByDefault(): void {
    if (this.requestId || this.form.controls.receivedBy.value.trim()) {
      return;
    }

    const currentUser = this.auth.getCurrentUser();

    if (!currentUser?.userId) {
      return;
    }

    this.userService.getById(currentUser.userId).subscribe({
      next: (user) => {
        const fullName = `${user.firstName} ${user.lastName}`.trim();

        if (fullName && !this.form.controls.receivedBy.value.trim()) {
          this.form.controls.receivedBy.setValue(fullName);
        }
      },
      error: () => undefined,
    });
  }

  private loadNextRequestNumber(): void {
    this.requestService.getNextRequestNumber().subscribe({
      next: (response) => {
        this.requestNumberLabel = response.requestNumber;
      },
      error: () => {
        this.requestNumberLabel = 'Pendiente por asignar';
      },
    });
  }

  openExamplePdf(): void {
    if (this.loadingExamplePdf) {
      return;
    }

    this.loadingExamplePdf = true;
    this.errorMessage = '';

    this.requestService
      .getExamplePdf()
      .pipe(finalize(() => (this.loadingExamplePdf = false)))
      .subscribe({
        next: (blob) => {
          const pdfUrl = URL.createObjectURL(blob);
          const dialogRef = this.dialog.open(RequestPdfDialogComponent, {
            data: {
              pdfUrl,
              requestNumber: 'Ejemplo',
            },
            maxWidth: '96vw',
            panelClass: 'request-pdf-dialog-panel',
          });

          dialogRef.afterClosed().subscribe(() => this.requestPdfService.revokePdfUrl(pdfUrl));
        },
        error: () => {
          this.errorMessage = 'No se pudo cargar el ejemplo CO-31.';
        },
      });
  }

  addItem(): void {
    this.itemsArray.push(this.createItemGroup());
    this.itemsStepForm.patchValue({ ready: false });
  }

  removeItem(index: number): void {
    if (this.itemsArray.length === 1) {
      return;
    }

    this.itemsArray.removeAt(index);
    this.itemsStepForm.patchValue({ ready: false });
  }

  validateGeneralStep(stepper: MatStepper): void {
    try {
      this.form.controls.eventId.setValue(this.eventContext.requireActiveEventId());
    } catch {
      this.errorMessage = 'No hay evento activo configurado.';
      return;
    }

    const controls = [
      this.form.controls.requestDate,
      this.form.controls.status,
      this.form.controls.requestedFrom,
      this.form.controls.requestedTo,
      this.form.controls.targetDepartment,
      this.form.controls.targetPlace,
      this.form.controls.eventId,
    ];

    for (const control of controls) {
      control.markAsTouched();
      control.updateValueAndValidity({ emitEvent: false });
    }

    const isValid = controls.every((control) => control.valid);

    if (!isValid) {
      this.errorMessage = 'Complete los campos obligatorios de informacion general.';
      return;
    }

    this.errorMessage = '';
    this.generalStepForm.patchValue({ ready: true });
    stepper.next();
  }

  validateItemsStep(stepper: MatStepper): void {
    if (!this.itemsArray.length) {
      this.errorMessage = 'Debe registrar al menos un item de transporte.';
      return;
    }

    this.itemsArray.markAllAsTouched();
    this.itemsArray.updateValueAndValidity({ emitEvent: false });

    if (this.itemsArray.invalid) {
      this.errorMessage = 'Revise los items: cantidad y descripcion son obligatorios.';
      return;
    }

    this.errorMessage = '';
    this.itemsStepForm.patchValue({ ready: true });
    stepper.next();
  }

  private loadRequest(): void {
    this.loading = true;

    this.requestService
      .getById(this.requestId as number)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (request) => {
          this.form.patchValue({
            requestDate: request.requestDate,
            status: request.status,
            requestedFrom: request.requestedFrom,
            requestedTo: request.requestedTo,
            targetDepartment: request.targetDepartment ?? '',
            targetPlace: request.targetPlace ?? '',
            desiredDate: request.desiredDate ?? '',
            desiredTime: fromApiLocalTime(request.desiredTime),
            estimatedAmount: request.estimatedAmount ?? 0,
            observations: request.observations ?? '',
            receivedBy: request.receivedBy ?? '',
            receivedDate: request.receivedDate ?? '',
            receivedTime: fromApiLocalTime(request.receivedTime),
            authorizedBy: request.authorizedBy ?? '',
            eventId: request.eventId ?? 0,
          });
          this.requestNumberLabel = request.requestNumber;

          this.itemsArray.clear();
          for (const item of request.items) {
            this.itemsArray.push(
              this.fb.group({
                quantity: [
                  item.quantity,
                  [Validators.required, Validators.min(0.01), this.quantityValidator],
                ],
                descriptionSource: [
                  item.description,
                  [Validators.required, Validators.maxLength(255)],
                ],
                description: [item.description, [Validators.required, Validators.maxLength(255)]],
                sizeAndWeight: [item.sizeAndWeight ?? '', [Validators.maxLength(255)]],
                lineTotal: [item.lineTotal ?? '', [this.lineTotalValidator]],
              }),
            );
          }

          if (!request.items.length) {
            this.itemsArray.push(this.createItemGroup());
          }
        },
        error: () => (this.errorMessage = 'No se pudo cargar la solicitud.'),
      });
  }

  submit(): void {
    let selectedEventId: number;

    try {
      selectedEventId = this.eventContext.requireActiveEventId();
      this.form.controls.eventId.setValue(selectedEventId);
    } catch {
      this.errorMessage = 'No hay evento activo configurado.';
      return;
    }

    if (this.form.invalid || this.saving || this.itemsArray.length < 1) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const raw = this.form.getRawValue();

    const items: TransportRequestItemRequest[] = raw.items.map((item) => ({
      quantity: Number(item.quantity),
      description: item.description.trim(),
      sizeAndWeight: toNullableText(item.sizeAndWeight),
      lineTotal: toOptionalNumber(item.lineTotal),
    }));

    const body: CreateTransportRequestRequest = {
      requestDate: raw.requestDate,
      status: raw.status,
      requestedFrom: raw.requestedFrom.trim(),
      requestedTo: raw.requestedTo.trim(),
      targetDepartment: toNullableText(raw.targetDepartment),
      targetPlace: toNullableText(raw.targetPlace),
      desiredDate: raw.desiredDate || null,
      desiredTime: toApiLocalTime(raw.desiredTime),
      estimatedAmount: raw.estimatedAmount ? Number(raw.estimatedAmount) : null,
      observations: toNullableText(raw.observations),
      receivedBy: toNullableText(raw.receivedBy),
      receivedDate: raw.receivedDate || null,
      receivedTime: toApiLocalTime(raw.receivedTime),
      authorizedBy: toNullableText(raw.authorizedBy),
      eventId: selectedEventId,
      items,
    };

    const request = this.requestId
      ? this.requestService.update(this.requestId, body)
      : this.requestService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: (response) => {
        this.snackBar.open(
          response.stockReserved
            ? 'Solicitud guardada. El inventario queda reservado.'
            : 'Solicitud guardada. Los items quedan liberados.',
          'Cerrar',
          { duration: 5000 },
        );
        void this.router.navigate(['/transport-requests']);
      },
      error: () => (this.errorMessage = 'No se pudo guardar la solicitud.'),
    });
  }
}
