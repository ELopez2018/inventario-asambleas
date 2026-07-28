import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { EventContextService } from '../../../core/services/event-context.service';
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
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.css',
})
export class EventListComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly eventContext = inject(EventContextService);
  private readonly auth = inject(AuthService);

  readonly displayedColumns = ['description', 'active', 'startDate', 'endDate', 'actions'];
  readonly canActivateEvents = computed(() => this.auth.hasAnyRole(['SUPER', 'ADMIN']));
  events: EventResponse[] = [];
  loading = false;
  activatingEventId: number | null = null;
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
        next: (events) => {
          this.events = events;
          const activeEvent = events.find((event) => event.active) ?? null;
          this.eventContext.setActiveEvent(activeEvent);
        },
        error: () => (this.errorMessage = 'No se pudieron cargar los eventos.'),
      });
  }

  activateEvent(event: EventResponse) {
    if (!this.canActivateEvents() || event.active || this.activatingEventId) {
      return;
    }

    this.activatingEventId = event.id;
    this.errorMessage = '';

    this.eventService
      .activate(event.id)
      .pipe(finalize(() => (this.activatingEventId = null)))
      .subscribe({
        next: (activeEvent) => {
          this.eventContext.setActiveEvent(activeEvent);
          this.loadEvents();
        },
        error: (err) => {
          this.errorMessage =
            err?.error?.userMessage ||
            err?.error?.detail ||
            'No se pudo activar el evento seleccionado.';
        },
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
