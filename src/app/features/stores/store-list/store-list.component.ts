import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { StoreService } from '../../../core/services/store.service';
import { StoreResponse } from '../../../models/store.model';

function resolveBackendUserMessage(err: HttpErrorResponse, fallback: string): string {
  const problem = err.error as
    | { userMessage?: string; detail?: string; message?: string; title?: string }
    | null
    | undefined;

  return problem?.userMessage ?? problem?.detail ?? problem?.message ?? problem?.title ?? fallback;
}

@Component({
  selector: 'app-store-list',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './store-list.component.html',
  styleUrl: './store-list.component.css',
})
export class StoreListComponent implements OnInit {
  private readonly storeService = inject(StoreService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly draftPriorities = new Map<number, number>();

  readonly displayedColumns = ['priorityOrder', 'description', 'address', 'phone', 'available', 'actions'];
  readonly canUpdatePriority = computed(() =>
    this.auth.canAccessAction('STORES', 'updatePriority'),
  );

  stores: StoreResponse[] = [];
  loading = false;
  savingStoreId: number | null = null;
  errorMessage = '';

  ngOnInit(): void {
    this.loadStores();
  }

  loadStores(): void {
    this.loading = true;
    this.errorMessage = '';

    this.storeService
      .getAll()
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (stores) => {
          this.stores = stores;
          this.draftPriorities.clear();
          stores.forEach((store) => this.draftPriorities.set(store.id, store.priorityOrder));
        },
        error: () => (this.errorMessage = 'No se pudieron cargar las bodegas.'),
      });
  }

  getPriorityDraft(store: StoreResponse): number {
    return this.draftPriorities.get(store.id) ?? store.priorityOrder;
  }

  onPriorityInput(store: StoreResponse, event: Event): void {
    const input = event.target as HTMLInputElement;
    const priorityOrder = Number(input.value);

    this.draftPriorities.set(store.id, Number.isFinite(priorityOrder) ? priorityOrder : 0);
  }

  hasPriorityChanged(store: StoreResponse): boolean {
    return this.getPriorityDraft(store) !== store.priorityOrder;
  }

  savePriority(store: StoreResponse): void {
    if (!this.canUpdatePriority() || this.savingStoreId) {
      return;
    }

    const priorityOrder = this.getPriorityDraft(store);

    if (!Number.isFinite(priorityOrder) || priorityOrder < 0) {
      this.errorMessage = 'La prioridad no puede ser negativa.';
      return;
    }

    this.savingStoreId = store.id;
    this.errorMessage = '';

    this.storeService
      .updatePriority(store.id, priorityOrder)
      .pipe(finalize(() => (this.savingStoreId = null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Prioridad actualizada.', 'Cerrar', { duration: 3500 });
          this.loadStores();
        },
        error: (err: HttpErrorResponse) =>
          (this.errorMessage = resolveBackendUserMessage(
            err,
            'No se pudo actualizar la prioridad.',
          )),
      });
  }
}
