import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
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

@Component({
  selector: 'app-request-list',
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
    'stockReserved',
    'requestDate',
    'requestedFrom',
    'requestedTo',
    'items',
    'actions',
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

    this.requestService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (requests) => {
          this.requests = requests;

          if (
            this.expandedRequestId &&
            !requests.some((request) => request.id === this.expandedRequestId)
          ) {
            this.expandedRequestId = null;
          }
        },
        error: () => (this.errorMessage = 'No se pudieron cargar las solicitudes.'),
      });
  }

  deleteRequest(request: TransportRequestResponse): void {
    const confirmed = confirm(`Eliminar solicitud ${request.requestNumber}?`);

    if (!confirmed) {
      return;
    }

    this.requestService.delete(request.id).subscribe({
      next: () => this.loadRequests(),
      error: () => (this.errorMessage = 'No se pudo eliminar la solicitud.'),
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
