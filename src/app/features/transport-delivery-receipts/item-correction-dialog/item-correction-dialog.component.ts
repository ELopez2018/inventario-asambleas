import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { formatQuantity } from '../../../domain/confirmation/confirmation-summary';
import {
  CORRECTION_REASON_MAX_LENGTH,
  STOCK_MODE_LABELS,
  STOCK_MODE_REQUIRED_MESSAGE,
  automaticEffectMessage,
  estimateManualPending,
  manualPendingMessage,
  notFoundOf,
  notFoundRemaining,
  validateCorrectionDialogQuantity,
} from '../../../domain/transport/co30-item-correction';
import {
  ReceiptItemCorrectionStockMode,
  ReceiptItemCorrectionType,
  TransportDeliveryReceiptItemResponse,
} from '../../../models/transport-delivery-receipt.model';

export interface ItemCorrectionDialogData {
  receiptNumber: string;
  requestNumber: string;
  item: TransportDeliveryReceiptItemResponse;
  type: ReceiptItemCorrectionType;
  initialStockMode?: ReceiptItemCorrectionStockMode;
  initialQuantity?: number | null;
  initialReason?: string;
}

/** Lo que el usuario confirmó; `quantity` aplica a `QUANTITY_CHANGE` y `NOT_FOUND`. */
export interface ItemCorrectionDialogResult {
  quantity: number | null;
  stockMode: ReceiptItemCorrectionStockMode;
  reason: string;
}

const TITLES: Record<ReceiptItemCorrectionType, string> = {
  QUANTITY_CHANGE: 'Corregir cantidad',
  LINE_REMOVAL: 'Eliminar renglón',
  NOT_FOUND: 'Marcar unidades no encontradas',
};

const SUBMIT_LABELS: Record<ReceiptItemCorrectionType, string> = {
  QUANTITY_CHANGE: 'Aplicar corrección',
  LINE_REMOVAL: 'Eliminar renglón',
  NOT_FOUND: 'Marcar no encontradas',
};

const DOCUMENT_ONLY = 'Solo cambia el documento (CO-30 y CO-31); el inventario no se toca.';

