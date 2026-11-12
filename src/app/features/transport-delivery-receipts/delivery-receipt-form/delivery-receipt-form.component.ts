import { ConfirmationService } from '../../../shared/confirmation.service';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject } from '@angular/core';
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
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, finalize } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
import { resolveProblemMessage } from '../../../core/problem-message';
import {
  buildCo30SaveSummary,
  buildDeliveryConfirmationSummary,
  isLastPendingItem,
} from '../../../domain/transport/co30-change-summary';
import { UpdateTransportDeliveryReceiptRequest } from '../../../models/transport-delivery-receipt.model';
import { AuthService } from '../../../core/services/auth.service';
import { TransportDeliveryReceiptPdfService } from '../../../core/services/transport-delivery-receipt-pdf.service';
import { TransportDeliveryReceiptService } from '../../../core/services/transport-delivery-receipt.service';
import {
  TransportDeliveryReceiptItemResponse,
  TransportDeliveryReceiptResponse,
} from '../../../models/transport-delivery-receipt.model';
import {
  CORRECTION_TYPE_LABELS,
  RECEIPT_CORRECTION_ERROR,
  RETRY_AUTOMATIC_ERRORS,
  STOCK_MODE_LABELS,
  correctionLockReason,
  correctionResultMessage,
  notFoundLockReason,
  removalLockReason,
} from '../../../domain/transport/co30-item-correction';
import {
  ReceiptItemCorrectionResponse,
  ReceiptItemCorrectionResultResponse,
  ReceiptItemCorrectionType,
} from '../../../models/transport-delivery-receipt.model';
import { TransportRequestStatus } from '../../../models/transport-request.model';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import {
  ItemCorrectionDialogComponent,
  ItemCorrectionDialogData,
  ItemCorrectionDialogResult,
} from '../item-correction-dialog/item-correction-dialog.component';
import { NativeDateTimePickerDirective } from '../../../shared/native-date-time-picker.directive';
import { RequestPdfDialogComponent } from '../../transport-requests/request-pdf-dialog/request-pdf-dialog.component';

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

interface DeliveryReceiptItemFormRaw {
  id: number;
  assignedTo: string;
  internalReturnQuantity: string | number | null;
  internalReturnDate: string;
  conditionNotes: string;
}

function internalReturnQuantityValidator(quantity: number): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return { internalReturnQuantity: true };
    }

    return numeric <= quantity ? null : { internalReturnQuantity: true };
  };
}

const resolveBackendUserMessage = resolveProblemMessage;

