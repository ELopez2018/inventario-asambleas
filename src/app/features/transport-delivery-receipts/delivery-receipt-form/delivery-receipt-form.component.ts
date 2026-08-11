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
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TransportDeliveryReceiptPdfService } from '../../../core/services/transport-delivery-receipt-pdf.service';
import { TransportDeliveryReceiptService } from '../../../core/services/transport-delivery-receipt.service';
import {
  TransportDeliveryReceiptItemResponse,
  TransportDeliveryReceiptResponse,
} from '../../../models/transport-delivery-receipt.model';
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

function resolveBackendUserMessage(err: HttpErrorResponse, fallback: string): string {
  const problem = err.error as
    | { userMessage?: string; detail?: string; message?: string; title?: string }
    | null
    | undefined;

  return problem?.userMessage ?? problem?.detail ?? problem?.message ?? problem?.title ?? fallback;
}

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
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly receiptService = inject(TransportDeliveryReceiptService);
  private readonly receiptPdfService = inject(TransportDeliveryReceiptPdfService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

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
      next: (receipt) => this.setReceipt(receipt),
      error: (err: HttpErrorResponse) => {
        if (err.status === 404 && err.error?.errorCode === 'INV-TRANSPORT-DELIVERY-404') {
          this.missingReceipt = true;
          return;
        }

        this.errorMessage = 'No se pudo cargar el recibo CO-30.';
      },
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
          subtitle: `Recibo ${previewReceipt.receiptNumber} - Solicitud ${previewReceipt.transportRequestNumber}`,
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

  submit(): void {
    if (!this.canUpdateReceipts()) {
      return;
    }

    if (!this.receipt || this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const raw = this.form.getRawValue();
    const rawItems = raw.items as DeliveryReceiptItemFormRaw[];

    this.receiptService
      .update(this.receipt.id, {
        ...this.buildReceiptHeaderPatch(),
        items: rawItems.map((item) => ({
          id: Number(item.id),
          assignedTo: toNullableText(item.assignedTo),
          internalReturnQuantity:
            item.internalReturnQuantity === '' ||
            item.internalReturnQuantity === null ||
            item.internalReturnQuantity === undefined
              ? null
              : Number(item.internalReturnQuantity),
          internalReturnDate: item.internalReturnDate || null,
          conditionNotes: toNullableText(item.conditionNotes),
        })),
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (receipt) => this.setReceipt(receipt),
        error: (err: HttpErrorResponse) =>
          (this.errorMessage = resolveBackendUserMessage(
            err,
            'No se pudo guardar el recibo CO-30.',
          )),
      });
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
        [Validators.min(0), internalReturnQuantityValidator(item.quantity)],
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
