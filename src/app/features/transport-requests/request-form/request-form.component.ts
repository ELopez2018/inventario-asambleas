import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, effect, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormGroup,
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, finalize, firstValueFrom, forkJoin, of, throwError } from 'rxjs';
import { resolveProblemMessage } from '../../../core/problem-message';
import {
  buildCo31ConfirmationSummary,
  transportRequestFingerprint,
} from '../../../domain/transport/co31-change-summary';
import {
  summarizeManualAllocation,
  validateManualAllocation,
} from '../../../domain/transport/manual-allocation';
import { ConfirmationService } from '../../../shared/confirmation.service';
import { AuthService } from '../../../core/services/auth.service';
import { EventContextService } from '../../../core/services/event-context.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { StoreService } from '../../../core/services/store.service';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import { TransportDeliveryReceiptService } from '../../../core/services/transport-delivery-receipt.service';
import { TransportRequestPdfService } from '../../../core/services/transport-request-pdf.service';
import { UserService } from '../../../core/services/user.service';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import { StoreResponse } from '../../../models/store.model';
import {
  AllocationMode,
  ArticleControlType,
  CreateTransportRequestRequest,
  TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES,
  TransportRequestItemRequest,
  TransportRequestResponse,
  TransportRequestStatus,
} from '../../../models/transport-request.model';
import { NativeDateTimePickerDirective } from '../../../shared/native-date-time-picker.directive';
import { RequestPdfDialogComponent } from '../request-pdf-dialog/request-pdf-dialog.component';

const DEFAULT_REQUESTED_TO = 'Transporte y Materiales';
const NEW_ITEM_OPTION = '__NEW_ITEM__';

interface TransportRequestItemFormRaw {
  id: number;
  quantity: number;
  description: string;
  sizeAndWeight: string;
  lineTotal: string | number;
  articleControlType: ArticleControlType;
  allocationMode: AllocationMode;
  allocations: { sourceStoreId: number | null; allocatedQuantity: number | null }[];
}

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

