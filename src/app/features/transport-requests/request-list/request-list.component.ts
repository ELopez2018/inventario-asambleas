import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
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
import { EventService } from '../../../core/services/event.service';
import { RealtimeService } from '../../../core/services/realtime.service';
import { TransportRequestPdfService } from '../../../core/services/transport-request-pdf.service';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import { TransportRequestResponse } from '../../../models/transport-request.model';
import { RequestPdfDialogComponent } from '../request-pdf-dialog/request-pdf-dialog.component';

type RequestArchiveTab = 'pending' | 'attended' | 'all';

@Component({
  selector: 'app-request-list',
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
  templateUrl: './request-list.component.html',
  styleUrl: './request-list.component.css',
})
export class RequestListComponent implements OnInit {
  private readonly requestService = inject(TransportRequestService);
  private readonly requestPdfService = inject(TransportRequestPdfService);
  private readonly eventService = inject(EventService);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly displayedColumns = [
    'requestNumber',
    'status',
    'requestDate',
    'desiredDelivery',
    'targetDepartment',
    'targetPlace',
    'allocationSummary',
    'items',
    'actions',
  ];
  readonly archiveTabs: { value: RequestArchiveTab; label: string }[] = [
    { value: 'pending', label: 'Pendientes' },
    { value: 'attended', label: 'Atendidas' },
    { value: 'all', label: 'Todas' },
  ];
  readonly canCreateRequests = computed(() =>
    this.auth.canAccessAction('TRANSPORT_REQUESTS', 'create'),
  );
  readonly canViewRequestItems = computed(() =>
    this.auth.canAccessAction('TRANSPORT_REQUESTS', 'viewItems'),
  );
  readonly canEditRequests = computed(() =>
    this.auth.canAccessAction('TRANSPORT_REQUESTS', 'edit'),
  );
  readonly canDeleteRequests = computed(() =>
    this.auth.canAccessAction('TRANSPORT_REQUESTS', 'delete'),
  );
  readonly canGenerateReceipt = computed(() =>
    this.auth.canAccessAction('TRANSPORT_REQUESTS', 'generateDeliveryReceipt'),
  );

  requests: TransportRequestResponse[] = [];
  activeArchive: RequestArchiveTab = 'pending';
  eventDescriptionsById = new Map<number, string>();
  expandedRequestId: number | null = null;
  previewingRequestId: number | null = null;
  generatingReceiptRequestId: number | null = null;
  loading = false;
  errorMessage = '';

  toggleItems(requestId: number): void {
    this.expandedRequestId = this.expandedRequestId === requestId ? null : requestId;
  }

  isExpanded(requestId: number): boolean {
    return this.expandedRequestId === requestId;
  }

  selectedArchiveIndex(): number {
    return Math.max(
      this.archiveTabs.findIndex((tab) => tab.value === this.activeArchive),
      0,
    );
  }

