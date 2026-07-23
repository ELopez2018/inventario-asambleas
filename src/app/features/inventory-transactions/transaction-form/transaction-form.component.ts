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
import { MatSelectModule } from '@angular/material/select';
import { finalize, forkJoin } from 'rxjs';
import { EventContextService } from '../../../core/services/event-context.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { InventoryTransactionService } from '../../../core/services/inventory-transaction.service';
import { UserService } from '../../../core/services/user.service';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import {
  CreateInventoryTransactionRequest,
  MovementType,
} from '../../../models/inventory-transaction.model';
import { UserResponse } from '../../../models/user.model';
import { INVENTORY_STORES } from '../../../shared/catalogs.constants';
import { NativeDateTimePickerDirective } from '../../../shared/native-date-time-picker.directive';

function toLocalDateTime(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}

function fromLocalDateTime(value: string): string {
  return value ? value.slice(0, 16) : '';
}

function transferStoresValidator(control: AbstractControl): ValidationErrors | null {
  const movementType = control.get('movementType')?.value as MovementType | null;
  const sourceStoreId = Number(control.get('sourceStoreId')?.value || 0);
  const destinationStoreId = Number(control.get('destinationStoreId')?.value || 0);

  if (movementType !== 'TRANSFER') {
    return null;
  }

  if (sourceStoreId > 0 && destinationStoreId > 0 && sourceStoreId === destinationStoreId) {
    return { sameTransferStore: true };
  }

  return null;
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
    NativeDateTimePickerDirective,
  ],
  templateUrl: './transaction-form.component.html',
  styleUrl: './transaction-form.component.css',
})
export class TransactionFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly eventContext = inject(EventContextService);
  private readonly itemService = inject(InventoryItemService);
  private readonly transactionService = inject(InventoryTransactionService);
  private readonly userService = inject(UserService);

  readonly transactionId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly storeOptions = INVENTORY_STORES;
  readonly movementTypes: { value: MovementType; label: string }[] = [
    { value: 'INCOME', label: 'Ingreso' },
    { value: 'RETURN', label: 'Retorno' },
    { value: 'TRANSFER', label: 'Traslado' },
    { value: 'DECOMMISSION', label: 'Baja' },
    { value: 'EGRESS', label: 'Egreso' },
  ];
  readonly form = this.fb.group(
    {
      itemId: [0, [Validators.required, Validators.min(1)]],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      movementType: this.fb.control<MovementType>('INCOME', Validators.required),
      sourceStoreId: [0],
      destinationStoreId: [0],
      origin: ['', Validators.maxLength(255)],
      destination: ['', Validators.maxLength(255)],
      responsibleUserId: [0, [Validators.required, Validators.min(1)]],
      receivedByUserId: [0],
      conditionNotes: ['', Validators.maxLength(500)],
      movementDate: [new Date().toISOString().slice(0, 16), Validators.required],
      eventId: [0, [Validators.required, Validators.min(1)]],
    },
    { validators: transferStoresValidator },
  );

  items: InventoryItemResponse[] = [];
  users: UserResponse[] = [];
  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit() {
    this.form.controls.movementType.valueChanges.subscribe((type) => this.applyMovementRules(type));
    this.applyMovementRules(this.form.controls.movementType.value);
    this.form.controls.eventId.setValue(this.eventContext.selectedEventId() ?? 0);

    this.loading = true;

    if (this.transactionId) {
      forkJoin({
        items: this.itemService.getAll(),
        users: this.userService.getAll(),
        transaction: this.transactionService.getById(this.transactionId),
      })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: ({ items, users, transaction }) => {
            this.items = items;
            this.users = users;
            this.form.patchValue({
              itemId: transaction.itemId,
              quantity: transaction.quantity,
              movementType: transaction.movementType,
              sourceStoreId: transaction.sourceStoreId ?? 0,
              destinationStoreId: transaction.destinationStoreId ?? 0,
              origin: transaction.origin ?? '',
              destination: transaction.destination ?? '',
              responsibleUserId: transaction.responsibleUserId,
              receivedByUserId: transaction.receivedByUserId ?? 0,
              conditionNotes: transaction.conditionNotes ?? '',
              movementDate: fromLocalDateTime(transaction.movementDate),
              eventId: this.eventContext.selectedEventId() ?? transaction.eventId,
            });
            this.applyMovementRules(transaction.movementType);
          },
          error: () => (this.errorMessage = 'No se pudo cargar la informacion del movimiento.'),
        });
      return;
    }

    forkJoin({
      items: this.itemService.getAll(),
      users: this.userService.getAll(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ items, users }) => {
          this.items = items;
          this.users = users;
        },
        error: () => (this.errorMessage = 'No se pudo cargar la informacion del movimiento.'),
      });
  }

  applyMovementRules(movementType: MovementType) {
    const source = this.form.controls.sourceStoreId;
    const destination = this.form.controls.destinationStoreId;
    const origin = this.form.controls.origin;
    const destinationText = this.form.controls.destination;
    const receivedBy = this.form.controls.receivedByUserId;
    const conditionNotes = this.form.controls.conditionNotes;

    source.enable({ emitEvent: false });
    destination.enable({ emitEvent: false });
    receivedBy.enable({ emitEvent: false });
    conditionNotes.enable({ emitEvent: false });

    source.setValidators([]);
    destination.setValidators([]);
    origin.setValidators([Validators.maxLength(255)]);
    destinationText.setValidators([Validators.maxLength(255)]);
    receivedBy.setValidators([]);
    conditionNotes.setValidators([Validators.maxLength(500)]);

    switch (movementType) {
      case 'INCOME':
        source.setValue(0, { emitEvent: false });
        source.disable({ emitEvent: false });
        destination.setValidators([Validators.required, Validators.min(1)]);
        break;
      case 'RETURN':
        source.setValue(0, { emitEvent: false });
        source.disable({ emitEvent: false });
        destination.setValidators([Validators.required, Validators.min(1)]);
        receivedBy.setValidators([Validators.required, Validators.min(1)]);
        conditionNotes.setValidators([Validators.required, Validators.maxLength(500)]);
        break;
      case 'EGRESS':
      case 'DECOMMISSION':
        destination.setValue(0, { emitEvent: false });
        destination.disable({ emitEvent: false });
        source.setValidators([Validators.required, Validators.min(1)]);
        break;
      case 'TRANSFER':
        source.setValidators([Validators.required, Validators.min(1)]);
        destination.setValidators([Validators.required, Validators.min(1)]);
        origin.setValidators([Validators.required, Validators.maxLength(255)]);
        destinationText.setValidators([Validators.required, Validators.maxLength(255)]);
        break;
    }

    source.updateValueAndValidity({ emitEvent: false });
    destination.updateValueAndValidity({ emitEvent: false });
    origin.updateValueAndValidity({ emitEvent: false });
    destinationText.updateValueAndValidity({ emitEvent: false });
    receivedBy.updateValueAndValidity({ emitEvent: false });
    conditionNotes.updateValueAndValidity({ emitEvent: false });
    this.form.updateValueAndValidity({ emitEvent: false });
  }

  submit() {
    let selectedEventId: number;

    try {
      selectedEventId = this.eventContext.requireSelectedEventId();
      this.form.controls.eventId.setValue(selectedEventId);
    } catch {
      this.errorMessage = 'Seleccione un evento operativo en la barra superior.';
      return;
    }

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
      sourceStoreId: raw.sourceStoreId ? Number(raw.sourceStoreId) : undefined,
      destinationStoreId: raw.destinationStoreId ? Number(raw.destinationStoreId) : undefined,
      origin: raw.origin.trim() || undefined,
      destination: raw.destination.trim() || undefined,
      responsibleUserId: Number(raw.responsibleUserId),
      receivedByUserId: raw.receivedByUserId ? Number(raw.receivedByUserId) : undefined,
      conditionNotes: raw.conditionNotes.trim() || undefined,
      movementDate: toLocalDateTime(raw.movementDate),
      eventId: selectedEventId,
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
