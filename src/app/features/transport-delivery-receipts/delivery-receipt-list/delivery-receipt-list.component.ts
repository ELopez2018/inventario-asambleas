import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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

  readonly displayedColumns = [
    'receiptNumber',
    'receiptDate',
    'transportRequestNumber',
    'ownerName',
    'items',
    'actions',
  ];
  readonly canEditReceipts = computed(() =>
    this.auth.canAccessAction('TRANSPORT_DELIVERY_RECEIPTS', 'edit'),
  );

  receipts: TransportDeliveryReceiptResponse[] = [];
  previewingReceiptId: number | null = null;
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
        next: (receipts) => (this.receipts = receipts),
        error: () => (this.errorMessage = 'No se pudieron cargar los recibos CO-30.'),
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
          subtitle: `Recibo ${receipt.receiptNumber} - Solicitud ${receipt.transportRequestNumber}`,
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
}