  ngOnInit(): void {
    this.realtime.inventoryStockEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.snackBar.open('El inventario cambio por una reserva o liberacion.', 'Cerrar', {
        duration: 4000,
      });
      this.loadRequests();
    });
    this.loadEvents();
    this.loadRequests();
  }

  loadEvents(): void {
    this.eventService.getAll().subscribe({
      next: (events) => {
        this.eventDescriptionsById = new Map(
          events.map((event) => [event.id, event.description] as const),
        );
      },
      error: () => {
        this.eventDescriptionsById = new Map();
      },
    });
  }

  loadRequests(): void {
    this.loading = true;
    this.errorMessage = '';

    this.getActiveArchiveRequest()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (requests) => {
          this.requests = this.sortRequests(requests);

          if (
            this.expandedRequestId &&
            !requests.some((request) => request.id === this.expandedRequestId)
          ) {
            this.expandedRequestId = null;
          }
        },
        error: () => (this.errorMessage = 'No se pudieron cargar las solicitudes CO-31.'),
      });
  }

  changeArchiveTab(index: number): void {
    this.activeArchive = this.archiveTabs[index]?.value ?? 'pending';
    this.expandedRequestId = null;
    this.loadRequests();
  }

  getDesiredDeliveryLabel(request: TransportRequestResponse): string {
    const date = request.desiredDate ?? '-';
    const time = request.desiredTime ? request.desiredTime.slice(0, 5) : '';

    return time ? `${date} ${time}` : date;
  }

  getAllocationSummary(request: TransportRequestResponse): string {
    const allocations = request.items.flatMap((item) => item.allocations ?? []);
    const storeNames = new Set(
      allocations
        .map((allocation) => allocation.sourceStoreName?.trim())
        .filter((storeName): storeName is string => Boolean(storeName)),
    );
    const missingTotal = allocations
      .filter((allocation) => allocation.status === 'SIN_EXISTENCIA')
      .reduce((sum, allocation) => sum + allocation.requestedQuantity, 0);
    const newItems = allocations.filter((allocation) => allocation.status === 'ITEM_NUEVO').length;
    const parts = [
      storeNames.size ? `${storeNames.size} bodega${storeNames.size === 1 ? '' : 's'}` : '',
      missingTotal > 0 ? `faltan ${missingTotal}` : '',
      newItems > 0
        ? `${newItems} item${newItems === 1 ? '' : 's'} nuevo${newItems === 1 ? '' : 's'}`
        : '',
    ].filter(Boolean);

    return parts.length ? parts.join(' · ') : 'Automatico pendiente';
  }

  getAllocationStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PLANIFICADA: 'Planificada',
      PARCIAL: 'Parcial',
      SIN_EXISTENCIA: 'Sin existencia',
      ITEM_NUEVO: 'Item nuevo',
      RECOGIDA: 'Recogida',
      ENTREGADA: 'Entregada',
      DEVUELTA: 'Devuelta',
    };

    return labels[status] ?? status;
  }

  private getActiveArchiveRequest() {
    switch (this.activeArchive) {
      case 'pending':
        return this.requestService.getPending();
      case 'attended':
        return this.requestService.getAttended();
      case 'all':
        return this.requestService.getAll();
    }
  }

  private sortRequests(requests: TransportRequestResponse[]): TransportRequestResponse[] {
    if (this.activeArchive !== 'pending') {
      return requests;
    }

    return [...requests].sort((a, b) => {
      const aDate = `${a.desiredDate ?? '9999-12-31'} ${a.desiredTime ?? '23:59:59'}`;
      const bDate = `${b.desiredDate ?? '9999-12-31'} ${b.desiredTime ?? '23:59:59'}`;
      return aDate.localeCompare(bDate);
    });
  }

  deleteRequest(request: TransportRequestResponse): void {
    const confirmed = confirm(`Eliminar solicitud CO-31 ${request.requestNumber}?`);

    if (!confirmed) {
      return;
    }

    this.requestService.delete(request.id).subscribe({
      next: () => this.loadRequests(),
      error: () => (this.errorMessage = 'No se pudo eliminar la solicitud CO-31.'),
    });
  }

  generateDeliveryReceipt(request: TransportRequestResponse): void {
    if (this.generatingReceiptRequestId) {
      return;
    }

    this.generatingReceiptRequestId = request.id;
    this.errorMessage = '';

    this.requestService
      .createDeliveryReceipt(request.id)
      .pipe(finalize(() => (this.generatingReceiptRequestId = null)))
      .subscribe({
        next: (receipt) => {
          this.snackBar.open(`Recibo CO-30 ${receipt.receiptNumber} listo.`, 'Cerrar', {
            duration: 4000,
          });
          void this.router.navigate(['/transport-delivery-receipts', receipt.id, 'edit']);
        },
        error: () => (this.errorMessage = 'No se pudo generar el recibo CO-30.'),
      });
  }

  async previewRequestPdf(request: TransportRequestResponse): Promise<void> {
    if (this.previewingRequestId) {
      return;
    }

    this.previewingRequestId = request.id;
    this.errorMessage = '';

    try {
      const pdfUrl = await this.requestPdfService.createRequestPdfUrl(
        request,
        request.eventId ? (this.eventDescriptionsById.get(request.eventId) ?? null) : null,
      );
      const dialogRef = this.dialog.open(RequestPdfDialogComponent, {
        data: {
          pdfUrl,
          requestNumber: request.requestNumber,
        },
        maxWidth: '96vw',
        panelClass: 'request-pdf-dialog-panel',
      });

      dialogRef.afterClosed().subscribe(() => this.requestPdfService.revokePdfUrl(pdfUrl));
    } catch {
      this.errorMessage = 'No se pudo visualizar el formulario CO-31.';
    } finally {
      this.previewingRequestId = null;
    }
  }
}
