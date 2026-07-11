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
  templateUrl: './event-list.component.html',
  styleUrl: './event-list.component.css',
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
