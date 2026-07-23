import { Injectable, computed, inject, signal } from '@angular/core';
import { EventResponse } from '../../models/event.model';
import { EventService } from './event.service';

const SELECTED_EVENT_ID_KEY = 'ar_selected_event_id';

@Injectable({ providedIn: 'root' })
export class EventContextService {
  private readonly eventService = inject(EventService);
  private readonly eventsState = signal<EventResponse[]>([]);
  private readonly selectedEventIdState = signal<number | null>(this.readStoredEventId());

  readonly events = this.eventsState.asReadonly();
  readonly selectedEventId = this.selectedEventIdState.asReadonly();
  readonly selectedEvent = computed(
    () =>
      this.eventsState().find((event) => event.id === this.selectedEventIdState()) ??
      null,
  );
  readonly selectedDescription = computed(() => this.selectedEvent()?.description ?? '');
  readonly selectedAddress = computed(() => this.selectedEvent()?.address ?? '');
  readonly hasSelectedEvent = computed(() => this.selectedEvent() !== null);

  loadEvents() {
    return this.eventService.getAll().subscribe({
      next: (events) => {
        this.eventsState.set(events);
        const currentId = this.selectedEventIdState();
        const nextSelected =
          currentId && events.some((event) => event.id === currentId)
            ? currentId
            : (events[0]?.id ?? null);
        this.selectEvent(nextSelected);
      },
      error: () => {
        this.eventsState.set([]);
        this.selectEvent(null);
      },
    });
  }

  selectEvent(eventId: number | null): void {
    this.selectedEventIdState.set(eventId);

    if (eventId) {
      localStorage.setItem(SELECTED_EVENT_ID_KEY, String(eventId));
    } else {
      localStorage.removeItem(SELECTED_EVENT_ID_KEY);
    }
  }

  requireSelectedEventId(): number {
    const eventId = this.selectedEventIdState();

    if (!eventId) {
      throw new Error('Debe seleccionar un evento antes de continuar.');
    }

    return eventId;
  }

  private readStoredEventId(): number | null {
    const value = localStorage.getItem(SELECTED_EVENT_ID_KEY);
    const parsed = value ? Number(value) : NaN;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
}
