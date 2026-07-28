import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { InventoryTransactionService } from '../../../core/services/inventory-transaction.service';
import { InventoryTransactionResponse } from '../../../models/inventory-transaction.model';
import { STORE_OPTIONS } from '../../../shared/store-options';

@Component({
  selector: 'app-transaction-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './transaction-list.component.html',
  styleUrl: './transaction-list.component.css',
})
export class TransactionListComponent implements OnInit {
  private readonly transactionService = inject(InventoryTransactionService);
  private readonly auth = inject(AuthService);

  readonly displayedColumns = [
    'movementDate',
    'movementType',
    'itemId',
    'quantity',
    'sourceStoreId',
    'destinationStoreId',
    'origin',
    'destination',
    'actions',
  ];
  readonly canCreateTransactions = computed(() =>
    this.auth.canAccessAction('INVENTORY_TRANSACTIONS', 'create'),
  );
  readonly canEditTransactions = computed(() =>
    this.auth.canAccessAction('INVENTORY_TRANSACTIONS', 'edit'),
  );
  readonly canDeleteTransactions = computed(() =>
    this.auth.canAccessAction('INVENTORY_TRANSACTIONS', 'delete'),
  );
  private readonly storeLabelMap = new Map(STORE_OPTIONS.map((store) => [store.id, store.label]));
  transactions: InventoryTransactionResponse[] = [];
  loading = false;
  errorMessage = '';

  getStoreLabel(storeId: number | null) {
    if (!storeId) {
      return '-';
    }

    return this.storeLabelMap.get(storeId) ?? `Almacen #${storeId}`;
  }

  ngOnInit() {
    this.loadTransactions();
  }

  loadTransactions() {
    this.loading = true;
    this.errorMessage = '';

    this.transactionService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (transactions) => (this.transactions = transactions),
        error: () => (this.errorMessage = 'No se pudieron cargar los movimientos.'),
      });
  }

  deleteTransaction(transaction: InventoryTransactionResponse) {
    const confirmed = confirm(`Eliminar el movimiento #${transaction.id}?`);

    if (!confirmed) {
      return;
    }

    this.transactionService.delete(transaction.id).subscribe({
      next: () => this.loadTransactions(),
      error: () => (this.errorMessage = 'No se pudo eliminar el movimiento.'),
    });
  }
}
