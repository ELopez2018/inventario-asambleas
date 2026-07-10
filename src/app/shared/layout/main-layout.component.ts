import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-main-layout',
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatListModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  template: `
    <mat-sidenav-container class="h-screen bg-slate-50">
      <mat-sidenav mode="side" opened class="w-64 border-r border-slate-200 bg-slate-950 text-white">
        <div class="border-b border-white/10 px-5 py-4">
          <div class="text-base font-semibold">Inventario AR 2026</div>
          <div class="text-xs text-slate-300">Asamblea Regional</div>
        </div>

        <mat-nav-list class="app-nav-list">
          @for (item of navItems; track item.path) {
            <a
              mat-list-item
              [routerLink]="item.path"
              routerLinkActive="active-link"
              [routerLinkActiveOptions]="{ exact: item.exact }"
            >
              <mat-icon matListItemIcon>{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="flex min-w-0 flex-col">
        <mat-toolbar color="primary" class="shrink-0">
          <span class="text-base font-medium">Inventario</span>
          <span class="flex-1"></span>
          @if (currentUser?.username) {
            <span class="mr-2 hidden text-sm sm:inline">{{ currentUser?.username }}</span>
          }
          <button mat-icon-button type="button" aria-label="Cerrar sesion" (click)="auth.logout()">
            <mat-icon>logout</mat-icon>
          </button>
        </mat-toolbar>

        <main class="flex-1 overflow-auto p-4 sm:p-6">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: block;
    }

    .app-nav-list a {
      color: #e5e7eb;
    }

    .app-nav-list a.active-link {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
    }

    .app-nav-list mat-icon {
      color: currentColor;
    }
  `,
})
export class MainLayoutComponent {
  readonly auth = inject(AuthService);
  readonly currentUser = this.auth.getCurrentUser();

  readonly navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/users', label: 'Usuarios', icon: 'people', exact: false },
    { path: '/events', label: 'Eventos', icon: 'event', exact: false },
    { path: '/inventory-items', label: 'Articulos', icon: 'inventory_2', exact: false },
    { path: '/inventory-transactions', label: 'Movimientos', icon: 'swap_horiz', exact: false },
  ];
}
