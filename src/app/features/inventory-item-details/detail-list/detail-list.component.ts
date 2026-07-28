import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { InventoryItemDetailService } from '../../../core/services/inventory-item-detail.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { InventoryItemDetailResponse } from '../../../models/inventory-item-detail.model';
import { InventoryItemResponse } from '../../../models/inventory-item.model';
import {
  INVENTORY_STATES,
  INVENTORY_STORES,
  INVENTORY_UNIT_TYPES,
} from '../../../shared/catalogs.constants';

@Component({
  selector: 'app-detail-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './detail-list.component.html',
  styleUrl: './detail-list.component.css',
})
export class DetailListComponent implements OnInit {
  private readonly detailService = inject(InventoryItemDetailService);
  private readonly itemService = inject(InventoryItemService);
  private readonly auth = inject(AuthService);

  readonly displayedColumns = [
    'code',
    'itemId',
    'storeId',
    'physicalStateId',
    'itemStatus',
    'unitTypeId',
    'serial',
    'actions',
  ];
  readonly canCreateDetails = computed(() =>
    this.auth.canAccessAction('INVENTORY_ITEM_DETAILS', 'create'),
  );
  readonly canEditDetails = computed(() =>
    this.auth.canAccessAction('INVENTORY_ITEM_DETAILS', 'edit'),
  );
  readonly canDeleteDetails = computed(() =>
    this.auth.canAccessAction('INVENTORY_ITEM_DETAILS', 'delete'),
  );
  private readonly storeLabelMap = new Map(
    INVENTORY_STORES.map((store) => [store.id, store.label]),
  );
  private readonly stateLabelMap = new Map(
    INVENTORY_STATES.map((state) => [state.id, state.label]),
  );
  private readonly unitTypeLabelMap = new Map(
    INVENTORY_UNIT_TYPES.map((type) => [type.id, type.label]),
  );

  details: InventoryItemDetailResponse[] = [];
  items: InventoryItemResponse[] = [];
  loading = false;
  errorMessage = '';

  ngOnInit() {
    this.loadDetails();
  }

  getItemLabel(itemId: number) {
    return this.items.find((item) => item.id === itemId)?.description ?? `Articulo #${itemId}`;
  }

  getStoreLabel(detail: InventoryItemDetailResponse) {
    return (
      detail.storeName?.trim() ||
      this.storeLabelMap.get(detail.storeId) ||
      `Bodega #${detail.storeId}`
    );
  }

  getStateLabel(detail: InventoryItemDetailResponse) {
    return (
      detail.physicalStateTitle?.trim() ||
      this.stateLabelMap.get(detail.physicalStateId) ||
      `Estado #${detail.physicalStateId}`
    );
  }

  getUnitTypeLabel(detail: InventoryItemDetailResponse) {
    return (
      detail.unitTypeTitle?.trim() ||
      this.unitTypeLabelMap.get(detail.unitTypeId) ||
      `Tipo #${detail.unitTypeId}`
    );
  }

  loadDetails() {
    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      details: this.detailService.getAll(),
      items: this.itemService.getAll(),
    })
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: ({ details, items }) => {
          this.details = details;
          this.items = items;
        },
        error: () => (this.errorMessage = 'No se pudo cargar el detalle de inventario.'),
      });
  }

  deleteDetail(detail: InventoryItemDetailResponse) {
    const confirmed = confirm(`Eliminar el detalle ${detail.code}?`);

    if (!confirmed) {
      return;
    }

    this.detailService.delete(detail.id).subscribe({
      next: () => this.loadDetails(),
      error: () => (this.errorMessage = 'No se pudo eliminar el detalle.'),
    });
  }
}
