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
import { InventoryItemDetailService } from '../../../core/services/inventory-item-detail.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import {
  CreateInventoryItemDetailRequest,
  DetailItemStatus,
} from '../../../models/inventory-item-detail.model';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import { INVENTORY_STATES, INVENTORY_STORES, INVENTORY_UNIT_TYPES } from '../../../shared/catalogs.constants';

@Component({
  selector: 'app-detail-form',
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
  templateUrl: './detail-form.component.html',
  styleUrl: './detail-form.component.css',
})
export class DetailFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly detailService = inject(InventoryItemDetailService);
  private readonly itemService = inject(InventoryItemService);

  readonly detailId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly storeOptions = INVENTORY_STORES;
  readonly stateOptions = INVENTORY_STATES;
  readonly unitTypeOptions = INVENTORY_UNIT_TYPES;
  readonly itemStatuses: { value: DetailItemStatus; label: string }[] = [
    { value: 'INCOME', label: 'Ingreso' },
    { value: 'RETURN', label: 'Retorno' },
    { value: 'TRANSFER', label: 'Traslado' },
    { value: 'DECOMMISSION', label: 'Baja' },
    { value: 'EGRESS', label: 'Egreso' },
  ];
  readonly form = this.fb.group({
    itemId: [0, [Validators.required, Validators.min(1)]],
    storeId: [0, [Validators.required, Validators.min(1)]],
    code: ['', [Validators.required, Validators.maxLength(120)]],
    serial: ['', Validators.maxLength(120)],
    physicalStateId: [1, [Validators.required, Validators.min(1)]],
    itemStatus: this.fb.control<DetailItemStatus>('INCOME', Validators.required),
    unitTypeId: [1, [Validators.required, Validators.min(1)]],
    observations: ['', Validators.maxLength(1000)],
  });

  items: InventoryItemResponse[] = [];
  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit() {
    this.loading = true;

    if (this.detailId) {
      forkJoin({
        items: this.itemService.getAll(),
        detail: this.detailService.getById(this.detailId),
      })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: ({ items, detail }) => {
            this.items = items;
            this.form.patchValue({
              itemId: detail.itemId,
              storeId: detail.storeId,
              code: detail.code,
              serial: detail.serial ?? '',
              physicalStateId: detail.physicalStateId,
              itemStatus: detail.itemStatus,
              unitTypeId: detail.unitTypeId,
              observations: detail.observations ?? '',
            });
          },
          error: () => (this.errorMessage = 'No se pudo cargar el detalle.'),
        });
      return;
    }

    this.itemService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (items) => (this.items = items),
        error: () => (this.errorMessage = 'No se pudo cargar la lista de articulos.'),
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
    const body: CreateInventoryItemDetailRequest = {
      itemId: Number(raw.itemId),
      storeId: Number(raw.storeId),
      code: raw.code.trim(),
      serial: raw.serial.trim() || null,
      physicalStateId: Number(raw.physicalStateId),
      itemStatus: raw.itemStatus,
      unitTypeId: Number(raw.unitTypeId),
      observations: raw.observations.trim() || null,
    };

    const request = this.detailId
      ? this.detailService.update(this.detailId, body)
      : this.detailService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/inventory-item-details']),
      error: () => (this.errorMessage = 'No se pudo guardar el detalle.'),
    });
  }
}
