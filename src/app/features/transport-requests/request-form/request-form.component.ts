import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { EventService } from '../../../core/services/event.service';
import { TransportRequestService } from '../../../core/services/transport-request.service';
import { EventResponse } from '../../../models/event.model';
import {
  CreateTransportRequestRequest,
  TransportRequestItemRequest,
} from '../../../models/transport-request.model';

function toNullableText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toApiLocalTime(value: string): string | null {
  if (!value) {
    return null;
  }

  return value.length === 5 ? `${value}:00` : value;
}

function fromApiLocalTime(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function decimalPrecisionValidator(
  maxIntegerDigits: number,
  maxFractionDigits: number,
): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;

    if (value === null || value === undefined || value === '') {
      return null;
    }

    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return { decimalPrecision: true };
    }

    const normalized = String(value).trim();
    const unsigned = normalized.startsWith('-') ? normalized.slice(1) : normalized;
    const [integerPartRaw, fractionPartRaw = ''] = unsigned.split('.');
    const integerPart = integerPartRaw.replace(/^0+(?=\d)/, '');

    if (integerPart.length > maxIntegerDigits || fractionPartRaw.length > maxFractionDigits) {
      return { decimalPrecision: true };
    }

    return null;
  };
}

@Component({
  selector: 'app-request-form',
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
    MatStepperModule,
    MatTooltipModule,
  ],
  templateUrl: './request-form.component.html',
  styleUrl: './request-form.component.css',
})
export class RequestFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly requestService = inject(TransportRequestService);
  private readonly eventService = inject(EventService);
  private readonly quantityValidator = decimalPrecisionValidator(16, 2);
  private readonly lineTotalValidator = decimalPrecisionValidator(10, 2);

  readonly requestId = Number(this.route.snapshot.paramMap.get('id')) || null;

  readonly form = this.fb.group({
    requestNumber: ['', [Validators.required, Validators.maxLength(50)]],
    requestDate: ['', [Validators.required]],
    requestedFrom: ['', [Validators.required, Validators.maxLength(255)]],
    requestedTo: ['', [Validators.required, Validators.maxLength(255)]],
    targetDepartment: ['', [Validators.maxLength(255)]],
    targetPlace: ['', [Validators.maxLength(255)]],
    desiredDate: [''],
    desiredTime: [''],
    estimatedAmount: [0],
    observations: ['', [Validators.maxLength(1000)]],
    receivedBy: ['', [Validators.maxLength(255)]],
    receivedDate: [''],
    receivedTime: [''],
    authorizedBy: ['', [Validators.maxLength(255)]],
    eventId: [0],
    items: this.fb.array([this.createItemGroup()]),
  });

  readonly generalStepForm = this.fb.group({
    ready: [false, Validators.requiredTrue],
  });

  readonly itemsStepForm = this.fb.group({
    ready: [false, Validators.requiredTrue],
  });

  events: EventResponse[] = [];
  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit(): void {
    this.loading = true;

    this.eventService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (events) => {
          this.events = events;

          if (this.requestId) {
            this.loadRequest();
          }
        },
        error: () => (this.errorMessage = 'No se pudo cargar catalogo de eventos.'),
      });
  }

  get itemsArray(): FormArray {
    return this.form.controls.items;
  }

  private createItemGroup() {
    return this.fb.group({
      quantity: [1, [Validators.required, Validators.min(0.01), this.quantityValidator]],
      description: ['', [Validators.required, Validators.maxLength(255)]],
      sizeAndWeight: ['', [Validators.maxLength(255)]],
      lineTotal: ['', [this.lineTotalValidator]],
    });
  }

  addItem(): void {
    this.itemsArray.push(this.createItemGroup());
    this.itemsStepForm.patchValue({ ready: false });
  }

  removeItem(index: number): void {
    if (this.itemsArray.length === 1) {
      return;
    }

    this.itemsArray.removeAt(index);
    this.itemsStepForm.patchValue({ ready: false });
  }

  validateGeneralStep(stepper: MatStepper): void {
    const controls = [
      this.form.controls.requestNumber,
      this.form.controls.requestDate,
      this.form.controls.requestedFrom,
      this.form.controls.requestedTo,
      this.form.controls.targetDepartment,
      this.form.controls.targetPlace,
    ];

    for (const control of controls) {
      control.markAsTouched();
      control.updateValueAndValidity({ emitEvent: false });
    }

    const isValid = controls.every((control) => control.valid);

    if (!isValid) {
      this.errorMessage = 'Complete los campos obligatorios de informacion general.';
      return;
    }

    this.errorMessage = '';
    this.generalStepForm.patchValue({ ready: true });
    stepper.next();
  }

  validateItemsStep(stepper: MatStepper): void {
    if (!this.itemsArray.length) {
      this.errorMessage = 'Debe registrar al menos un item de transporte.';
      return;
    }

    this.itemsArray.markAllAsTouched();
    this.itemsArray.updateValueAndValidity({ emitEvent: false });

    if (this.itemsArray.invalid) {
      this.errorMessage = 'Revise los items: cantidad y descripcion son obligatorios.';
      return;
    }

    this.errorMessage = '';
    this.itemsStepForm.patchValue({ ready: true });
    stepper.next();
  }

  private loadRequest(): void {
    this.loading = true;

    this.requestService
      .getById(this.requestId as number)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (request) => {
          this.form.patchValue({
            requestNumber: request.requestNumber,
            requestDate: request.requestDate,
            requestedFrom: request.requestedFrom,
            requestedTo: request.requestedTo,
            targetDepartment: request.targetDepartment ?? '',
            targetPlace: request.targetPlace ?? '',
            desiredDate: request.desiredDate ?? '',
            desiredTime: fromApiLocalTime(request.desiredTime),
            estimatedAmount: request.estimatedAmount ?? 0,
            observations: request.observations ?? '',
            receivedBy: request.receivedBy ?? '',
            receivedDate: request.receivedDate ?? '',
            receivedTime: fromApiLocalTime(request.receivedTime),
            authorizedBy: request.authorizedBy ?? '',
            eventId: request.eventId ?? 0,
          });

          this.itemsArray.clear();
          for (const item of request.items) {
            this.itemsArray.push(
              this.fb.group({
                quantity: [
                  item.quantity,
                  [Validators.required, Validators.min(0.01), this.quantityValidator],
                ],
                description: [item.description, [Validators.required, Validators.maxLength(255)]],
                sizeAndWeight: [item.sizeAndWeight ?? '', [Validators.maxLength(255)]],
                lineTotal: [item.lineTotal ?? '', [this.lineTotalValidator]],
              }),
            );
          }

          if (!request.items.length) {
            this.itemsArray.push(this.createItemGroup());
          }
        },
        error: () => (this.errorMessage = 'No se pudo cargar la solicitud.'),
      });
  }

  submit(): void {
    if (this.form.invalid || this.saving || this.itemsArray.length < 1) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const raw = this.form.getRawValue();

    const items: TransportRequestItemRequest[] = raw.items.map((item) => ({
      quantity: Number(item.quantity),
      description: item.description.trim(),
      sizeAndWeight: toNullableText(item.sizeAndWeight),
      lineTotal: toOptionalNumber(item.lineTotal),
    }));

    const body: CreateTransportRequestRequest = {
      requestNumber: raw.requestNumber.trim(),
      requestDate: raw.requestDate,
      requestedFrom: raw.requestedFrom.trim(),
      requestedTo: raw.requestedTo.trim(),
      targetDepartment: toNullableText(raw.targetDepartment),
      targetPlace: toNullableText(raw.targetPlace),
      desiredDate: raw.desiredDate || null,
      desiredTime: toApiLocalTime(raw.desiredTime),
      estimatedAmount: raw.estimatedAmount ? Number(raw.estimatedAmount) : null,
      observations: toNullableText(raw.observations),
      receivedBy: toNullableText(raw.receivedBy),
      receivedDate: raw.receivedDate || null,
      receivedTime: toApiLocalTime(raw.receivedTime),
      authorizedBy: toNullableText(raw.authorizedBy),
      eventId: raw.eventId ? Number(raw.eventId) : null,
      items,
    };

    const request = this.requestId
      ? this.requestService.update(this.requestId, body)
      : this.requestService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/transport-requests']),
      error: () => (this.errorMessage = 'No se pudo guardar la solicitud.'),
    });
  }
}
