import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { EventContextService } from './event-context.service';

@Injectable({ providedIn: 'root' })
export class AppIdentityService {
  private readonly title = inject(Title);
  private readonly eventContext = inject(EventContextService);

  readonly appName = signal('Transporte & Materiales');
  readonly appSubtitle = computed(
    () => this.eventContext.selectedDescription() || 'Sin evento seleccionado',
  );
  readonly browserTitle = computed(() => {
    const subtitle = this.appSubtitle();
    return subtitle ? `${this.appName()} - ${subtitle}` : this.appName();
  });

  constructor() {
    effect(() => {
      this.title.setTitle(this.browserTitle());
    });
  }
}
