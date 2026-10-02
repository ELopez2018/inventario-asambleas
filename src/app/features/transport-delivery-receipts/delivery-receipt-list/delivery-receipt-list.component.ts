import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { TransportDeliveryReceiptPdfService } from '../../../core/services/transport-delivery-receipt-pdf.service';
import { TransportDeliveryReceiptService } from '../../../core/services/transport-delivery-receipt.service';
import { TransportDeliveryReceiptResponse } from '../../../models/transport-delivery-receipt.model';
import { RequestPdfDialogComponent } from '../../transport-requests/request-pdf-dialog/request-pdf-dialog.component';

@Component({
  selector: 'app-delivery-receipt-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './delivery-receipt-list.component.html',
  styleUrl: './delivery-receipt-list.component.css',
})
export class DeliveryReceiptListComponent implements OnInit {
  private readonly receiptService = inject(TransportDeliveryReceiptService);
  private readonly receiptPdfService = inject(TransportDeliveryReceiptPdfService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  readonly displayedColumns = [
    'receiptNumber',
    'receiptDate',
    'transportRequestNumber',
    'ownerName',
    'items',
    'actions',
  ];
  readonly viewTabs: { value: 'number' | 'owner'; label: string }[] = [
    { value: 'number', label: 'Por numero' },
    { value: 'owner', label: 'Por propietario' },
  ];
  readonly canEditReceipts = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'edit'),
  );
  readonly canDeleteReceipts = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'delete'),
  );

  receipts: TransportDeliveryReceiptResponse[] = [];
  viewMode: 'number' | 'owner' = 'number';
  previewingReceiptId: number | null = null;
  deletingReceiptId: number | null = null;
  loading = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadReceipts();
  }

  loadReceipts(): void {
    this.loading = true;
    this.errorMessage = '';

    this.receiptService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (receipts) => (this.receipts = this.sortReceipts(receipts)),
        error: () => (this.errorMessage = 'No se pudieron cargar los recibos CO-30.'),
      });
  }

  changeViewTab(index: number): void {
    this.viewMode = this.viewTabs[index]?.value ?? 'number';
    this.receipts = this.sortReceipts(this.receipts);
  }

  selectedViewIndex(): number {
    return Math.max(
      this.viewTabs.findIndex((tab) => tab.value === this.viewMode),
      0,
    );
  }

  shouldShowOwnerGroup(index: number): boolean {
    if (this.viewMode !== 'owner') {
      return false;
    }

    const owner = this.getOwnerGroupLabel(this.receipts[index]);
    const previousOwner = index > 0 ? this.getOwnerGroupLabel(this.receipts[index - 1]) : null;

    return owner !== previousOwner;
  }

  getOwnerGroupLabel(receipt: TransportDeliveryReceiptResponse): string {
    return receipt.ownerName?.trim() || 'Sin propietario';
  }

  private sortReceipts(
    receipts: TransportDeliveryReceiptResponse[],
  ): TransportDeliveryReceiptResponse[] {
    return [...receipts].sort((a, b) => {
      if (this.viewMode === 'owner') {
        const ownerCompare = this.getOwnerGroupLabel(a).localeCompare(
          this.getOwnerGroupLabel(b),
          'es-CO',
        );

        if (ownerCompare !== 0) {
          return ownerCompare;
        }
      }

      return a.receiptNumber.localeCompare(b.receiptNumber, 'es-CO', { numeric: true });
    });
  }

  async previewReceiptPdf(receipt: TransportDeliveryReceiptResponse): Promise<void> {
    if (this.previewingReceiptId) {
      return;
    }

    this.previewingReceiptId = receipt.id;
    this.errorMessage = '';

    try {
      const pdfUrl = await this.receiptPdfService.createReceiptPdfUrl(receipt);
      const dialogRef = this.dialog.open(RequestPdfDialogComponent, {
        data: {
          pdfUrl,
          requestNumber: receipt.receiptNumber,
          title: 'Formulario CO-30',
          subtitle: `Recibo CO-30 ${receipt.receiptNumber} - Solicitud CO-31 ${receipt.transportRequestNumber}`,
        },
        maxWidth: '96vw',
        panelClass: 'request-pdf-dialog-panel',
      });

      dialogRef.afterClosed().subscribe(() => this.receiptPdfService.revokePdfUrl(pdfUrl));
    } catch {
      this.errorMessage = 'No se pudo visualizar el formulario CO-30.';
    } finally {
      this.previewingReceiptId = null;
    }
  }

  deleteReceipt(receipt: TransportDeliveryReceiptResponse): void {
    if (this.deletingReceiptId) {
      return;
    }

    const confirmed = confirm(`Eliminar recibo CO-30 ${receipt.receiptNumber}?`);

    if (!confirmed) {
      return;
    }

    this.deletingReceiptId = receipt.id;
    this.errorMessage = '';

    this.receiptService
      .delete(receipt.id)
      .pipe(finalize(() => (this.deletingReceiptId = null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Recibo CO-30 eliminado correctamente.', 'Cerrar', { duration: 3500 });
          this.loadReceipts();
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.errorMessage = 'El recibo CO-30 ya no existe o fue eliminado.';
            this.loadReceipts();
            return;
          }

          this.errorMessage = 'No se pudo eliminar el recibo CO-30.';
        },
      });
  }
}
