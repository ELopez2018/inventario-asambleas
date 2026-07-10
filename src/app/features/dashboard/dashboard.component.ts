import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <section class="mx-auto max-w-6xl">
      <div class="mb-6">
        <p class="text-sm font-medium uppercase tracking-wide text-indigo-700">AR 2026</p>
        <h1 class="text-3xl font-semibold text-slate-950">Panel de inventario</h1>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        @for (item of modules; track item.path) {
          <a
            [routerLink]="item.path"
            class="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow"
          >
            <div class="mb-4 flex h-10 w-10 items-center justify-center rounded bg-indigo-50 text-indigo-700">
              <mat-icon>{{ item.icon }}</mat-icon>
            </div>
            <div class="text-lg font-semibold text-slate-950">{{ item.title }}</div>
            <div class="mt-1 text-sm text-slate-600">{{ item.caption }}</div>
          </a>
        }
      </div>

      <div class="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold text-slate-950">Registrar movimiento</h2>
            <p class="text-sm text-slate-600">Ingreso, retorno, traslado, baja o egreso de articulos.</p>
          </div>
          <a mat-flat-button color="primary" routerLink="/inventory-transactions/new">
            <mat-icon>add</mat-icon>
            Nuevo movimiento
          </a>
        </div>
      </div>
    </section>
  `,
})
export class DashboardComponent {
  readonly modules = [
    { path: '/users', icon: 'people', title: 'Usuarios', caption: 'Responsables y contactos' },
    { path: '/events', icon: 'event', title: 'Eventos', caption: 'Fechas y observaciones' },
    {
      path: '/inventory-items',
      icon: 'inventory_2',
      title: 'Articulos',
      caption: 'Existencias y estado',
    },
    {
      path: '/inventory-transactions',
      icon: 'swap_horiz',
      title: 'Movimientos',
      caption: 'Historial del inventario',
    },
  ];
}
