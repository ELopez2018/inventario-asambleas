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
import { MatSnackBar } from '@angular/material/snack-bar';
import { finalize } from 'rxjs';
import { resolveProblemMessage } from '../../../core/problem-message';
import { StoreService } from '../../../core/services/store.service';
import {
  STORE_ADDRESS_MAX_LENGTH,
  STORE_DESCRIPTION_MAX_LENGTH,
  STORE_GPS_MAX_LENGTH,
  STORE_PHONE_MAX_LENGTH,
  UpdateStoreRequest,
} from '../../../models/store.model';

function integerValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value as number | null;
  return value === null || value === undefined || Number.isInteger(value) ? null : { integer: true };
}

@Component({
  selector: 'app-store-form',
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
  templateUrl: './store-form.component.html',
})
export class StoreFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly storeService = inject(StoreService);
  private readonly snackBar = inject(MatSnackBar);

  readonly storeId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly maxLengths = {
    description: STORE_DESCRIPTION_MAX_LENGTH,
    address: STORE_ADDRESS_MAX_LENGTH,
    gpsCoordinates: STORE_GPS_MAX_LENGTH,
    phone: STORE_PHONE_MAX_LENGTH,
  };
  readonly form = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(STORE_DESCRIPTION_MAX_LENGTH)]],
    address: ['', [Validators.required, Validators.maxLength(STORE_ADDRESS_MAX_LENGTH)]],
    gpsCoordinates: ['', Validators.maxLength(STORE_GPS_MAX_LENGTH)],
    phone: ['', Validators.maxLength(STORE_PHONE_MAX_LENGTH)],
    priorityOrder: [null as number | null, [Validators.min(0), integerValidator]],
  });

  loading = false;
  saving = false;
  loadFailed = false;
  errorMessage = '';

  ngOnInit(): void {
    if (!this.storeId) {
      return;
    }

    this.loading = true;
    this.storeService
      .getById(this.storeId)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (store) =>
          this.form.patchValue({
            description: store.description,
            address: store.address ?? '',
            gpsCoordinates: store.gpsCoordinates ?? '',
            phone: store.phone ?? '',
          }),
        error: (err) => {
          this.loadFailed = true;
          this.errorMessage = resolveProblemMessage(err, 'No se pudo cargar la bodega.');
        },
      });
  }

  submit(): void {
    if (this.form.invalid || this.saving || this.loadFailed) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    const raw = this.form.getRawValue();
    const fields: UpdateStoreRequest = {
      description: raw.description.trim(),
      address: raw.address.trim(),
      gpsCoordinates: raw.gpsCoordinates.trim() || null,
      phone: raw.phone.trim() || null,
    };
    const request = this.storeId
      ? this.storeService.update(this.storeId, fields)
      : this.storeService.create({ ...fields, priorityOrder: raw.priorityOrder });

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => {
        this.snackBar.open(this.storeId ? 'Bodega actualizada.' : 'Bodega creada.', 'Cerrar', {
          duration: 3500,
        });
        void this.router.navigate(['/stores']);
      },
      // Se mantiene el formulario abierto (p. ej. INV-STORE-DUPLICATE-001).
      error: (err) =>
        (this.errorMessage = resolveProblemMessage(err, 'No se pudo guardar la bodega.')),
    });
  }
}
