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
  ],
  template: `
    <section class="mx-auto max-w-3xl">
      <div class="mb-5">
        <a routerLink="/events" class="inline-flex items-center gap-1 text-sm font-medium text-indigo-700">
          <mat-icon class="text-base">arrow_back</mat-icon>
          Eventos
        </a>
        <h1 class="mt-3 text-2xl font-semibold text-slate-950">
          {{ eventId ? 'Editar evento' : 'Nuevo evento' }}
        </h1>
      </div>

      <form
        [formGroup]="form"
        (ngSubmit)="submit()"
        class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        @if (loading) {
          <div class="flex justify-center p-8">
            <mat-spinner diameter="36" />
          </div>
        } @else {
          <div class="grid gap-4">
            <mat-form-field appearance="outline">
              <mat-label>Descripcion</mat-label>
              <input matInput formControlName="description" maxlength="255" />
              @if (form.controls.description.hasError('required')) {
                <mat-error>La descripcion es obligatoria.</mat-error>
              }
            </mat-form-field>

            <div class="grid gap-4 md:grid-cols-2">
              <mat-form-field appearance="outline">
                <mat-label>Inicio</mat-label>
                <input matInput type="datetime-local" formControlName="startDate" />
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Fin</mat-label>
                <input matInput type="datetime-local" formControlName="endDate" />
                @if (form.hasError('dateRange')) {
                  <mat-error>La fecha final debe ser mayor o igual a la inicial.</mat-error>
                }
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline">
              <mat-label>Observaciones</mat-label>
              <textarea matInput rows="5" formControlName="observations" maxlength="5000"></textarea>
            </mat-form-field>
          </div>

          @if (errorMessage) {
            <div class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ errorMessage }}
            </div>
          }

          <div class="flex justify-end gap-2">
            <a mat-button routerLink="/events">Cancelar</a>
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || saving">
              @if (saving) {
                <mat-spinner diameter="18" class="mr-2 inline-block" />
              }
              Guardar
            </button>
          </div>
        }
      </form>
    </section>
  `,
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