const resolveBackendUserMessage = resolveProblemMessage;

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
    MatSlideToggleModule,
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
  private readonly receiptService = inject(TransportDeliveryReceiptService);
  private readonly auth = inject(AuthService);
  readonly eventContext = inject(EventContextService);
  private readonly inventoryItemService = inject(InventoryItemService);
  private readonly storeService = inject(StoreService);
  private readonly userService = inject(UserService);
  private readonly requestPdfService = inject(TransportRequestPdfService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly confirmation = inject(ConfirmationService);
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
  readonly articleControlTypes: { value: ArticleControlType; label: string }[] = [
    { value: 'INDIVIDUAL', label: 'Individual' },
    { value: 'LOTE', label: 'Lote' },
    { value: 'KIT', label: 'Kit' },
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
  stores: StoreResponse[] = [];
  private backendRequestedFromOptions: string[] = [];
  requestedFromOptions: string[] = [];
  targetDepartmentOptions: string[] = [];
  requestNumberLabel = '';
  private originalRequest: TransportRequestResponse | null = null;
  private loadedFingerprint = '';
  receiptId: number | null = null;
  receiptNumber: string | null = null;
  loadFailed = false;
  loading = false;
  loadingExamplePdf = false;
  /** Verificando el estado vigente o esperando la respuesta del modal. */
  reviewing = false;
  saving = false;
  errorMessage = '';

  /** Renglón del CO-31 cargado que corresponde al grupo del formulario (por ID, no por posición). */
  originalItemAt(index: number) {
    const id = this.itemsArray.at(index)?.get('id')?.value;
    return id ? this.originalRequest?.items.find((item) => item.id === id) ?? null : null;
  }

  get partialEdit(): boolean {
    return this.receiptId !== null;
  }

  get itemsLocked(): boolean {
    return this.partialEdit && !!this.originalRequest && (this.originalRequest.status === 'ENTREGADA'
      || TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES.includes(this.originalRequest.status));
  }

  get destinationLocked(): boolean {
    return this.itemsLocked || (this.partialEdit && !!this.originalRequest?.items.some((item) =>
      item.deliveryConfirmed || item.allocations.some((allocation) => allocation.returnedQuantity > 0)));
  }

  isItemLocked(index: number): boolean {
    if (this.itemsLocked) return true;
    const id = this.itemsArray.at(index)?.get('id')?.value;
    const original = this.originalRequest?.items.find((item) => item.id === id);
    return this.partialEdit && !!original && (!!original.deliveryConfirmed
      || original.allocations.some((allocation) => allocation.returnedQuantity > 0));
  }

  get canSave(): boolean {
    return !this.requestId || this.auth.canAccessAction('TRANSPORT_REQUESTS', 'edit');
  }

  get eventDescription(): string {
    const original = this.originalRequest;
    if (this.partialEdit && original) {
      return this.eventContext.events().find((event) => event.id === original.eventId)
        ?.description ?? `Asamblea #${original.eventId}`;
    }
    return this.eventContext.selectedDescription() || 'Sin evento activo';
  }

  get eventAddress(): string {
    const original = this.originalRequest;
    if (this.partialEdit && original) {
      return this.eventContext.events().find((event) => event.id === original.eventId)
        ?.address ?? '';
    }
    return this.eventContext.selectedAddress();
  }

  statusRestriction(status: TransportRequestStatus): string | null {
    const current = this.originalRequest;
    if (!this.partialEdit || !current || status === current.status) {
      return null;
    }
    const isFinal = TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES.includes(status);
    if (current.status === 'ENTREGADA' && !isFinal && status !== 'ENTREGADA') {
      return 'La entrega ya está confirmada. Conserve ENTREGADA o registre la devolución para finalizar.';
    }
    if (TRANSPORT_REQUEST_RELEASE_STOCK_STATUSES.includes(current.status) && !isFinal) {
      return 'La solicitud está finalizada y conserva un CO-30. No se puede reactivar.';
    }
    if (current.stockReserved && ['ANULADA', 'CANCELADA', 'RECHAZADA'].includes(status)) {
      return 'La solicitud tiene material en uso. Registre la devolución en el CO-30 y finalícela como DEVUELTA, REGRESADA o CERRADA.';
    }
    const pendingReturns = current.items.some((item) => item.allocations.some((allocation) =>
      allocation.itemId !== null && allocation.allocatedQuantity > allocation.returnedQuantity,
    ));
    if (current.stockReserved && isFinal && pendingReturns) {
      return 'Registre la devolución completa de las unidades asignadas en el CO-30 antes de finalizar la solicitud.';
    }
    return null;
  }

  ngOnInit(): void {
    this.loadInventoryItems();
    this.loadStores();
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
      id: [0],
      quantity: [1, [Validators.required, Validators.min(0.01), this.quantityValidator]],
      descriptionSource: ['', [Validators.required, Validators.maxLength(255)]],
      description: ['', [Validators.required, Validators.maxLength(255)]],
      articleControlType: ['INDIVIDUAL' as ArticleControlType, [Validators.required]],
      sizeAndWeight: ['', [Validators.maxLength(255)]],
      lineTotal: ['', [this.lineTotalValidator]],
      allocationMode: ['AUTO' as AllocationMode],
      allocations: this.fb.array<FormGroup>([]),
    });
  }

  private createAllocationLine(sourceStoreId: number | null = null, allocatedQuantity: number | null = null) {
    return this.fb.group({
      sourceStoreId: [sourceStoreId],
      allocatedQuantity: [allocatedQuantity, [Validators.min(0.01), this.quantityValidator]],
    });
  }

  getStoreLabel(storeId: number | null | undefined): string {
    if (!storeId) {
      return 'Sin bodega';
    }

    return this.stores.find((store) => store.id === storeId)?.description
      ?? this.originalRequest?.items
        .flatMap((item) => item.allocations)
        .find((allocation) => allocation.sourceStoreId === storeId)?.sourceStoreName
      ?? `Bodega #${storeId}`;
  }

  // ---- Asignación manual de bodegas (por renglón) ----

  get canManualAllocation(): boolean {
    return this.auth.canAccessAction('TRANSPORT_REQUESTS', 'manualAllocation');
  }

  previewingIndex: number | null = null;

  allocationLines(index: number): FormArray {
    return this.itemsArray.at(index).get('allocations') as FormArray;
  }

  isManual(index: number): boolean {
    return this.itemsArray.at(index)?.get('allocationMode')?.value === 'MANUAL';
  }

  /** Artículo registrado en inventario que corresponde a la descripción del renglón. */
  private inventoryItemFor(index: number): InventoryItemResponse | null {
    if (this.isNewItemDescription(index)) return null;
    const description = String(this.itemsArray.at(index)?.get('description')?.value ?? '').trim();
    return description
      ? this.inventoryItems.find((item) => item.description.trim() === description) ?? null
      : null;
  }

  /** Con CO-30, un renglón ya asignado no se reasigna salvo que cambie su cantidad. */
  private allocationFrozen(index: number): boolean {
    if (!this.partialEdit) return false;
    const group = this.itemsArray.at(index);
    const original = this.originalRequest?.items.find((item) => item.id === group.get('id')?.value);
    return !!original
      && original.allocations.some((allocation) => allocation.sourceStoreId !== null)
      && Number(group.get('quantity')?.value) === Number(original.quantity);
  }

  canChooseManually(index: number): boolean {
    return this.canManualAllocation && !this.isItemLocked(index) && !this.allocationFrozen(index)
      && !this.releasesStock() && !!this.inventoryItemFor(index);
  }

  isAllocationReadonly(index: number): boolean {
    return this.isManual(index) && !this.canChooseManually(index);
  }

  /** Unidades asignables por bodega: bodegas disponibles con existencia, más lo que este pedido ya reservó. */
  private availableByStore(index: number): Map<number, number> {
    const available = new Map<number, number>();
    const item = this.inventoryItemFor(index);
    if (!item) return available;

    const own = new Map<number, number>();
    if (this.originalRequest?.stockReserved) {
      for (const allocation of this.originalItemAt(index)?.allocations ?? []) {
        if (allocation.sourceStoreId !== null && ['PLANIFICADA', 'PARCIAL'].includes(allocation.status)) {
          own.set(allocation.sourceStoreId, (own.get(allocation.sourceStoreId) ?? 0) + allocation.allocatedQuantity);
        }
      }
    }

    for (const stock of item.storeStocks ?? []) {
      if (!this.stores.find((store) => store.id === stock.storeId)?.available) continue;
      const total = Math.round((stock.availableQuantity + (own.get(stock.storeId) ?? 0)) * 100) / 100;
      if (total > 0) available.set(stock.storeId, total);
    }
    return available;
  }

  storeChoices(index: number, selected: number | null): { id: number; label: string; available: number }[] {
    const available = this.availableByStore(index);
    const choices = [...available].map(([id, quantity]) => ({
      id, available: quantity, label: `${this.getStoreLabel(id)} (disp. ${quantity})`,
    }));
    if (selected !== null && selected !== undefined && !available.has(selected)) {
      choices.push({ id: selected, available: 0, label: `${this.getStoreLabel(selected)} (no disponible)` });
    }
    return choices.sort((a, b) => a.label.localeCompare(b.label, 'es-CO'));
  }

  availableForLine(index: number, storeId: number | null): number | null {
    return storeId === null || storeId === undefined ? null : this.availableByStore(index).get(storeId) ?? 0;
  }

  allocationTotals(index: number) {
    return summarizeManualAllocation(
      Number(this.itemsArray.at(index).get('quantity')?.value) || 0,
      this.allocationLines(index).getRawValue(),
    );
  }

  allocationReviewLabel(index: number): string {
    if (this.partialEdit) return 'Se conservan las entregas y se actualizan los pendientes';
    if (!this.isManual(index)) return 'Automatico por prioridad de bodegas';
    const lines = this.allocationLines(index).getRawValue() as
      { sourceStoreId: number | null; allocatedQuantity: number | null }[];
    return 'Manual: ' + lines
      .map((line) => `${this.getStoreLabel(line.sourceStoreId)} ${line.allocatedQuantity ?? 0}`)
      .join(', ');
  }

  setManual(index: number, enabled: boolean): void {
    if (!this.canChooseManually(index) || this.previewingIndex !== null) return;

    const group = this.itemsArray.at(index);
    const lines = this.allocationLines(index);
    lines.clear();

    if (!enabled) {
      group.get('allocationMode')?.setValue('AUTO');
      return;
    }

    group.get('allocationMode')?.setValue('MANUAL');
    const description = String(group.get('description')?.value ?? '').trim();
    const quantity = Number(group.get('quantity')?.value);

    if (!description || !(quantity > 0)) {
      lines.push(this.createAllocationLine());
      return;
    }

    // Punto de partida: lo que asignaría el modo automático; el usuario lo ajusta.
    this.previewingIndex = index;
    this.requestService
      .previewAllocation({ transportRequestId: this.requestId, items: [{ description, quantity }] })
      .pipe(finalize(() => (this.previewingIndex = null)))
      .subscribe({
        next: (preview) => {
          if (this.isManual(index) && !lines.length) {
            for (const allocation of preview.items[0]?.allocations ?? []) {
              if (allocation.sourceStoreId !== null && allocation.allocatedQuantity > 0) {
                lines.push(this.createAllocationLine(allocation.sourceStoreId, allocation.allocatedQuantity));
              }
            }
          }
          if (!lines.length) lines.push(this.createAllocationLine());
        },
        error: (err: HttpErrorResponse) => {
          this.errorMessage = resolveBackendUserMessage(err, 'No se pudo calcular la asignación sugerida.');
          if (!lines.length) lines.push(this.createAllocationLine());
        },
      });
  }

  addAllocation(index: number): void {
    if (!this.isAllocationReadonly(index)) this.allocationLines(index).push(this.createAllocationLine());
  }

  removeAllocation(index: number, lineIndex: number): void {
    if (!this.isAllocationReadonly(index)) this.allocationLines(index).removeAt(lineIndex);
  }

  /** Cambiar el artículo invalida las bodegas elegidas: el renglón vuelve a AUTO. */
  private resetAllocation(index: number): void {
    if (!this.isManual(index)) return;
    this.allocationLines(index).clear();
    this.itemsArray.at(index).get('allocationMode')?.setValue('AUTO');
  }

  /** Errores de los renglones MANUAL editables; los de solo lectura se validan en el backend. */
  private manualAllocationErrors(): string[] {
    const errors: string[] = [];
    this.itemsArray.controls.forEach((group, index) => {
      if (!this.isManual(index) || this.isAllocationReadonly(index) || this.isItemLocked(index)) return;
      const description = String(group.get('description')?.value ?? '').trim() || 'sin descripción';
      validateManualAllocation(
        Number(group.get('quantity')?.value) || 0,
        this.allocationLines(index).getRawValue(),
        this.availableByStore(index),
        (storeId) => this.getStoreLabel(storeId),
      ).forEach((message) => errors.push(`Renglón ${index + 1} (${description}): ${message}`));
    });
    return errors;
  }

  getStoreOptionLabel(store: StoreResponse): string {
    const priority = Number.isFinite(store.priorityOrder) ? store.priorityOrder : 'sin prioridad';
    return `${store.description} - prioridad ${priority}`;
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
    if (this.isItemLocked(index)) return;
    const itemGroup = this.itemsArray.at(index);
    const descriptionSource = itemGroup.get('descriptionSource');
    const description = itemGroup.get('description');
    const value = String(event.option.value ?? '');

    this.resetAllocation(index);

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
    if (this.isItemLocked(index)) return;
    const itemGroup = this.itemsArray.at(index);
    const descriptionSource = itemGroup.get('descriptionSource');
    const description = itemGroup.get('description');

    if (descriptionSource?.value === NEW_ITEM_OPTION) {
      return;
    }

    this.resetAllocation(index);
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

  private loadStores(): void {
    this.storeService.getAll().subscribe({
      next: (stores) => {
        this.stores = stores;
        this.syncRequestedFromOptions();
      },
      error: () => {
        this.stores = [];
        this.syncRequestedFromOptions();
      },
    });
  }

  private loadAutocompleteOptions(): void {
    this.requestService.getAutocompleteOptions().subscribe({
      next: (options) => {
        this.backendRequestedFromOptions = options.requestedFrom ?? [];
        this.syncRequestedFromOptions();
        this.targetDepartmentOptions = options.targetDepartments ?? [];
      },
      error: () => {
        this.backendRequestedFromOptions = [];
        this.syncRequestedFromOptions();
        this.targetDepartmentOptions = [];
      },
    });
  }

  private syncRequestedFromOptions(): void {
    const storeDescriptions = this.stores
      .filter((store) => store.available)
      .map((store) => store.description);

    this.requestedFromOptions = Array.from(
      new Set([...storeDescriptions, ...this.backendRequestedFromOptions].filter(Boolean)),
    );
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
    if (this.itemsLocked) return;
    this.itemsArray.push(this.createItemGroup());
    this.itemsStepForm.patchValue({ ready: false });
  }

  removeItem(index: number): void {
    if (this.isItemLocked(index) || this.itemsArray.length === 1) {
      return;
    }

    this.itemsArray.removeAt(index);
    this.itemsStepForm.patchValue({ ready: false });
  }

  validateGeneralStep(stepper: MatStepper): void {
    try {
      if (!this.partialEdit) {
        this.form.controls.eventId.setValue(this.eventContext.requireActiveEventId());
      }
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

    const isValid = controls.every((control) => control.disabled || control.valid);

    const restriction = this.statusRestriction(this.form.controls.status.value);
    if (restriction) {
      this.errorMessage = restriction;
      return;
    }

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
      this.errorMessage =
        'Revise los items: cantidad, descripcion y tipo de control.';
      return;
    }

    const allocationErrors = this.manualAllocationErrors();
    if (allocationErrors.length) {
      this.errorMessage = allocationErrors.join(' ');
      return;
    }

    this.errorMessage = '';
    this.itemsStepForm.patchValue({ ready: true });
    stepper.next();
  }

  /** CO-31 y su CO-30. Solo un 404 de recibo inexistente permite continuar sin CO-30. */
  private fetchRequestWithReceipt() {
    return forkJoin({
      request: this.requestService.getById(this.requestId as number),
      receipt: this.receiptService.getByTransportRequestId(this.requestId as number, true).pipe(
        catchError((err: HttpErrorResponse) => err.status === 404 ? of(null) : throwError(() => err)),
      ),
    });
  }

  private setLoadedState(request: TransportRequestResponse, receipt: { id: number; receiptNumber: string } | null): void {
    this.originalRequest = structuredClone(request);
    this.receiptId = receipt?.id ?? null;
    this.receiptNumber = receipt?.receiptNumber ?? null;
    this.loadedFingerprint = transportRequestFingerprint(request, this.receiptId);
  }

  /** Aplica los bloqueos vigentes sin borrar el borrador del usuario. */
  private applyLocks(): void {
    if (!this.partialEdit) return;
    this.form.controls.eventId.disable();
    if (this.destinationLocked) {
      this.form.controls.requestedTo.disable();
      this.form.controls.targetDepartment.disable();
      this.form.controls.targetPlace.disable();
    }
    if (this.itemsLocked) {
      this.itemsArray.disable();
      return;
    }
    this.itemsArray.controls.forEach((group, index) => {
      if (this.isItemLocked(index)) group.disable();
    });
  }

  /**
   * Relee CO-31 y CO-30 antes de confirmar. Si otro usuario cambió el registro, conserva el
   * borrador, actualiza los bloqueos y pide una nueva revisión. Un fallo de esta lectura no
   * bloquea el guardado: el backend conserva la validación final.
   */
  private async detectConcurrentChanges(): Promise<boolean> {
    let fresh: { request: TransportRequestResponse; receipt: { id: number; receiptNumber: string } | null };
    try {
      fresh = await firstValueFrom(this.fetchRequestWithReceipt());
    } catch {
      return false;
    }
    const freshReceiptId = fresh.receipt?.id ?? null;
    if (transportRequestFingerprint(fresh.request, freshReceiptId) === this.loadedFingerprint) {
      return false;
    }
    const deliveredNow = fresh.request.items.some((item) => item.deliveryConfirmed
      && !this.originalRequest?.items.find((current) => current.id === item.id)?.deliveryConfirmed);
    this.setLoadedState(fresh.request, fresh.receipt);
    this.applyLocks();
    this.errorMessage = (deliveredNow
      ? 'Otro usuario confirmó la entrega de uno o más artículos mientras editabas.'
      : 'El CO-31 o su CO-30 cambió mientras editabas.')
      + ' Se conservó tu borrador y se actualizaron los bloqueos. Revisa los cambios y vuelve a guardar.';
    return true;
  }

  private loadRequest(): void {
    this.loading = true;
    this.loadFailed = false;

    this.fetchRequestWithReceipt()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ request, receipt }) => {
          this.setLoadedState(request, receipt);
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
            const itemGroup = this.createItemGroup();
            itemGroup.patchValue({
              id: item.id,
              quantity: item.quantity,
              descriptionSource: item.description,
              description: item.description,
              articleControlType: item.articleControlType ?? 'INDIVIDUAL',
              sizeAndWeight: item.sizeAndWeight ?? '',
              lineTotal: item.lineTotal == null ? '' : String(item.lineTotal),
              allocationMode: item.allocationMode ?? 'AUTO',
            });

            if (item.allocationMode === 'MANUAL') {
              const byStore = new Map<number, number>();
              for (const allocation of item.allocations) {
                if (allocation.sourceStoreId !== null && allocation.allocatedQuantity > 0) {
                  byStore.set(allocation.sourceStoreId,
                    (byStore.get(allocation.sourceStoreId) ?? 0) + allocation.allocatedQuantity);
                }
              }
              const lines = itemGroup.get('allocations') as FormArray;
              byStore.forEach((quantity, storeId) => lines.push(this.createAllocationLine(storeId, quantity)));
            }

            this.itemsArray.push(itemGroup);
          }

          if (!request.items.length && !this.partialEdit) {
            this.itemsArray.push(this.createItemGroup());
          }
          this.applyLocks();
        },
        error: (err: HttpErrorResponse) => {
          this.loadFailed = true;
          this.errorMessage = resolveBackendUserMessage(err,
            'No se pudo cargar la solicitud o verificar su CO-30. Vuelva a abrir el formulario para reintentar.');
        },
      });
  }

  async submit(): Promise<void> {
    if (this.loading || this.loadFailed || this.saving || this.reviewing) return;
    if (!this.canSave) {
      this.errorMessage = 'No tiene permiso para editar esta solicitud CO-31.';
      return;
    }
    const restriction = this.statusRestriction(this.form.controls.status.value);
    if (restriction) {
      this.errorMessage = restriction;
      return;
    }
    let selectedEventId: number;

    try {
      selectedEventId = this.partialEdit
        ? this.originalRequest!.eventId as number
        : this.eventContext.requireActiveEventId();
      if (!this.partialEdit) this.form.controls.eventId.setValue(selectedEventId);
    } catch {
      this.errorMessage = 'No hay evento activo configurado.';
      return;
    }

    if (this.form.invalid || this.itemsArray.length < 1) {
      this.form.markAllAsTouched();
      return;
    }

    const allocationErrors = this.manualAllocationErrors();
    if (allocationErrors.length) {
      this.errorMessage = allocationErrors.join(' ');
      return;
    }

    this.errorMessage = '';

    if (!this.requestId) {
      this.send(this.buildRequestBody(selectedEventId));
      return;
    }

    // Edición: comparar, verificar el estado vigente y confirmar antes de enviar.
    this.reviewing = true;
    let body: CreateTransportRequestRequest;
    try {
      if (await this.detectConcurrentChanges()) return;
      body = this.buildRequestBody(this.partialEdit ? this.originalRequest!.eventId as number : selectedEventId);
      const summary = buildCo31ConfirmationSummary(
        this.originalRequest!, body, this.receiptNumber, (storeId) => this.getStoreLabel(storeId));
      if (!summary) {
        this.snackBar.open('No hay cambios para guardar.', 'Cerrar', { duration: 4000 });
        return;
      }
      if (!(await this.confirmation.confirmSummary(summary))) return;
    } finally {
      this.reviewing = false;
    }

    // Se envía exactamente el cuerpo que el usuario acaba de revisar.
    this.send(body);
  }

  /** En AUTO no se envían `allocations`; en MANUAL se envían todas las bodegas elegidas. */
  private allocationFields(
    mode: AllocationMode,
    lines: { sourceStoreId: number | null; allocatedQuantity: number | null }[],
  ): Pick<TransportRequestItemRequest, 'allocationMode' | 'allocations'> {
    if (mode !== 'MANUAL') return { allocationMode: 'AUTO' };
    return {
      allocationMode: 'MANUAL',
      allocations: lines
        .filter((line) => line.sourceStoreId !== null && Number(line.allocatedQuantity) > 0)
        .map((line) => ({
          sourceStoreId: line.sourceStoreId as number,
          allocatedQuantity: Number(line.allocatedQuantity),
        })),
    };
  }

  private buildRequestBody(eventId: number): CreateTransportRequestRequest {
    const raw = this.form.getRawValue();

    const rawItems = raw.items as unknown as TransportRequestItemFormRaw[];
    const items: TransportRequestItemRequest[] = rawItems.map((item, index) => {
      const original = this.originalRequest?.items.find((current) => current.id === item.id);
      if (this.isItemLocked(index) && original) {
        return { id: original.id, quantity: original.quantity, description: original.description,
          sizeAndWeight: original.sizeAndWeight, lineTotal: original.lineTotal,
          articleControlType: original.articleControlType,
          ...this.allocationFields(
            original.allocationMode ?? 'AUTO',
            original.allocations.map((a) => ({ sourceStoreId: a.sourceStoreId, allocatedQuantity: a.allocatedQuantity })),
          ) };
      }
      return {
        ...(item.id ? { id: item.id } : {}),
        quantity: Number(item.quantity), description: item.description.trim(),
        sizeAndWeight: toNullableText(item.sizeAndWeight), lineTotal: toOptionalNumber(item.lineTotal),
        articleControlType: item.articleControlType,
        ...this.allocationFields(item.allocationMode, item.allocations),
      };
    });

    return {
      requestDate: raw.requestDate,
      status: raw.status,
      requestedFrom: raw.requestedFrom.trim(),
      requestedTo: this.destinationLocked ? this.originalRequest!.requestedTo : raw.requestedTo.trim(),
      targetDepartment: this.destinationLocked
        ? this.originalRequest!.targetDepartment
        : toNullableText(raw.targetDepartment),
      targetPlace: this.destinationLocked
        ? this.originalRequest!.targetPlace
        : toNullableText(raw.targetPlace),
      desiredDate: raw.desiredDate || null,
      desiredTime: toApiLocalTime(raw.desiredTime),
      estimatedAmount: raw.estimatedAmount ? Number(raw.estimatedAmount) : null,
      observations: toNullableText(raw.observations),
      receivedBy: toNullableText(raw.receivedBy),
      receivedDate: raw.receivedDate || null,
      receivedTime: toApiLocalTime(raw.receivedTime),
      authorizedBy: toNullableText(raw.authorizedBy),
      eventId,
      items,
    };
  }

  private send(body: CreateTransportRequestRequest): void {
    if (this.saving) return;
    this.saving = true;
    this.errorMessage = '';

    const request = this.requestId
      ? this.requestService.update(this.requestId, body)
      : this.requestService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: (response) => {
        this.snackBar.open(
          this.partialEdit
            ? response.status === 'ENTREGADA' && this.originalRequest?.status !== 'ENTREGADA'
              ? `CO-31 ${response.requestNumber} marcado como ENTREGADA con sus artículos del CO-30.`
              : `CO-31 ${response.requestNumber} y artículos pendientes del CO-30 ${this.receiptNumber ?? ''} actualizados. Se conservaron las entregas confirmadas.`
            : response.stockReserved
              ? 'Solicitud CO-31 guardada. El inventario queda reservado.'
              : 'Solicitud CO-31 guardada. Los items quedan liberados.',
          'Cerrar',
          { duration: 6000 },
        );
        void this.router.navigate(['/transport-requests']);
      },
      error: (err: HttpErrorResponse) =>
        (this.errorMessage = resolveBackendUserMessage(err, 'No se pudo guardar la solicitud CO-31. Tus correcciones se conservaron.')),
    });
  }
}
