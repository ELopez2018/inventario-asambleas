import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { StoreOrdersReportService } from '../../../core/services/store-orders-report.service';
import { StoreOrdersReportPdfService } from '../../../core/services/store-orders-report-pdf.service';
import { StoreService } from '../../../core/services/store.service';
import { StoreResponse } from '../../../models/store.model';
import { StoreOrdersReport } from '../../../models/store-orders-report.model';
import { RequestPdfDialogComponent } from '../../transport-requests/request-pdf-dialog/request-pdf-dialog.component';

function resolveBackendUserMessage(err: HttpErrorResponse, fallback: string): string {
  const problem = err.error as
    | { userMessage?: string; detail?: string; message?: string; title?: string }
    | null
    | undefined;

  return problem?.userMessage ?? problem?.detail ?? problem?.message ?? problem?.title ?? fallback;
}

@Component({
  selector: 'app-store-orders-report',
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule,
  ],
  templateUrl: './store-orders-report.component.html',
  styleUrl: './store-orders-report.component.css',
})
export class StoreOrdersReportComponent implements OnInit {
  private readonly storeService = inject(StoreService);
  private readonly reportService = inject(StoreOrdersReportService);
  private readonly reportPdfService = inject(StoreOrdersReportPdfService);
  private readonly dialog = inject(MatDialog);

  readonly displayedColumns = ['description', 'quantity', 'co30FormNumber', 'responsible'];

  stores: StoreResponse[] = [];
  selectedStoreId: number | null = null;
  report: StoreOrdersReport | null = null;
  loadingStores = false;
  loadingReport = false;
  generatingPdf = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadStores();
  }

  onStoreChange(storeId: number | null): void {
    this.selectedStoreId = storeId;
    this.report = null;
    this.errorMessage = '';
  }

  loadReport(): void {
    if (this.selectedStoreId === null || this.loadingReport) {
      return;
    }

    const requestedStoreId = this.selectedStoreId;
    this.report = null;
    this.errorMessage = '';
    this.loadingReport = true;

    this.reportService
      .getByStore(requestedStoreId)
      .pipe(finalize(() => (this.loadingReport = false)))
      .subscribe({
        next: (report) => {
          if (this.selectedStoreId === requestedStoreId) {
            this.report = report;
          }
        },
        error: (err: HttpErrorResponse) => {
          if (this.selectedStoreId === requestedStoreId) {
            this.errorMessage = resolveBackendUserMessage(
              err,
              'No se pudo consultar el reporte. Intente nuevamente.',
            );
          }
        },
      });
  }

  async previewPdf(): Promise<void> {
    const report = this.report;
    const store = this.stores.find((candidate) => candidate.id === this.selectedStoreId);

    if (!report?.orders.length || !store || this.generatingPdf) {
      return;
    }

    this.generatingPdf = true;
    this.errorMessage = '';

    try {
      const pdfUrl = await this.reportPdfService.createPdfUrl(report, store);
      const dialogRef = this.dialog.open(RequestPdfDialogComponent, {
        data: {
          pdfUrl,
          requestNumber: String(report.storeId),
          title: 'Reporte de pedidos por almacén',
          subtitle: `${report.storeName} · ${report.orders.length} pedido${report.orders.length === 1 ? '' : 's'}`,
        },
        maxWidth: '96vw',
        panelClass: 'request-pdf-dialog-panel',
      });

      dialogRef.afterClosed().subscribe(() => this.reportPdfService.revokePdfUrl(pdfUrl));
    } catch {
      this.errorMessage = 'No se pudo abrir el PDF del reporte.';
    } finally {
      this.generatingPdf = false;
    }
  }

  private loadStores(): void {
    this.loadingStores = true;
    this.errorMessage = '';

    this.storeService
      .getAll()
      .pipe(finalize(() => (this.loadingStores = false)))
      .subscribe({
        next: (stores) => (this.stores = stores),
        error: (err: HttpErrorResponse) =>
          (this.errorMessage = resolveBackendUserMessage(
            err,
            'No se pudieron cargar los almacenes.',
          )),
      });
  }
}
