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
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { UserService } from '../../../core/services/user.service';
import { CreateInventoryItemRequest } from '../../../models/inventory-item.model';
import { UserResponse } from '../../../models/user.model';

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
  template: `
    <section class="mx-auto max-w-3xl">
      <div class="mb-5">
        <a
          routerLink="/inventory-items"
          class="inline-flex items-center gap-1 text-sm font-medium text-indigo-700"
        >
          <mat-icon class="text-base">arrow_back</mat-icon>
          Articulos
        </a>
        <h1 class="mt-3 text-2xl font-semibold text-slate-950">
          {{ itemId ? 'Editar articulo' : 'Nuevo articulo' }}
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
                <mat-label>Cantidad</mat-label>
                <input matInput type="number" min="0" step="0.01" formControlName="quantity" />
                @if (form.controls.quantity.hasError('min')) {
                  <mat-error>La cantidad no puede ser negativa.</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Dueno</mat-label>
                <mat-select formControlName="ownerUserId">
                  @for (user of users; track user.id) {
                    <mat-option [value]="user.id">{{ user.firstName }} {{ user.lastName }}</mat-option>
                  }
                </mat-select>
                @if (form.controls.ownerUserId.hasError('min')) {
                  <mat-error>Seleccione un usuario.</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <mat-form-field appearance="outline">
                <mat-label>Almacen</mat-label>
                <mat-select formControlName="storeId">
                  @for (store of storeOptions; track store.id) {
                    <mat-option [value]="store.id">{{ store.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Estado</mat-label>
                <mat-select formControlName="stateId">
                  @for (state of stateOptions; track state.id) {
                    <mat-option [value]="state.id">{{ state.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </div>

          @if (errorMessage) {
            <div class="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ errorMessage }}
            </div>
          }

          <div class="flex justify-end gap-2">
            <a mat-button routerLink="/inventory-items">Cancelar</a>
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
export class ItemFormComponent implements OnInit {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly itemService = inject(InventoryItemService);
  private readonly userService = inject(UserService);

  readonly itemId = Number(this.route.snapshot.paramMap.get('id')) || null;
  readonly storeOptions = [
    { id: 1, label: 'Almacen 1' },
    { id: 2, label: 'Almacen 2' },
  ];
  readonly stateOptions = [
    { id: 1, label: 'Disponible' },
    { id: 2, label: 'Asignado' },
    { id: 3, label: 'Dado de baja' },
  ];
  readonly form = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(255)]],
    quantity: [0, [Validators.required, Validators.min(0)]],
    ownerUserId: [0, [Validators.required, Validators.min(1)]],
    storeId: [1, [Validators.required, Validators.min(1)]],
    stateId: [1, [Validators.required, Validators.min(1)]],
  });

  users: UserResponse[] = [];
  loading = false;
  saving = false;
  errorMessage = '';

  ngOnInit() {
    this.loading = true;

    if (this.itemId) {
      forkJoin({
        users: this.userService.getAll(),
        item: this.itemService.getById(this.itemId),
      })
        .pipe(finalize(() => (this.loading = false)))
        .subscribe({
          next: ({ users, item }) => {
            this.users = users;
            this.form.patchValue(item);
          },
          error: () => (this.errorMessage = 'No se pudo cargar la informacion del articulo.'),
        });
      return;
    }

    forkJoin({
      users: this.userService.getAll(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ users }) => (this.users = users),
        error: () => (this.errorMessage = 'No se pudo cargar la informacion del articulo.'),
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
    const body: CreateInventoryItemRequest = {
      description: raw.description.trim(),
      quantity: Number(raw.quantity),
      ownerUserId: Number(raw.ownerUserId),
      storeId: Number(raw.storeId),
      stateId: Number(raw.stateId),
    };

    const request = this.itemId
      ? this.itemService.update(this.itemId, body)
      : this.itemService.create(body);

    request.pipe(finalize(() => (this.saving = false))).subscribe({
      next: () => void this.router.navigate(['/inventory-items']),
      error: () => (this.errorMessage = 'No se pudo guardar el articulo.'),
    });
  }
}
