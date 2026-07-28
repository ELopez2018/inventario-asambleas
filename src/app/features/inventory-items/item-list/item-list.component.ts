import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize, forkJoin, startWith } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { InventoryItemService } from '../../../core/services/inventory-item.service';
import { UserService } from '../../../core/services/user.service';
import {
  InventoryItemResponse,
  InventoryItemStoreStock,
} from '../../../models/inventory-item.model';
import { UserResponse } from '../../../models/user.model';
import { INVENTORY_STATES, INVENTORY_STORES } from '../../../shared/catalogs.constants';

interface MergeItemsDialogData {
  targetItem: InventoryItemResponse;
  items: InventoryItemResponse[];
}

@Component({
  selector: 'app-item-list',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatInputModule,
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
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

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
  private readonly storeLabelMap = new Map(INVENTORY_STORES.map((store) => [store.id, store.code]));
  private readonly stateLabelMap = new Map(INVENTORY_STATES.map((state) => [state.id, state.code]));
  readonly canCreateItems = computed(() => this.auth.canAccessAction('INVENTORY_ITEMS', 'create'));
  readonly canExportItems = computed(() => this.auth.canAccessAction('INVENTORY_ITEMS', 'export'));
  readonly canEditItems = computed(() => this.auth.canAccessAction('INVENTORY_ITEMS', 'edit'));
  readonly canDeleteItems = computed(() => this.auth.canAccessAction('INVENTORY_ITEMS', 'delete'));
  readonly canMergeItems = computed(() => this.auth.canAccessAction('INVENTORY_ITEMS', 'merge'));
  readonly itemFilter = new FormControl('', { nonNullable: true });
  items: InventoryItemResponse[] = [];
  filteredItems: InventoryItemResponse[] = [];
  autocompleteOptions: string[] = [];
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

  getStateTone(item: InventoryItemResponse) {
    const stateText = this.normalizeFilterText(this.getStateLabel(item));

    if (stateText.includes('buen')) {
      return 'good';
    }

    if (stateText.includes('mal')) {
      return 'bad';
    }

    if (stateText.includes('usado')) {
      return 'used';
    }

    return 'unknown';
  }

  getTotalStock(item: InventoryItemResponse) {
    return item.storeStocks.reduce((sum, stock) => sum + stock.quantity, 0);
  }

  getStoreStock(item: InventoryItemResponse, storeId: number) {
    return item.storeStocks.find((stock) => stock.storeId === storeId)?.quantity ?? 0;
  }

  getItemsByStore(storeId: number) {
    return this.filteredItems.filter((item) =>
      item.storeStocks.some((stock) => stock.storeId === storeId),
    );
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
    this.itemFilter.valueChanges
      .pipe(startWith(this.itemFilter.value), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.applyItemFilter(value));

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
          this.applyItemFilter(this.itemFilter.value);
        },
        error: () => (this.errorMessage = 'No se pudieron cargar los articulos.'),
      });
  }

  clearItemFilter() {
    this.itemFilter.setValue('');
  }

  private applyItemFilter(value: string) {
    const query = this.normalizeFilterText(value);

    this.autocompleteOptions = this.buildAutocompleteOptions(query);

    if (!query) {
      this.filteredItems = this.items;
      return;
    }

    this.filteredItems = this.items.filter((item) =>
      this.getFilterText(item).includes(query),
    );
  }

  private buildAutocompleteOptions(query: string) {
    const options = this.items
      .map((item) => item.description.trim())
      .filter(Boolean)
      .filter((description, index, self) => self.indexOf(description) === index)
      .filter((description) =>
        query ? this.normalizeFilterText(description).includes(query) : true,
      )
      .sort((a, b) => a.localeCompare(b));

    return options.slice(0, 12);
  }

  private getFilterText(item: InventoryItemResponse) {
    const stores = item.storeStocks
      .map((stock) => `${this.getStoreDisplayName(stock)} ${stock.quantity}`)
      .join(' ');

    return this.normalizeFilterText(
      [
        item.description,
        this.getOwnerName(item.ownerUserId),
        this.getStateLabel(item),
        stores,
        this.getTotalStock(item).toString(),
      ].join(' '),
    );
  }

  private normalizeFilterText(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
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

  openMergeDialog(targetItem: InventoryItemResponse) {
    if (!this.canMergeItems()) {
      return;
    }

    const dialogRef = this.dialog.open(MergeItemsDialogComponent, {
      width: 'min(96vw, 680px)',
      maxWidth: '96vw',
      data: {
        targetItem,
        items: this.items,
      } satisfies MergeItemsDialogData,
    });

    dialogRef.afterClosed().subscribe((merged?: boolean) => {
      if (!merged) {
        return;
      }

      this.loadItems();
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

@Component({
  selector: 'app-merge-items-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
  ],
  template: `
    <h2 mat-dialog-title>Unir inventarios</h2>

    <mat-dialog-content>
      <div class="space-y-4">
        <div class="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          <div class="font-medium text-slate-950">Inventario que se conserva</div>
          <div class="mt-1">{{ data.targetItem.description }}</div>
          <div class="mt-1 text-xs text-slate-500">
            ID #{{ data.targetItem.id }} - Total:
            {{ getTotalStock(data.targetItem) | number: '1.0-2' }}
          </div>
        </div>

        <div class="rounded border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
          <div class="flex items-start gap-2">
            <mat-icon class="mt-0.5 text-base">warning</mat-icon>
            <p>
              Confirme bien la seleccion. El inventario duplicado sera reemplazado y sus
              movimientos, detalles y existencias pasaran al inventario que se conserva.
            </p>
          </div>
        </div>

        <mat-form-field appearance="outline" class="w-full">
          <mat-label>Inventario duplicado que se reemplaza</mat-label>
          <mat-select [formControl]="sourceItemId">
            @for (item of sourceOptions; track item.id) {
              <mat-option [value]="item.id">
                #{{ item.id }} - {{ item.description }} - Total:
                {{ getTotalStock(item) | number: '1.0-2' }}
              </mat-option>
            }
          </mat-select>
          @if (sourceItemId.hasError('min')) {
            <mat-error>Seleccione un inventario distinto al destino.</mat-error>
          }
        </mat-form-field>

        @if (successMessage) {
          <div class="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            <div class="flex items-start gap-2">
              <mat-icon class="mt-0.5 text-base">check_circle</mat-icon>
              <span>{{ successMessage }}</span>
            </div>
          </div>
        }

        @if (errorMessage) {
          <div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <div class="flex items-start gap-2">
              <mat-icon class="mt-0.5 text-base">error</mat-icon>
              <span>{{ errorMessage }}</span>
            </div>
          </div>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (successMessage) {
        <button mat-flat-button color="primary" type="button" (click)="closeAfterSuccess()">
          Cerrar
        </button>
      } @else {
        <button mat-button type="button" [disabled]="saving" mat-dialog-close>Cancelar</button>
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="sourceItemId.invalid || saving"
          (click)="confirm()"
        >
          @if (saving) {
            <mat-spinner diameter="18" class="mr-2 inline-block" />
          }
          Unir
        </button>
      }
    </mat-dialog-actions>
  `,
})
export class MergeItemsDialogComponent {
  readonly data = inject<MergeItemsDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<MergeItemsDialogComponent, boolean>);
  private readonly itemService = inject(InventoryItemService);

  readonly sourceItemId = new FormControl(0, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(1)],
  });

  readonly sourceOptions = this.data.items.filter((item) => item.id !== this.data.targetItem.id);
  saving = false;
  successMessage = '';
  errorMessage = '';

  getTotalStock(item: InventoryItemResponse) {
    return item.storeStocks.reduce((sum, stock) => sum + stock.quantity, 0);
  }

  confirm() {
    if (this.sourceItemId.invalid || this.saving) {
      this.sourceItemId.markAsTouched();
      return;
    }

    this.saving = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.itemService
      .merge(this.data.targetItem.id, { sourceItemId: this.sourceItemId.value })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (mergedItem) => {
          this.successMessage = `Inventarios unidos correctamente. Se conserva "${mergedItem.description}".`;
          this.sourceItemId.disable({ emitEvent: false });
        },
        error: (err) => {
          this.errorMessage = this.resolveBackendMessage(err);
        },
      });
  }

  closeAfterSuccess() {
    this.dialogRef.close(true);
  }

  private resolveBackendMessage(err: any): string {
    const backendMessage = err?.error?.detail || err?.error?.message || err?.error?.title;

    if (backendMessage) {
      return backendMessage;
    }

    if (err?.status === 400) {
      return 'El backend rechazo la union. Revise que el origen y destino sean inventarios diferentes.';
    }

    if (err?.status === 404) {
      return 'No se encontro uno de los inventarios seleccionados.';
    }

    if (err?.status === 403) {
      return 'No tiene permisos para unir inventarios.';
    }

    return 'No se pudieron unir los inventarios. Intente nuevamente.';
  }
}
