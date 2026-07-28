import { Injectable, computed, inject, signal } from '@angular/core';
import { EventResponse } from '../../models/event.model';
import { EventService } from './event.service';

@Injectable({ providedIn: 'root' })
export class EventContextService {
  private readonly eventService = inject(EventService);
  private readonly eventsState = signal<EventResponse[]>([]);
  private readonly activeEventState = signal<EventResponse | null>(null);

  readonly events = this.eventsState.asReadonly();
  readonly activeEvent = this.activeEventState.asReadonly();
  readonly activeEventId = computed(() => this.activeEventState()?.id ?? null);
  readonly selectedEventId = this.activeEventId;
  readonly selectedEvent = this.activeEvent;
  readonly selectedDescription = computed(() => this.activeEventState()?.description ?? '');
  readonly selectedAddress = computed(() => this.activeEventState()?.address ?? '');
  readonly hasActiveEvent = computed(() => this.activeEventState() !== null);
  readonly hasSelectedEvent = this.hasActiveEvent;

  setActiveEvent(event: EventResponse | null): void {
    this.activeEventState.set(event);
  }

  loadActiveEvent() {
    return this.eventService.getActive().subscribe({
      next: (event) => this.activeEventState.set(event),
      error: () => this.activeEventState.set(null),
    });
  }

  loadEvents() {
    return this.eventService.getAll().subscribe({
      next: (events) => {
        this.eventsState.set(events);
        const active = events.find((event) => event.active) ?? this.activeEventState();

        if (active) {
          this.activeEventState.set(active);
          return;
        }

        this.loadActiveEvent();
      },
      error: () => {
        this.eventsState.set([]);
        this.loadActiveEvent();
      },
    });
  }

  activateEvent(eventId: number) {
    return this.eventService.activate(eventId).subscribe({
      next: (event) => this.activeEventState.set(event),
    });
  }

  selectEvent(eventId: number | null): void {
    const event = this.eventsState().find((currentEvent) => currentEvent.id === eventId) ?? null;
    this.activeEventState.set(event);
  }

  requireActiveEventId(): number {
    const eventId = this.activeEventId();

    if (!eventId) {
      throw new Error('Debe existir un evento activo antes de continuar.');
    }

    return eventId;
  }

  requireSelectedEventId(): number {
    return this.requireActiveEventId();
  }
}
