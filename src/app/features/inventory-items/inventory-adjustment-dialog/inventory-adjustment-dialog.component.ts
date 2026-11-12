import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { resolveProblemMessage } from '../../../core/problem-message';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { StoreService } from '../../../core/services/store.service';
import { ConfirmationSummary } from '../../../domain/confirmation/confirmation-summary';
import {
  ADJUSTMENT_REASON_MAX_LENGTH,
  buildAdjustmentConfirmationSummary,
  validateAdjustmentDraft,
} from '../../../domain/inventory/inventory-adjustment-summary';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import {
  InventoryAdjustmentRequest,
  InventoryAdjustmentResponse,
} from '../../../models/inventory-adjustment.model';
import { StoreResponse } from '../../../models/store.model';

type Step = 'form' | 'review' | 'result';

@Component({
  selector: 'app-inventory-adjustment-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    @switch (step) {
    @case ('review') {
    <h2 mat-dialog-title>{{ summary!.title }}</h2>
    <mat-dialog-content>
      <table class="w-full text-sm border-collapse mb-4">
        @for (row of summary!.rows; track row.label) {
        <tr class="border-b">
          <th class="text-left py-1 pr-3 align-top font-semibold">{{ row.label }}</th>
          <td class="py-1 break-words whitespace-pre-wrap">{{ row.before }}</td>
        </tr>
        }
      </table>
      @for (paragraph of summary!.paragraphs; track $index) {
      <p class="mb-3 text-sm">{{ paragraph }}</p>
      }
      @if (error) { <p role="alert" class="text-red-700">{{ error }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [disabled]="saving" (click)="backToForm()">{{ summary!.cancelText }}</button>
      <button mat-flat-button type="button" [color]="summary!.danger ? 'warn' : 'primary'" [disabled]="saving" (click)="apply()">
        {{ saving ? 'Aplicando cambios…' : summary!.confirmText }}
      </button>
    </mat-dialog-actions>
    }
    @case ('result') {
    <h2 mat-dialog-title>Ajuste registrado</h2>
    <mat-dialog-content>
      <p class="mb-3 text-sm">
        Existencia de {{ storeName(result!.storeId) }}: {{ result!.existenceBefore }} → {{ result!.existenceAfter }}
        ({{ result!.quantityDelta > 0 ? '+' : '' }}{{ result!.quantityDelta }}).
      </p>
      @if (result!.impacts.length) {
      <h3 class="font-semibold mb-2">Documentos afectados</h3>
      @for (impact of result!.impacts; track impact.allocationId) {
      <p class="text-sm">CO-31 {{ impact.requestNumber }}
        @if (impact.receiptNumber) { · CO-30 {{ impact.receiptNumber }} }
        : {{ impact.allocatedBefore }} → {{ impact.allocatedAfter }} asignadas</p>
      }
      } @else {
      <p class="text-sm">El ajuste no modificó asignaciones de pedidos; solo cambió el disponible.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button color="primary" type="button" (click)="ref.close(result)">Cerrar</button>
    </mat-dialog-actions>
    }
    @default {
    <h2 mat-dialog-title>Ajustar inventario · {{ data.item.description }}</h2>
    <mat-dialog-content>
      <p class="mb-4 text-sm">Las cantidades asignadas se corrigen desde el último pedido hacia los anteriores.
        Cada CO-30 conservará lo solicitado y mostrará el faltante.</p>
      <form [formGroup]="form" (ngSubmit)="save()" id="inventory-adjustment-form" class="grid gap-3">
        <mat-form-field appearance="outline">
          <mat-label>Bodega</mat-label>
          <mat-select formControlName="storeId">
            @for (store of stores; track store.id) {
              <mat-option [value]="store.id">{{ store.description }}</mat-option>
            }
          </mat-select>
          <mat-error>Selecciona la bodega.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Tipo de ajuste</mat-label>
          <mat-select formControlName="direction">
            <mat-option value="remove">Retirar unidades</mat-option>
            <mat-option value="add">Agregar unidades</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Unidades que se agregan o retiran</mat-label>
          <input matInput type="number" min="0.01" step="0.01" formControlName="quantity" />
          <mat-hint>Indica la diferencia, no la existencia final.</mat-hint>
          <mat-error>Indica una cantidad mayor que cero con hasta dos decimales.</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Razón del ajuste</mat-label>
          <textarea matInput formControlName="reason" rows="3" [maxlength]="reasonMaxLength"></textarea>
          <mat-hint align="end">{{ form.controls.reason.value.length }}/{{ reasonMaxLength }}</mat-hint>
          <mat-error>Explica la razón del ajuste (máximo 1000 caracteres).</mat-error>
        </mat-form-field>
      </form>
      @if (error) { <p role="alert" class="text-red-700">{{ error }}</p> }
      @if (history.length) {
        <h3 class="font-semibold mt-4">Historial de ajustes</h3>
        @for (adjustment of history; track adjustment.id) {
          <div class="border-t py-3 text-sm">
            <strong>{{ adjustment.quantityDelta > 0 ? '+' : '' }}{{ adjustment.quantityDelta }} unidades</strong>
            · {{ adjustment.createdAt | date:'short' }} · {{ storeName(adjustment.storeId) }}
            @if (adjustment.createdByUserId) { · Usuario #{{ adjustment.createdByUserId }} }
            <p class="break-words">{{ adjustment.reason }}</p>
            @for (impact of adjustment.impacts; track impact.allocationId) {
              <p>CO-31 {{ impact.requestNumber }}
                @if (impact.receiptNumber) { · CO-30 {{ impact.receiptNumber }} }
                : {{ impact.allocatedBefore }} → {{ impact.allocatedAfter }} asignadas</p>
            }
          </div>
        }
      }
      @if (historyError) { <p class="text-sm">{{ historyError }}</p> }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close()">Cancelar</button>
      <button mat-flat-button type="submit" form="inventory-adjustment-form" [disabled]="!stores.length">
        Revisar ajuste
      </button>
    </mat-dialog-actions>
    }
    }
  `,
})
export class InventoryAdjustmentDialogComponent implements OnInit {
  readonly data = inject<{ item: InventoryItemResponse; storeId?: number }>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<InventoryAdjustmentDialogComponent>);
  private readonly service = inject(InventoryItemService);
  private readonly storeService = inject(StoreService);
  private readonly destroyRef = inject(DestroyRef);
  readonly reasonMaxLength = ADJUSTMENT_REASON_MAX_LENGTH;
  readonly form = inject(FormBuilder).nonNullable.group({
    storeId: [this.data.storeId ?? this.data.item.storeStocks[0]?.storeId ?? 0, [Validators.required, Validators.min(1)]],
    direction: ['remove'],
    quantity: [0, [Validators.required, Validators.min(0.01), Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    reason: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(ADJUSTMENT_REASON_MAX_LENGTH)]],
  });
  stores: StoreResponse[] = [];
  private allStores: StoreResponse[] = [];
  history: InventoryAdjustmentResponse[] = [];
  historyError = '';
  error = '';
  saving = false;
  step: Step = 'form';
  summary: ConfirmationSummary | null = null;
  result: InventoryAdjustmentResponse | null = null;
  /** Cuerpo exacto revisado por el usuario; se invalida si vuelve al formulario. */
  private reviewed: InventoryAdjustmentRequest | null = null;

  ngOnInit() {
    // Escape o clic fuera: en revisión vuelve al formulario sin aplicar nada; nunca cierra mientras se aplica.
    this.ref.disableClose = true;
    this.ref.keydownEvents().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      if (event.key === 'Escape') this.dismiss();
    });
    this.ref.backdropClick().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.dismiss());

    this.storeService.getAll().subscribe({
      next: (stores) => {
        this.allStores = stores;
        this.stores = stores.filter((store) => store.available);
        if (!this.stores.some((store) => store.id === this.form.controls.storeId.value)) {
          this.form.controls.storeId.setValue(this.stores[0]?.id ?? 0);
        }
      },
      error: () => this.error = 'No se pudieron cargar las bodegas. Cierra el formulario y vuelve a intentar.',
    });
    this.loadHistory();
  }

  storeName(storeId: number): string {
    return this.allStores.find((store) => store.id === storeId)?.description ?? `Bodega #${storeId}`;
  }

  close() { if (!this.saving) this.ref.close(this.result ?? undefined); }

  private dismiss() {
    if (this.saving) return;
    if (this.step === 'review') { this.backToForm(); return; }
    this.close();
  }

  /** Valida y muestra el resumen. No llama al POST: ese endpoint ya aplica el cambio. */
  save() {
    if (this.saving || this.step !== 'form') return;
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();
    const body: InventoryAdjustmentRequest = {
      storeId: value.storeId,
      quantityDelta: value.direction === 'add' ? Number(value.quantity) : -Number(value.quantity),
      reason: value.reason.trim(),
    };
    const invalid = validateAdjustmentDraft(body);
    if (invalid) { this.error = invalid; return; }
    this.error = '';
    this.reviewed = body;
    this.summary = buildAdjustmentConfirmationSummary({
      itemDescription: this.data.item.description,
      storeName: this.storeName(body.storeId),
      quantityDelta: body.quantityDelta,
      reason: body.reason,
    });
    this.step = 'review';
  }

  backToForm() {
    if (this.saving) return;
    this.reviewed = null;
    this.summary = null;
    this.step = 'form';
  }

  /** Envía una sola vez el ajuste revisado. No se reintenta automáticamente. */
  apply() {
    if (this.saving || this.step !== 'review' || !this.reviewed) return;
    const body = this.reviewed;
    this.saving = true;
    this.error = '';
    this.service.adjust(this.data.item.id, body)
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: (result) => {
          this.result = { ...result, impacts: result.impacts ?? [] };
          this.reviewed = null;
          this.step = 'result';
          this.loadHistory();
        },
        error: (error) => this.error = resolveProblemMessage(error,
          'No se pudo registrar el ajuste. Revisa la cantidad e inténtalo nuevamente.'),
      });
  }

  private loadHistory() {
    this.service.getAdjustments(this.data.item.id).subscribe({
      next: (history) => { this.history = history; this.historyError = ''; },
      error: () => this.historyError = 'No se pudo cargar el historial de ajustes.',
    });
  }
}
