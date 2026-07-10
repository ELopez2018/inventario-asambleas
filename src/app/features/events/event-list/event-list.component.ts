import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { EventService } from '../../../core/services/event.service';
import { EventResponse } from '../../../models/event.model';

@Component({
  selector: 'app-event-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <section class="mx-auto max-w-6xl">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-950">Eventos</h1>
          <p class="text-sm text-slate-600">Fechas relacionadas con la asamblea y el inventario.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/events/new">
          <mat-icon>add</mat-icon>
          Nuevo
        </a>
      </div>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        @if (loading) {
          <div class="flex items-center justify-center p-10">
            <mat-spinner diameter="36" />
          </div>
        } @else if (errorMessage) {
          <div class="p-6 text-sm text-red-700">{{ errorMessage }}</div>
        } @else if (!events.length) {
          <div class="p-6 text-sm text-slate-600">No hay eventos registrados.</div>
        } @else {
          <div class="overflow-x-auto">
            <table mat-table [dataSource]="events" class="min-w-full">
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Descripcion</th>
                <td mat-cell *matCellDef="let event">{{ event.description }}</td>
              </ng-container>

              <ng-container matColumnDef="startDate">
                <th mat-header-cell *matHeaderCellDef>Inicio</th>
                <td mat-cell *matCellDef="let event">
                  {{ event.startDate ? (event.startDate | date: 'short') : '-' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="endDate">
                <th mat-header-cell *matHeaderCellDef>Fin</th>
                <td mat-cell *matCellDef="let event">
                  {{ event.endDate ? (event.endDate | date: 'short') : '-' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="w-28 text-right">Acciones</th>
                <td mat-cell *matCellDef="let event" class="text-right">
                  <a mat-icon-button [routerLink]="['/events', event.id, 'edit']" matTooltip="Editar">
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button mat-icon-button type="button" matTooltip="Eliminar" (click)="deleteEvent(event)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class EventListComponent implements OnInit {
  private readonly eventService = inject(EventService);

  readonly displayedColumns = ['description', 'startDate', 'endDate', 'actions'];
  events: EventResponse[] = [];
  loading = false;
  errorMessage = '';

  ngOnInit() {
    this.loadEvents();
  }

  loadEvents() {
    this.loading = true;
    this.errorMessage = '';

    this.eventService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (events) => (this.events = events),
        error: () => (this.errorMessage = 'No se pudieron cargar los eventos.'),
      });
  }

  deleteEvent(event: EventResponse) {
    const confirmed = confirm(`Eliminar "${event.description}"?`);

    if (!confirmed) {
      return;
    }

    this.eventService.delete(event.id).subscribe({
      next: () => this.loadEvents(),
      error: () => (this.errorMessage = 'No se pudo eliminar el evento.'),
    });
  }
}
