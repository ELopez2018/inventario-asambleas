import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormArray,
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
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { StoreService } from '../../../core/services/store.service';
import { UserService } from '../../../core/services/user.service';
import {
  CreateInventoryItemRequest,
  InventoryItemStoreStock,
} from '../../../models/inventory-item.model';
import { StoreResponse } from '../../../models/store.model';
import { UserResponse } from '../../../models/user.model';
import { INVENTORY_STATES } from '../../../shared/catalogs.constants';

function atLeastOneStoreStockValidator(control: AbstractControl): ValidationErrors | null {
  if (!(control instanceof FormArray)) {
    return null;
  }

  return control.length > 0 ? null : { atLeastOneStore: true };
}

function uniqueStoreValidator(control: AbstractControl): ValidationErrors | null {
  if (!(control instanceof FormArray)) {
    return null;
  }

  const storeIds = control.controls
    .map((group) => Number(group.get('storeId')?.value || 0))
    .filter((storeId) => storeId > 0);
  const uniqueStoreIds = new Set(storeIds);
  return uniqueStoreIds.size === storeIds.length ? null : { duplicateStore: true };
}

function twoDecimalPlacesValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  if (value === null || value === undefined || value === '') {
    return null;
  }

  const decimalPart = String(value).trim().split('.')[1] ?? '';
  return decimalPart.length <= 2 ? null : { decimalPlaces: true };
}

function resolveBackendUserMessage(err: HttpErrorResponse, fallback: string): string {
  const problem = err.error as
    | { userMessage?: string; detail?: string; message?: string; title?: string }
    | null
    | undefined;
  return problem?.userMessage ?? problem?.detail ?? problem?.message ?? problem?.title ?? fallback;
}

@Component({
  selector: 'app-item-form',
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
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.css',
})
export class ItemFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemService = inject(InventoryItemService);
  private readonly storeService = inject(StoreService);
  private readonly userService = inject(UserService);

  readonly itemId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly stateOptions = INVENTORY_STATES;
  readonly form = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(255)]],
    ownerUserId: [0, [Validators.required, Validators.min(1)]],
    stateId: [1, [Validators.required, Validators.min(1)]],
    storeStocks: this.fb.array([this.createStoreStockGroup()], {
      validators: [atLeastOneStoreStockValidator, uniqueStoreValidator],
    }),
  });

  users: UserResponse[] = [];
  storeOptions: StoreResponse[] = [];
  loading = false;
  saving = false;
  errorMessage = '';

  get storeStocks(): FormArray {
    return this.form.controls.storeStocks as FormArray;
  }

  ngOnInit() {
    this.loading = true;

    if (this.itemId) {
      forkJoin({
        users: this.userService.getAll(),
        stores: this.storeService.getAll(),
        item: this.itemService.getById(this.itemId),
      })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: ({ users, stores, item }) => {
            this.users = users;
            this.storeOptions = stores;
            this.form.patchValue({
              description: item.description,
              ownerUserId: item.ownerUserId,
              stateId: item.stateId,
            });
            // El API recibe existencia total por bodega; quantity en la respuesta es disponible.
            this.setStoreStocks(
              item.storeStocks.map((stock) => ({
                storeId: stock.storeId,
                quantity: stock.existenceQuantity,
              })),
            );
          },
          error: () => (this.errorMessage = 'No se pudo cargar la informacion del articulo.'),
        });
      return;
    }

    forkJoin({
      users: this.userService.getAll(),
      stores: this.storeService.getAll(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ users, stores }) => {
          this.users = users;
          this.storeOptions = stores;
          this.setStoreStocks([]);
        },
        error: () => (this.errorMessage = 'No se pudo cargar la informacion del articulo.'),
      });
  }

  createStoreStockGroup(stock?: Pick<InventoryItemStoreStock, 'storeId' | 'quantity'>) {
    return this.fb.group({
      storeId: [stock?.storeId ?? this.defaultStoreId(), [Validators.required, Validators.min(1)]],
      quantity: [
        stock?.quantity ?? 0,
        [Validators.required, Validators.min(0), twoDecimalPlacesValidator],
      ],
    });
  }

  setStoreStocks(stocks: Pick<InventoryItemStoreStock, 'storeId' | 'quantity'>[]) {
    const rows: Pick<InventoryItemStoreStock, 'storeId' | 'quantity'>[] = stocks.length
      ? stocks
      : [{ storeId: this.defaultStoreId(), quantity: 0 }];
    this.storeStocks.clear();
    rows.forEach((stock) => this.storeStocks.push(this.createStoreStockGroup(stock)));
    this.storeStocks.updateValueAndValidity();
  }

  private defaultStoreId(): number {
    return this.storeOptions.find((store) => store.available)?.id ?? this.storeOptions[0]?.id ?? 0;
  }

  addStoreStock() {
    this.storeStocks.push(this.createStoreStockGroup());
    this.storeStocks.updateValueAndValidity();
  }

  removeStoreStock(index: number) {
    if (this.storeStocks.length === 1) {
      return;
    }

    this.storeStocks.removeAt(index);
    this.storeStocks.updateValueAndValidity();
  }

  submit() {
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving = true;
    this.errorMessage = '';
    const raw = this.form.getRawValue();
    const body: CreateInventoryItemRequest = {
      description: raw.description.trim(),
      ownerUserId: Number(raw.ownerUserId),
      stateId: Number(raw.stateId),
      storeStocks: raw.storeStocks.map((row) => ({
        storeId: Number(row.storeId),
        quantity: Number(row.quantity),
      })),
    };

    const request = this.itemId
      ? this.itemService.update(this.itemId, body)
      : this.itemService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/inventory-items']),
      error: (err: HttpErrorResponse) =>
        (this.errorMessage = resolveBackendUserMessage(err, 'No se pudo guardar el articulo.')),
    });
  }
}