@Component({
  selector: 'app-delivery-receipt-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
    NativeDateTimePickerDirective,
  ],
  templateUrl: './delivery-receipt-form.component.html',
  styleUrl: './delivery-receipt-form.component.css',
})
export class DeliveryReceiptFormComponent implements OnInit {
  private readonly confirmation = inject(ConfirmationService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly receiptService = inject(TransportDeliveryReceiptService);
  private readonly receiptPdfService = inject(TransportDeliveryReceiptPdfService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly requestService = inject(TransportRequestService);

  readonly receiptId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly transportRequestId =
    Number(this.route.snapshot.paramMap.get('transportRequestId')) || null;
  readonly displayedColumns = [
    'articleNumber',
    'description',
    'assignedTo',
    'requestNumber',
    'quantity',
    'internalReturnQuantity',
    'internalReturnDate',
    'conditionNotes',
  ];
  readonly canConfirmDelivery = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'deliverItem'),
  );
  deliveringItemId: number | null = null;
  readonly canCorrectItemQuantity = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'correctItemQuantity'),
  );
  readonly canRemoveItem = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'removeItem'),
  );
  readonly canMarkItemNotFound = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'markItemNotFound'),
  );
  readonly correctionTypeLabels = CORRECTION_TYPE_LABELS;
  readonly stockModeLabels = STOCK_MODE_LABELS;
  /** Estado del CO-31 (el CO-30 no lo trae); `null` si no se pudo consultar. */
  requestStatus: TransportRequestStatus | null = null;
  corrections: ReceiptItemCorrectionResponse[] = [];
  correctionsError = '';
  correctingItemId: number | null = null;
  readonly canUpdateReceipts = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'update'),
  );

  readonly form = this.fb.group({
    ownerName: ['', [Validators.maxLength(255)]],
    ownerPhone: ['', [Validators.maxLength(30)]],
    ownerAddress: ['', [Validators.maxLength(500)]],
    observations: ['', [Validators.maxLength(5000)]],
    returnDeliveredTo: ['', [Validators.maxLength(255)]],
    returnDate: [''],
    returnReceivedBy: ['', [Validators.maxLength(255)]],
    items: this.fb.array([]),
  });

  receipt: TransportDeliveryReceiptResponse | null = null;
  missingReceipt = false;
  loading = false;
  generating = false;
  previewing = false;
  /** Esperando la respuesta del modal de confirmación. */
  reviewing = false;
  saving = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadReceipt();
  }

  get receiptItems(): FormArray {
    return this.form.controls.items as FormArray;
  }

  loadReceipt(): void {
    this.loading = true;
    this.missingReceipt = false;
    this.errorMessage = '';

    const request = this.receiptId
      ? this.receiptService.getById(this.receiptId)
      : this.receiptService.getByTransportRequestId(this.transportRequestId as number);

    request.pipe(finalize(() => (this.loading = false))).subscribe({
      next: (receipt) => {
        this.setReceipt(receipt);
        this.loadCorrectionContext(receipt);
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404 && err.error?.errorCode === 'INV-TRANSPORT-DELIVERY-404') {
          this.missingReceipt = true;
          return;
        }

        this.errorMessage = 'No se pudo cargar el recibo CO-30.';
      },
    });
  }

  async confirmItemDelivery(item: TransportDeliveryReceiptItemResponse): Promise<void> {
    if (!this.receipt || !this.canConfirmDelivery() || item.deliveryConfirmed || this.saving
      || this.reviewing || this.deliveringItemId !== null || this.correctingItemId !== null) return;
    if (this.form.dirty) {
      this.errorMessage = 'Guarda los cambios del formulario antes de confirmar la entrega.';
      return;
    }
    const receipt = this.receipt;
    const lastPending = isLastPendingItem(receipt, item);
    this.reviewing = true;
    let confirmed: boolean;
    try {
      confirmed = await this.confirmation.confirmSummary(buildDeliveryConfirmationSummary(receipt, item));
    } finally {
      this.reviewing = false;
    }
    if (!confirmed || this.deliveringItemId !== null || this.receipt !== receipt) return;
    this.deliveringItemId = item.id;
    this.errorMessage = '';
    // itemId es el renglón del CO-30 (no transportRequestItemId).
    this.receiptService.confirmItemDelivery(receipt.id, item.id)
      .pipe(finalize(() => this.deliveringItemId = null)).subscribe({
        next: (updated) => {
          this.setReceipt(updated);
          this.form.markAsPristine();
          const allDelivered = updated.items.every((current) => current.deliveryConfirmed);
          this.snackBar.open(lastPending && allDelivered
            ? `Entrega confirmada. La solicitud CO-31 ${updated.transportRequestNumber} pasó a ENTREGADA.`
            : `Entrega de ${item.description} confirmada en el CO-30 ${updated.receiptNumber}.`,
          'Cerrar', { duration: 6000 });
        },
        error: (error: HttpErrorResponse) => this.errorMessage = resolveBackendUserMessage(error,
          'No se pudo confirmar la entrega. Actualiza el CO-30 y vuelve a intentarlo.'),
      });
  }

  /** Motivo por el que el renglón no admite correcciones (`null` si está pendiente). */
  correctionLock(item: TransportDeliveryReceiptItemResponse): string | null {
    return correctionLockReason(item, this.requestStatus);
  }

  removalLock(item: TransportDeliveryReceiptItemResponse): string | null {
    return this.correctionLock(item) ?? (this.receipt ? removalLockReason(this.receipt) : null);
  }

  notFoundLock(item: TransportDeliveryReceiptItemResponse): string | null {
    return notFoundLockReason(item, this.requestStatus);
  }

  /** El usuario tiene al menos una de las acciones de corrección de renglones. */
  hasAnyCorrectionAction(): boolean {
    return this.canCorrectItemQuantity() || this.canRemoveItem() || this.canMarkItemNotFound();
  }

  get correctionBusy(): boolean {
    return this.saving || this.reviewing || this.deliveringItemId !== null || this.correctingItemId !== null;
  }

  correctItemQuantity(item: TransportDeliveryReceiptItemResponse): void {
    if (this.canCorrectItemQuantity()) this.openCorrection(item, 'QUANTITY_CHANGE');
  }

  removeItem(item: TransportDeliveryReceiptItemResponse): void {
    if (this.canRemoveItem() && !this.removalLock(item)) this.openCorrection(item, 'LINE_REMOVAL');
  }

  markItemNotFound(item: TransportDeliveryReceiptItemResponse): void {
    if (this.canMarkItemNotFound() && !this.notFoundLock(item)) this.openCorrection(item, 'NOT_FOUND');
  }

  private openCorrection(
    item: TransportDeliveryReceiptItemResponse,
    type: ReceiptItemCorrectionType,
    previous?: Partial<ItemCorrectionDialogData>,
  ): void {
    const receipt = this.receipt;
    if (!receipt || this.correctionBusy || this.correctionLock(item)) return;
    if (this.form.dirty) {
      this.errorMessage = 'Guarda los cambios del formulario antes de corregir un renglón.';
      return;
    }

    this.reviewing = true;
    this.dialog
      .open<ItemCorrectionDialogComponent, ItemCorrectionDialogData, ItemCorrectionDialogResult>(
        ItemCorrectionDialogComponent,
        {
          data: {
            receiptNumber: receipt.receiptNumber,
            requestNumber: receipt.transportRequestNumber,
            item,
            type,
            ...previous,
          },
          width: 'min(96vw, 40rem)',
        },
      )
      .afterClosed()
      .subscribe((result) => {
        this.reviewing = false;
        if (result && this.receipt === receipt) this.applyCorrection(receipt, item, type, result);
      });
  }

  private applyCorrection(
    receipt: TransportDeliveryReceiptResponse,
    item: TransportDeliveryReceiptItemResponse,
    type: ReceiptItemCorrectionType,
    result: ItemCorrectionDialogResult,
  ): void {
    this.correctingItemId = item.id;
    this.errorMessage = '';
    // itemId es el renglón del CO-30 (items[].id).
    const body = { quantity: result.quantity as number, stockMode: result.stockMode, reason: result.reason };
    const request: Observable<ReceiptItemCorrectionResultResponse> = type === 'LINE_REMOVAL'
      ? this.receiptService.removeItem(receipt.id, item.id, { stockMode: result.stockMode, reason: result.reason })
      : type === 'NOT_FOUND'
      ? this.receiptService.markItemNotFound(receipt.id, item.id, body)
      : this.receiptService.correctItemQuantity(receipt.id, item.id, body);

    request.pipe(finalize(() => (this.correctingItemId = null))).subscribe({
      next: ({ correction, receipt: updated }) => {
        this.setReceipt(updated);
        this.form.markAsPristine();
        this.loadCorrectionContext(updated);
        this.snackBar.open(correctionResultMessage(correction), 'Cerrar', {
          duration: correction.pendingManualQuantity !== 0 ? 12000 : 6000,
        });
      },
      error: (error: HttpErrorResponse) => void this.handleCorrectionError(error, receipt, item, type, result),
    });
  }

  private async handleCorrectionError(
    error: HttpErrorResponse,
    receipt: TransportDeliveryReceiptResponse,
    item: TransportDeliveryReceiptItemResponse,
    type: ReceiptItemCorrectionType,
    result: ItemCorrectionDialogResult,
  ): Promise<void> {
    const message = resolveBackendUserMessage(
      error,
      'No se pudo aplicar la corrección. Actualiza el CO-30 y vuelve a intentarlo.',
    );
    const code = error.error?.errorCode;

    if (error.status === 403) {
      // Perdió el permiso: se recargan las acciones permitidas para ocultarla.
      this.errorMessage = 'Ya no tienes permiso para esta acción.';
      this.auth.loadMyScreens().subscribe({ error: () => undefined });
      return;
    }

    if (RETRY_AUTOMATIC_ERRORS.includes(code)) {
      await this.offerRetry(message, receipt, item, type, result, 'AUTOMATIC',
        'No se puede aplicar en modo manual', '¿Quieres reintentarlo ajustando el inventario automáticamente?',
        'Usar modo automático');
      return;
    }

    if (code === RECEIPT_CORRECTION_ERROR.notFoundUnlocated) {
      await this.offerRetry(message, receipt, item, type, result, 'MANUAL',
        'No se ubicaron las unidades en bodega', '¿Quieres marcarlas en modo manual (sin tocar el inventario)?',
        'Usar modo manual', true);
      return;
    }

    this.errorMessage = message;
    if (code === RECEIPT_CORRECTION_ERROR.itemNotFound) this.loadReceipt();
  }

  /** Ofrece reabrir el modal con otro modo; si no se acepta, muestra el error (y recarga si se indica). */
  private async offerRetry(
    message: string,
    receipt: TransportDeliveryReceiptResponse,
    item: TransportDeliveryReceiptItemResponse,
    type: ReceiptItemCorrectionType,
    result: ItemCorrectionDialogResult,
    stockMode: ItemCorrectionDialogResult['stockMode'],
    title: string,
    question: string,
    confirmButtonText: string,
    reloadOnCancel = false,
  ): Promise<void> {
    const retry = await this.confirmation.confirm({ title, text: `${message} ${question}`, confirmButtonText });
    if (retry && this.receipt === receipt) {
      this.openCorrection(item, type, {
        initialStockMode: stockMode,
        initialQuantity: result.quantity,
        initialReason: result.reason,
      });
      return;
    }
    this.errorMessage = message;
    if (reloadOnCancel) this.loadReceipt();
  }

  /** Carga el estado del CO-31 y el historial de correcciones del CO-30. */
  private loadCorrectionContext(receipt: TransportDeliveryReceiptResponse): void {
    this.requestService.getById(receipt.transportRequestId).subscribe({
      next: (request) => {
        if (this.receipt?.id === receipt.id) this.requestStatus = request.status;
      },
      error: () => (this.requestStatus = null),
    });

    this.correctionsError = '';
    this.receiptService.getCorrections(receipt.id).subscribe({
      next: (corrections) => {
        if (this.receipt?.id === receipt.id) this.corrections = corrections;
      },
      error: () => (this.correctionsError = 'No se pudo cargar el historial de correcciones.'),
    });
  }

  generateReceipt(): void {
    if (!this.transportRequestId || this.generating) {
      return;
    }

    this.generating = true;
    this.errorMessage = '';

    this.receiptService
      .createFromTransportRequest(this.transportRequestId)
      .pipe(finalize(() => (this.generating = false)))
      .subscribe({
        next: (receipt) => {
          this.setReceipt(receipt);
          this.loadCorrectionContext(receipt);
          this.missingReceipt = false;
          void this.router.navigate(['/transport-delivery-receipts', receipt.id, 'edit'], {
            replaceUrl: true,
          });
        },
        error: () => (this.errorMessage = 'No se pudo generar el recibo CO-30.'),
      });
  }

  async previewReceiptPdf(): Promise<void> {
    if (!this.receipt || this.previewing) {
      return;
    }

    this.previewing = true;
    this.errorMessage = '';

    try {
      const previewReceipt = {
        ...this.receipt,
        ...this.buildReceiptHeaderPatch(),
        items: this.buildPreviewItems(),
      };
      const pdfUrl = await this.receiptPdfService.createReceiptPdfUrl(previewReceipt);
      const dialogRef = this.dialog.open(RequestPdfDialogComponent, {
        data: {
          pdfUrl,
          requestNumber: previewReceipt.receiptNumber,
          title: 'Formulario CO-30',
          subtitle: `Recibo CO-30 ${previewReceipt.receiptNumber} - Solicitud CO-31 ${previewReceipt.transportRequestNumber}`,
        },
        maxWidth: '96vw',
        panelClass: 'request-pdf-dialog-panel',
      });

      dialogRef.afterClosed().subscribe(() => this.receiptPdfService.revokePdfUrl(pdfUrl));
    } catch {
      this.errorMessage = 'No se pudo visualizar el formulario CO-30.';
    } finally {
      this.previewing = false;
    }
  }

  async submit(): Promise<void> {
    if (!this.canUpdateReceipts() || this.correctionBusy) {
      return;
    }

    if (!this.receipt || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const receipt = this.receipt;
    const body = this.buildUpdateBody();
    const summary = buildCo30SaveSummary(receipt, body);
    if (!summary) {
      this.snackBar.open('No hay cambios para guardar.', 'Cerrar', { duration: 4000 });
      return;
    }

    this.reviewing = true;
    let confirmed: boolean;
    try {
      confirmed = await this.confirmation.confirmSummary(summary);
    } finally {
      this.reviewing = false;
    }
    if (!confirmed || this.saving || this.receipt !== receipt) return;

    this.saving = true;
    this.errorMessage = '';

    // Se envía exactamente lo que el usuario revisó en el modal.
    this.receiptService
      .update(receipt.id, body)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (updated) => {
          this.setReceipt(updated);
          this.form.markAsPristine();
          this.snackBar.open(`CO-30 ${updated.receiptNumber} guardado.`, 'Cerrar', { duration: 5000 });
        },
        error: (err: HttpErrorResponse) =>
          (this.errorMessage = resolveBackendUserMessage(
            err,
            'No se pudo guardar el recibo CO-30. Tus correcciones se conservaron.',
          )),
      });
  }

  private buildUpdateBody(): UpdateTransportDeliveryReceiptRequest {
    const rawItems = this.form.getRawValue().items as DeliveryReceiptItemFormRaw[];
    return {
      ...this.buildReceiptHeaderPatch(),
      items: rawItems.map((item) => ({
        id: Number(item.id),
        assignedTo: toNullableText(item.assignedTo),
        // Acumulado devuelto (no incremento).
        internalReturnQuantity:
          item.internalReturnQuantity === '' ||
          item.internalReturnQuantity === null ||
          item.internalReturnQuantity === undefined
            ? null
            : Number(item.internalReturnQuantity),
        internalReturnDate: item.internalReturnDate || null,
        conditionNotes: toNullableText(item.conditionNotes),
      })),
    };
  }

  private setReceipt(receipt: TransportDeliveryReceiptResponse): void {
    this.receipt = receipt;
    this.form.patchValue({
      ownerName: receipt.ownerName ?? '',
      ownerPhone: receipt.ownerPhone ?? '',
      ownerAddress: receipt.ownerAddress ?? '',
      observations: receipt.observations ?? '',
      returnDeliveredTo: receipt.returnDeliveredTo ?? '',
      returnDate: receipt.returnDate ?? '',
      returnReceivedBy: receipt.returnReceivedBy ?? '',
    });
    this.receiptItems.clear();
    for (const item of receipt.items) {
      this.receiptItems.push(this.createReceiptItemGroup(item));
    }
  }

  private createReceiptItemGroup(item: TransportDeliveryReceiptItemResponse) {
    return this.fb.group({
      id: [item.id],
      assignedTo: [item.assignedTo ?? '', [Validators.maxLength(255)]],
      internalReturnQuantity: [
        item.internalReturnQuantity ?? '',
        [Validators.min(0), internalReturnQuantityValidator(item.allocatedQuantity ?? item.quantity)],
      ],
      internalReturnDate: [item.internalReturnDate ?? ''],
      conditionNotes: [item.conditionNotes ?? '', [Validators.maxLength(500)]],
    });
  }

  private buildReceiptHeaderPatch() {
    const raw = this.form.getRawValue();

    return {
      ownerName: toNullableText(raw.ownerName),
      ownerPhone: toNullableText(raw.ownerPhone),
      ownerAddress: toNullableText(raw.ownerAddress),
      observations: toNullableText(raw.observations),
      returnDeliveredTo: toNullableText(raw.returnDeliveredTo),
      returnDate: raw.returnDate || null,
      returnReceivedBy: toNullableText(raw.returnReceivedBy),
    };
  }

  private buildPreviewItems(): TransportDeliveryReceiptItemResponse[] {
    if (!this.receipt) {
      return [];
    }

    const itemEdits = this.form.getRawValue().items as DeliveryReceiptItemFormRaw[];

    return this.receipt.items.map((item, index) => {
      const edit = itemEdits[index];

      if (!edit) {
        return item;
      }

      return {
        ...item,
        assignedTo: toNullableText(edit.assignedTo),
        internalReturnQuantity:
          edit.internalReturnQuantity === '' ||
          edit.internalReturnQuantity === null ||
          edit.internalReturnQuantity === undefined
            ? null
            : Number(edit.internalReturnQuantity),
        internalReturnDate: edit.internalReturnDate || null,
        conditionNotes: toNullableText(edit.conditionNotes),
      };
    });
  }
}
