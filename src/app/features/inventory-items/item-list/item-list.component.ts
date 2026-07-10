import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { InventoryItemResponse } from '../../../models/inventory-item.model';

@Component({
  selector: 'app-item-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  template: `
    <section class="mx-auto max-w-6xl">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-950">Articulos</h1>
          <p class="text-sm text-slate-600">Existencias registradas para la asamblea.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/inventory-items/new">
          <mat-icon>add</mat-icon>
          Nuevo
        </a>
      </div>

      <div class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        @if (loading) {
          <div class="flex items-center justify-center p-10">
            <mat-spinner diameter="36" />
          </div>
        } @else if (errorMessage) {
          <div class="p-6 text-sm text-red-700">{{ errorMessage }}</div>
        } @else if (!items.length) {
          <div class="p-6 text-sm text-slate-600">No hay articulos registrados.</div>
        } @else {
          <div class="overflow-x-auto">
            <table mat-table [dataSource]="items" class="min-w-full">
              <ng-container matColumnDef="description">
                <th mat-header-cell *matHeaderCellDef>Descripcion</th>
                <td mat-cell *matCellDef="let item">{{ item.description }}</td>
              </ng-container>

              <ng-container matColumnDef="quantity">
                <th mat-header-cell *matHeaderCellDef>Cantidad</th>
                <td mat-cell *matCellDef="let item">{{ item.quantity | number: '1.0-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="ownerUserId">
                <th mat-header-cell *matHeaderCellDef>Dueno</th>
                <td mat-cell *matCellDef="let item">#{{ item.ownerUserId }}</td>
              </ng-container>

              <ng-container matColumnDef="storeId">
                <th mat-header-cell *matHeaderCellDef>Almacen</th>
                <td mat-cell *matCellDef="let item">#{{ item.storeId }}</td>
              </ng-container>

              <ng-container matColumnDef="stateId">
                <th mat-header-cell *matHeaderCellDef>Estado</th>
                <td mat-cell *matCellDef="let item">#{{ item.stateId }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="w-28 text-right">Acciones</th>
                <td mat-cell *matCellDef="let item" class="text-right">
                  <a
                    mat-icon-button
                    [routerLink]="['/inventory-items', item.id, 'edit']"
                    matTooltip="Editar"
                  >
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button mat-icon-button type="button" matTooltip="Eliminar" (click)="deleteItem(item)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>
          </div>
        }
      </div>
    </section>
  `,
})
export class ItemListComponent implements OnInit {
  private readonly itemService = inject(InventoryItemService);

  readonly displayedColumns = [
    'description',
    'quantity',
    'ownerUserId',
    'storeId',
    'stateId',
    'actions',
  ];
  items: InventoryItemResponse[] = [];
  loading = false;
  errorMessage = '';

  ngOnInit() {
    this.loadItems();
  }

  loadItems() {
    this.loading = true;
    this.errorMessage = '';

    this.itemService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (items) => (this.items = items),
        error: () => (this.errorMessage = 'No se pudieron cargar los articulos.'),
      });
  }

  deleteItem(item: InventoryItemResponse) {
    const confirmed = confirm(`Eliminar "${item.description}"?`);

    if (!confirmed) {
      return;
    }

    this.itemService.delete(item.id).subscribe({
      next: () => this.loadItems(),
      error: () => (this.errorMessage = 'No se pudo eliminar el articulo.'),
    });
  }
}
