import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { finalize } from 'rxjs';
import { StoreOrdersReportService } from '../../../core/services/store-orders-report.service';
import { StoreService } from '../../../core/services/store.service';
import { StoreResponse } from '../../../models/store.model';
import { StoreOrdersReport } from '../../../models/store-orders-report.model';

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
  private readonly changeDetector = inject(ChangeDetectorRef);

  readonly displayedColumns = ['description', 'quantity', 'co30FormNumber', 'responsible'];

  stores: StoreResponse[] = [];
  selectedStoreId: number | null = null;
  report: StoreOrdersReport | null = null;
  printDate: Date | null = null;
  loadingStores = false;
  loadingReport = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loadStores();
  }

  get canPrint(): boolean {
    return Boolean(this.report?.orders.length);
  }

  onStoreChange(storeId: number | null): void {
    this.selectedStoreId = storeId;
    this.report = null;
    this.printDate = null;
    this.errorMessage = '';
  }

  loadReport(): void {
    if (this.selectedStoreId === null || this.loadingReport) {
      return;
    }

    const requestedStoreId = this.selectedStoreId;
    this.report = null;
    this.printDate = null;
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

  printReport(): void {
    if (!this.canPrint) {
      return;
    }

    this.printDate = new Date();
    this.changeDetector.detectChanges();
    window.print();
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
