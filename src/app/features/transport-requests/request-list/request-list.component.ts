import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import { TransportRequestResponse } from '../../../models/transport-request.model';

@Component({
  selector: 'app-request-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
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

  readonly displayedColumns = [
    'requestNumber',
    'requestDate',
    'requestedFrom',
    'requestedTo',
    'items',
    'actions',
  ];

  requests: TransportRequestResponse[] = [];
  expandedRequestId: number | null = null;
  loading = false;
  errorMessage = '';

  toggleItems(requestId: number): void {
    this.expandedRequestId = this.expandedRequestId === requestId ? null : requestId;
  }

  isExpanded(requestId: number): boolean {
    return this.expandedRequestId === requestId;
  }

  ngOnInit(): void {
    this.loadRequests();
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
}
