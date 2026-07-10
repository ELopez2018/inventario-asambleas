import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { InventoryTransactionService } from '../../../core/services/inventory-transaction.service';
import { InventoryTransactionResponse } from '../../../models/inventory-transaction.model';

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
  template: `
    <section class="mx-auto max-w-7xl">
      <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-950">Movimientos</h1>
          <p class="text-sm text-slate-600">Entradas, retornos, traslados, bajas y egresos.</p>
        </div>
        <a mat-flat-button color="primary" routerLink="/inventory-transactions/new">
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
        } @else if (!transactions.length) {
          <div class="p-6 text-sm text-slate-600">No hay movimientos registrados.</div>
        } @else {
          <div class="overflow-x-auto">
            <table mat-table [dataSource]="transactions" class="min-w-full">
              <ng-container matColumnDef="movementDate">
                <th mat-header-cell *matHeaderCellDef>Fecha</th>
                <td mat-cell *matCellDef="let transaction">
                  {{ transaction.movementDate | date: 'short' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="movementType">
                <th mat-header-cell *matHeaderCellDef>Tipo</th>
                <td mat-cell *matCellDef="let transaction">{{ transaction.movementType }}</td>
              </ng-container>

              <ng-container matColumnDef="itemId">
                <th mat-header-cell *matHeaderCellDef>Articulo</th>
                <td mat-cell *matCellDef="let transaction">#{{ transaction.itemId }}</td>
              </ng-container>

              <ng-container matColumnDef="quantity">
                <th mat-header-cell *matHeaderCellDef>Cantidad</th>
                <td mat-cell *matCellDef="let transaction">{{ transaction.quantity | number: '1.0-2' }}</td>
              </ng-container>

              <ng-container matColumnDef="origin">
                <th mat-header-cell *matHeaderCellDef>Origen</th>
                <td mat-cell *matCellDef="let transaction">{{ transaction.origin || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="destination">
                <th mat-header-cell *matHeaderCellDef>Destino</th>
                <td mat-cell *matCellDef="let transaction">{{ transaction.destination || '-' }}</td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef class="w-28 text-right">Acciones</th>
                <td mat-cell *matCellDef="let transaction" class="text-right">
                  <a
                    mat-icon-button
                    [routerLink]="['/inventory-transactions', transaction.id, 'edit']"
                    matTooltip="Editar"
                  >
                    <mat-icon>edit</mat-icon>
                  </a>
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Eliminar"
                    (click)="deleteTransaction(transaction)"
                  >
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
export class TransactionListComponent implements OnInit {
  private readonly transactionService = inject(InventoryTransactionService);

  readonly displayedColumns = [
    'movementDate',
    'movementType',
    'itemId',
    'quantity',
    'origin',
    'destination',
    'actions',
  ];
  transactions: InventoryTransactionResponse[] = [];
  loading = false;
  errorMessage = '';

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
