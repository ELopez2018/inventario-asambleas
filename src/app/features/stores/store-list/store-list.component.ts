import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { resolveProblemMessage } from '../../../core/problem-message';
import { AuthService } from '../../../core/services/auth.service';
import { StoreService } from '../../../core/services/store.service';
import { StoreResponse } from '../../../models/store.model';
import { ConfirmationService } from '../../../shared/confirmation.service';

@Component({
  selector: 'app-store-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
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
  private readonly confirmation = inject(ConfirmationService);
  private readonly draftPriorities = new Map<number, number>();

  readonly displayedColumns = [
    'priorityOrder',
    'description',
    'address',
    'phone',
    'gpsCoordinates',
    'available',
    'actions',
  ];
  readonly canUpdatePriority = computed(() =>
    this.auth.canAccessAction('STORES', 'updatePriority'),
  );
  readonly canCreate = computed(() => this.auth.canAccessAction('STORES', 'create'));
  readonly canEdit = computed(() => this.auth.canAccessAction('STORES', 'edit'));
  readonly canDelete = computed(() => this.auth.canAccessAction('STORES', 'delete'));

  stores: StoreResponse[] = [];
  loading = false;
  savingStoreId: number | null = null;
  deletingStoreId: number | null = null;
  togglingStoreId: number | null = null;
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

  toggleAvailability(store: StoreResponse, available: boolean): void {
    if (!this.canEdit() || this.togglingStoreId) {
      return;
    }

    this.togglingStoreId = store.id;

    this.storeService
      .updateAvailability(store.id, available)
      .pipe(finalize(() => (this.togglingStoreId = null)))
      .subscribe({
        next: () => {
          store.available = available;
          this.snackBar.open(
            available ? 'Bodega habilitada para el surtido.' : 'Bodega excluida del surtido.',
            'Cerrar',
            { duration: 3500 },
          );
        },
        error: (err: HttpErrorResponse) => {
          this.snackBar.open(
            resolveProblemMessage(err, 'No se pudo actualizar la disponibilidad.'),
            'Cerrar',
            { duration: 6000 },
          );
          // Revierte el switch al valor real.
          this.loadStores();
        },
      });
  }

  async deleteStore(store: StoreResponse): Promise<void> {
    if (!this.canDelete() || this.deletingStoreId) {
      return;
    }

    const confirmed = await this.confirmation.confirmDelete(
      `¿Eliminar la bodega "${store.description}"? Esta accion la quita del listado y del surtido.`,
    );

    if (!confirmed) {
      return;
    }

    this.deletingStoreId = store.id;

    this.storeService
      .delete(store.id)
      .pipe(finalize(() => (this.deletingStoreId = null)))
      .subscribe({
        next: () => {
          this.snackBar.open('Bodega eliminada.', 'Cerrar', { duration: 3500 });
          this.loadStores();
        },
        error: (err: HttpErrorResponse) => {
          const code = (err.error as { errorCode?: string } | null)?.errorCode;

          if (code === 'INV-STORE-DELETE-001') {
            // La bodega sigue en uso: se sugiere deshabilitarla en lugar de eliminarla.
            this.snackBar.open(
              `${resolveProblemMessage(err, 'No se puede eliminar la bodega.')} Si solo desea dejar de usarla, marquela como no disponible.`,
              'Cerrar',
              { duration: 9000 },
            );
          } else if (code === 'INV-STORE-404') {
            this.snackBar.open('La bodega ya no existe.', 'Cerrar', { duration: 4000 });
            this.loadStores();
          } else {
            this.snackBar.open(
              resolveProblemMessage(err, 'No se pudo eliminar la bodega.'),
              'Cerrar',
              { duration: 6000 },
            );
          }
        },
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
          (this.errorMessage = resolveProblemMessage(
            err,
            'No se pudo actualizar la prioridad.',
          )),
      });
  }
}