@Component({
  selector: 'app-item-correction-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatRadioModule],
  template: `
    <h2 mat-dialog-title>{{ title }} · {{ data.item.description }}</h2>
    <mat-dialog-content>
      <p class="mb-3 text-sm">
        CO-30 {{ data.receiptNumber }} · CO-31 {{ data.requestNumber }} · Artículo {{ data.item.articleNumber }}.
        Cantidad actual: <strong>{{ fmt(data.item.quantity) }}</strong>
        (asignada: {{ fmt(data.item.allocatedQuantity ?? data.item.quantity) }}@if (notFound > 0) {, no encontradas: {{ fmt(notFound) }}}).
        El cambio se aplica también al renglón del CO-31.
      </p>
      @if (isRemoval) {
      <p class="mb-3 text-sm text-red-700">El renglón se eliminará del CO-30 y del CO-31. Esta acción queda en el historial.</p>
      }
      @if (isNotFound) {
      <p class="mb-3 text-sm">
        El renglón conserva la cantidad solicitada y mostrará la nota «(-N No se encontraron)». Las unidades marcadas
        no se vuelven a reservar. Puedes marcar hasta <strong>{{ fmt(remaining) }}</strong>.
      </p>
      }
      <form [formGroup]="form" (ngSubmit)="confirm()" id="item-correction-form" class="grid gap-3">
        @if (hasQuantity) {
        <mat-form-field appearance="outline">
          <mat-label>{{ isNotFound ? 'Unidades no encontradas' : 'Nueva cantidad' }}</mat-label>
          <input matInput type="number" min="0.01" step="0.01" [attr.max]="isNotFound ? remaining : null"
            formControlName="quantity" />
          <mat-error>{{ form.controls.quantity.errors?.['quantity'] }}</mat-error>
        </mat-form-field>
        }

        <div>
          <div class="mb-1 text-sm font-semibold">¿Cómo se ajusta el inventario? *</div>
          <mat-radio-group formControlName="stockMode" class="flex flex-col gap-1" aria-label="Modo de ajuste de inventario"
            aria-required="true">
            <mat-radio-button value="AUTOMATIC">{{ labels.AUTOMATIC }}</mat-radio-button>
            <mat-radio-button value="MANUAL">{{ labels.MANUAL }}</mat-radio-button>
          </mat-radio-group>
          @if (form.controls.stockMode.invalid && form.controls.stockMode.touched) {
          <p class="mt-1 text-sm text-red-700" role="alert">{{ stockModeRequired }}</p>
          } @else if (value().stockMode) {
          <p class="mt-1 text-sm text-slate-700">{{ modeHint() }}</p>
          }
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Razón</mat-label>
          <textarea matInput rows="3" formControlName="reason" [maxlength]="reasonMaxLength"></textarea>
          <mat-hint align="end">{{ reason().length }}/{{ reasonMaxLength }}</mat-hint>
          <mat-error>Indica la razón (máximo {{ reasonMaxLength }} caracteres).</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="ref.close()">Cancelar</button>
      <button mat-flat-button type="submit" form="item-correction-form" [color]="isRemoval ? 'warn' : 'primary'">
        {{ submitLabel }}
      </button>
    </mat-dialog-actions>
  `,
})
export class ItemCorrectionDialogComponent {
  readonly data = inject<ItemCorrectionDialogData>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<ItemCorrectionDialogComponent, ItemCorrectionDialogResult>);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly isRemoval = this.data.type === 'LINE_REMOVAL';
  readonly isNotFound = this.data.type === 'NOT_FOUND';
  readonly hasQuantity = !this.isRemoval;
  readonly title = TITLES[this.data.type];
  readonly submitLabel = SUBMIT_LABELS[this.data.type];
  readonly notFound = notFoundOf(this.data.item);
  readonly remaining = notFoundRemaining(this.data.item);
  readonly labels = STOCK_MODE_LABELS;
  readonly stockModeRequired = STOCK_MODE_REQUIRED_MESSAGE;
  readonly reasonMaxLength = CORRECTION_REASON_MAX_LENGTH;
  readonly fmt = formatQuantity;

  readonly form = this.fb.group({
    quantity: this.fb.control<number | string | null>(this.data.initialQuantity ?? null,
      this.hasQuantity ? [(control: AbstractControl): ValidationErrors | null => {
        const message = validateCorrectionDialogQuantity(this.data.type, control.value, this.data.item);
        return message ? { quantity: message } : null;
      }] : []),
    // Sin preselección: el usuario debe elegir el modo.
    stockMode: this.fb.control<ReceiptItemCorrectionStockMode | null>(this.data.initialStockMode ?? null,
      [Validators.required]),
    reason: [this.data.initialReason ?? '', [Validators.required, Validators.maxLength(CORRECTION_REASON_MAX_LENGTH)]],
  });

  readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });

  readonly reason = () => this.value().reason ?? '';

  readonly modeHint = (): string => {
    const raw = this.value().quantity;
    const quantity = raw === null || raw === '' || raw === undefined ? null : Number(raw);
    if (this.value().stockMode === 'AUTOMATIC') {
      return automaticEffectMessage(this.data.item, this.data.type, quantity);
    }
    const pending = estimateManualPending(this.data.item, this.data.type, quantity);
    if (this.isRemoval) {
      return pending < 0
        ? 'En modo manual solo se puede eliminar si el renglón no tiene unidades asignadas en bodega; este renglón tiene unidades asignadas.'
        : DOCUMENT_ONLY;
    }
    if (this.isNotFound && pending < 0) {
      return `El inventario no se toca: ${formatQuantity(-pending)} unidades siguen asignadas a esta solicitud. `
        + 'Registra después un ajuste negativo.';
    }
    return manualPendingMessage(pending) ?? DOCUMENT_ONLY;
  };

  confirm(): void {
    this.form.markAllAsTouched();
    const raw = this.form.getRawValue();
    const reason = raw.reason.trim();
    if (!reason) this.form.controls.reason.setErrors({ required: true });
    if (this.form.invalid || !reason || !raw.stockMode) return;

    this.ref.close({
      quantity: this.hasQuantity ? Number(raw.quantity) : null,
      stockMode: raw.stockMode,
      reason,
    });
  }
}
