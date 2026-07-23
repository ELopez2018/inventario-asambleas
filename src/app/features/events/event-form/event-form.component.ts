import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { EventService } from '../../../core/services/event.service';
import { CreateEventRequest } from '../../../models/event.model';
import { NativeDateTimePickerDirective } from '../../../shared/native-date-time-picker.directive';

function dateRangeValidator(control: AbstractControl): ValidationErrors | null {
  const startDate = control.get('startDate')?.value as string | null;
  const endDate = control.get('endDate')?.value as string | null;

  if (!startDate || !endDate) {
    return null;
  }

  return endDate >= startDate ? null : { dateRange: true };
}

function toLocalDateTime(value: string): string | null {
  if (!value) {
    return null;
  }

  return value.length === 16 ? `${value}:00` : value;
}

function fromLocalDateTime(value: string | null): string {
  return value ? value.slice(0, 16) : '';
}

@Component({
  selector: 'app-event-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NativeDateTimePickerDirective,
  ],
  templateUrl: './event-form.component.html',
  styleUrl: './event-form.component.css',
})
export class EventFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);

  readonly eventId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly form = this.fb.group(
    {
      description: ['', [Validators.required, Validators.maxLength(255)]],
      address: ['', [Validators.required, Validators.maxLength(255)]],
      startDate: [''],
      endDate: [''],
      observations: ['', Validators.maxLength(5000)],
    },
    { validators: dateRangeValidator },
  );

  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit() {
    if (!this.eventId) {
      return;
    }

    this.loading = true;
    this.eventService
      .getById(this.eventId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (event) =>
          this.form.patchValue({
            description: event.description,
            address: event.address,
            startDate: fromLocalDateTime(event.startDate),
            endDate: fromLocalDateTime(event.endDate),
            observations: event.observations ?? '',
          }),
        error: () => (this.errorMessage = 'No se pudo cargar el evento.'),
      });
  }

  submit() {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const raw = this.form.getRawValue();
    const body: CreateEventRequest = {
      description: raw.description.trim(),
      address: raw.address.trim(),
      startDate: toLocalDateTime(raw.startDate),
      endDate: toLocalDateTime(raw.endDate),
      observations: raw.observations.trim() || null,
    };

    const request = this.eventId
      ? this.eventService.update(this.eventId, body)
      : this.eventService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/events']),
      error: () => (this.errorMessage = 'No se pudo guardar el evento.'),
    });
  }
}
