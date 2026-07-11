import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin } from 'rxjs';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { UserService } from '../../../core/services/user.service';
import {
  InventoryItemResponse,
  InventoryItemStoreStock,
} from '../../../models/inventory-item.model';
import { UserResponse } from '../../../models/user.model';
import { STORE_OPTIONS } from '../../../shared/store-options';

@Component({
  selector: 'app-item-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './item-list.component.html',
  styleUrl: './item-list.component.css',
})
export class ItemListComponent implements OnInit {
  private readonly itemService = inject(InventoryItemService);
  private readonly userService = inject(UserService);

  readonly displayedColumns = [
    'description',
    'quantity',
    'totalQuantity',
    'ownerUserId',
    'stateId',
    'actions',
  ];
  readonly storeInventoryColumns = [
    'description',
    'storeQuantity',
    'ownerUserId',
    'stateId',
    'actions',
  ];
  private readonly storeLabelMap = new Map(STORE_OPTIONS.map((store) => [store.id, store.label]));
  private readonly stateLabelMap = new Map<number, string>([
    [1, 'BUEN ESTADO'],
    [2, 'MAL ESTADO'],
    [3, 'SIN INFORMACION'],
    [4, 'USADO'],
  ]);
  items: InventoryItemResponse[] = [];
  users: UserResponse[] = [];
  storeTabs: { id: number; label: string }[] = [];
  loading = false;
  exporting = false;
  errorMessage = '';

  getStoreLabel(storeId: number) {
    return this.storeLabelMap.get(storeId) ?? `Almacen #${storeId}`;
  }

  getStoreDisplayName(stock: InventoryItemStoreStock) {
    const name = stock.storeName?.trim();
    return name ? name : this.getStoreLabel(stock.storeId);
  }

  getOwnerName(ownerUserId: number) {
    const user = this.users.find((currentUser) => currentUser.id === ownerUserId);
    return user ? `${user.firstName} ${user.lastName}` : `Usuario #${ownerUserId}`;
  }

  getStateLabel(item: InventoryItemResponse) {
    const title = item.stateTitle?.trim();

    if (title) {
      return title;
    }

    return this.stateLabelMap.get(item.stateId) ?? `Estado #${item.stateId}`;
  }

  getTotalStock(item: InventoryItemResponse) {
    return item.storeStocks.reduce((sum, stock) => sum + stock.quantity, 0);
  }

  getStoreStock(item: InventoryItemResponse, storeId: number) {
    return item.storeStocks.find((stock) => stock.storeId === storeId)?.quantity ?? 0;
  }

  getItemsByStore(storeId: number) {
    return this.items.filter((item) => item.storeStocks.some((stock) => stock.storeId === storeId));
  }

  buildStoreTabs(items: InventoryItemResponse[]) {
    const storeTabsMap = new Map<number, string>();

    for (const item of items) {
      for (const stock of item.storeStocks) {
        const currentLabel = storeTabsMap.get(stock.storeId);

        if (!currentLabel) {
          storeTabsMap.set(stock.storeId, this.getStoreDisplayName(stock));
        }
      }
    }

    this.storeTabs = Array.from(storeTabsMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([storeId, label]) => ({ id: storeId, label }));
  }

  ngOnInit() {
    this.loadItems();
  }

  loadItems() {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      items: this.itemService.getAll(),
      users: this.userService.getAll(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ items, users }) => {
          this.items = items;
          this.users = users;
          this.buildStoreTabs(items);
        },
        error: () => (this.errorMessage = 'No se pudieron cargar los articulos.'),
      });
  }

  downloadInventoryExcel() {
    if (this.exporting) {
      return;
    }

    this.exporting = true;

    this.itemService
      .exportExcel()
      .pipe(finalize(() => (this.exporting = false)))
      .subscribe({
        next: (response) => {
          const blob = response.body;

          if (!blob) {
            this.errorMessage = 'No se pudo descargar el archivo de inventario.';
            return;
          }

          const contentDisposition = response.headers.get('content-disposition') ?? '';
          const match = /filename=([^;]+)/i.exec(contentDisposition);
          const fileName = match ? match[1].replace(/"/g, '').trim() : 'inventory-by-store.xlsx';

          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.errorMessage = 'No se pudo descargar el archivo de inventario.';
        },
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
