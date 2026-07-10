import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { finalize, forkJoin } from 'rxjs';
import { EventService } from '../../../core/services/event.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { InventoryTransactionService } from '../../../core/services/inventory-transaction.service';
import { UserService } from '../../../core/services/user.service';
import { EventResponse } from '../../../models/event.model';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import {
  CreateInventoryTransactionRequest,
  MovementType,
} from '../../../models/inventory-transaction.model';
import { UserResponse } from '../../../models/user.model';

function toLocalDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

function fromLocalDateTime(value: string): string {
  return value ? value.slice(0, 16) : '';
}

@Component({
  selector: 'app-transaction-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <section class="mx-auto max-w-4xl">
      <div class="mb-5">
        <a
          routerLink="/inventory-transactions"
          class="inline-flex items-center gap-1 text-sm font-medium text-indigo-700"
        >
          <mat-icon class="text-base">arrow_back</mat-icon>
          Movimientos
        </a>
        <h1 class="mt-3 text-2xl font-semibold text-slate-950">
          {{ transactionId ? 'Editar movimiento' : 'Nuevo movimiento' }}
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
          <div class="grid gap-4 md:grid-cols-2">
            <mat-form-field appearance="outline">
              <mat-label>Articulo</mat-label>
              <mat-select formControlName="itemId">
                @for (item of items; track item.id) {
                  <mat-option [value]="item.id">{{ item.description }}</mat-option>
                }
              </mat-select>
              @if (form.controls.itemId.hasError('min')) {
                <mat-error>Seleccione un articulo.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cantidad</mat-label>
              <input matInput type="number" min="0.01" step="0.01" formControlName="quantity" />
              @if (form.controls.quantity.hasError('min')) {
                <mat-error>La cantidad debe ser mayor a cero.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Tipo</mat-label>
              <mat-select formControlName="movementType">
                @for (type of movementTypes; track type.value) {
                  <mat-option [value]="type.value">{{ type.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Fecha</mat-label>
              <input matInput type="datetime-local" formControlName="movementDate" />
              @if (form.controls.movementDate.hasError('required')) {
                <mat-error>La fecha es obligatoria.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Responsable</mat-label>
              <mat-select formControlName="responsibleUserId">
                @for (user of users; track user.id) {
                  <mat-option [value]="user.id">{{ user.firstName }} {{ user.lastName }}</mat-option>
                }
              </mat-select>
              @if (form.controls.responsibleUserId.hasError('min')) {
                <mat-error>Seleccione un responsable.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Recibido por</mat-label>
              <mat-select formControlName="receivedByUserId">
                <mat-option [value]="0">Sin registrar</mat-option>
                @for (user of users; track user.id) {
                  <mat-option [value]="user.id">{{ user.firstName }} {{ user.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Origen</mat-label>
              <input matInput formControlName="origin" maxlength="255" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Destino</mat-label>
              <input matInput formControlName="destination" maxlength="255" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Evento</mat-label>
              <mat-select formControlName="eventId">
                @for (event of events; track event.id) {
                  <mat-option [value]="event.id">{{ event.description }}</mat-option>
                }
              </mat-select>
              @if (form.controls.eventId.hasError('min')) {
                <mat-error>Seleccione un evento.</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="md:col-span-2">
              <mat-label>Notas de condicion</mat-label>
              <textarea matInput rows="4" formControlName="conditionNotes" maxlength="500"></textarea>
            </mat-form-field>
          </div>

          @if (errorMessage) {
            <div class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ errorMessage }}
            </div>
          }

          <div class="flex justify-end gap-2">
            <a mat-button routerLink="/inventory-transactions">Cancelar</a>
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
export class TransactionFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly eventService = inject(EventService);
  private readonly itemService = inject(InventoryItemService);
  private readonly transactionService = inject(InventoryTransactionService);
  private readonly userService = inject(UserService);

  readonly transactionId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly movementTypes: { value: MovementType; label: string }[] = [
    { value: 'INCOME', label: 'Ingreso' },
    { value: 'RETURN', label: 'Retorno' },
    { value: 'TRANSFER', label: 'Traslado' },
    { value: 'DECOMMISSION', label: 'Baja' },
    { value: 'EGRESS', label: 'Egreso' },
  ];
  readonly form = this.fb.group({
    itemId: [0, [Validators.required, Validators.min(1)]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    movementType: this.fb.control<MovementType>('INCOME', Validators.required),
    origin: ['', Validators.maxLength(255)],
    destination: ['', Validators.maxLength(255)],
    responsibleUserId: [0, [Validators.required, Validators.min(1)]],
    receivedByUserId: [0],
    conditionNotes: ['', Validators.maxLength(500)],
    movementDate: [new Date().toISOString().slice(0, 16), Validators.required],
    eventId: [0, [Validators.required, Validators.min(1)]],
  });

  events: EventResponse[] = [];
  items: InventoryItemResponse[] = [];
  users: UserResponse[] = [];
  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit() {
    this.loading = true;

    if (this.transactionId) {
      forkJoin({
        events: this.eventService.getAll(),
        items: this.itemService.getAll(),
        users: this.userService.getAll(),
        transaction: this.transactionService.getById(this.transactionId),
      })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: ({ events, items, users, transaction }) => {
            this.events = events;
            this.items = items;
            this.users = users;
            this.form.patchValue({
              itemId: transaction.itemId,
              quantity: transaction.quantity,
              movementType: transaction.movementType,
              origin: transaction.origin ?? '',
              destination: transaction.destination ?? '',
              responsibleUserId: transaction.responsibleUserId,
              receivedByUserId: transaction.receivedByUserId ?? 0,
              conditionNotes: transaction.conditionNotes ?? '',
              movementDate: fromLocalDateTime(transaction.movementDate),
              eventId: transaction.eventId,
            });
          },
          error: () => (this.errorMessage = 'No se pudo cargar la informacion del movimiento.'),
        });
      return;
    }

    forkJoin({
      events: this.eventService.getAll(),
      items: this.itemService.getAll(),
      users: this.userService.getAll(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ events, items, users }) => {
          this.events = events;
          this.items = items;
          this.users = users;
        },
        error: () => (this.errorMessage = 'No se pudo cargar la informacion del movimiento.'),
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
    const body: CreateInventoryTransactionRequest = {
      itemId: Number(raw.itemId),
      quantity: Number(raw.quantity),
      movementType: raw.movementType,
      origin: raw.origin.trim() || undefined,
      destination: raw.destination.trim() || undefined,
      responsibleUserId: Number(raw.responsibleUserId),
      receivedByUserId: raw.receivedByUserId ? Number(raw.receivedByUserId) : undefined,
      conditionNotes: raw.conditionNotes.trim() || undefined,
      movementDate: toLocalDateTime(raw.movementDate),
      eventId: Number(raw.eventId),
    };

    const request = this.transactionId
      ? this.transactionService.update(this.transactionId, body)
      : this.transactionService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/inventory-transactions']),
      error: () => (this.errorMessage = 'No se pudo guardar el movimiento.'),
    });
  }
}
