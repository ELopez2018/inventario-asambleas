import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-redistribute-confirm-dialog',
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Redistribuir pedidos</h2>
    <mat-dialog-content>
      <div
        class="flex items-start gap-3 rounded border border-red-200 bg-red-50 p-4 text-sm leading-5 text-red-900"
      >
        <mat-icon class="shrink-0 text-red-700" aria-hidden="true">warning</mat-icon>
        <p>
          Esta acción redistribuirá todos los pedidos entre los almacenes y reemplazará las
          asignaciones actuales. ¿Desea continuar?
        </p>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancelar</button>
      <button mat-flat-button type="button" class="redistribute-confirm-button" (click)="confirm()">
        <mat-icon>restart_alt</mat-icon>
        Sí, redistribuir
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .redistribute-confirm-button {
      background: #b91c1c !important;
      color: #fff !important;
    }
  `,
})
export class RedistributeConfirmDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<RedistributeConfirmDialogComponent, boolean>);

  confirm(): void {
    this.dialogRef.close(true);
  }
}
