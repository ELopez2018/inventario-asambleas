import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { map } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';

// Covers tablets in both orientations, including the 1080px landscape viewport of iPad 9.
const COMPACT_LAYOUT_QUERY = '(max-width: 1100px)';

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
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly auth = inject(AuthService);
  readonly currentUser = this.auth.getCurrentUser();
  readonly isCompact = toSignal(
    this.breakpointObserver
      .observe(COMPACT_LAYOUT_QUERY)
      .pipe(map((breakpointState) => breakpointState.matches)),
    { initialValue: this.breakpointObserver.isMatched(COMPACT_LAYOUT_QUERY) },
  );

  readonly navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/users', label: 'Usuarios', icon: 'people', exact: false },
    { path: '/events', label: 'Eventos', icon: 'event', exact: false },
    { path: '/inventory-items', label: 'Articulos', icon: 'inventory_2', exact: false },
    { path: '/inventory-transactions', label: 'Movimientos', icon: 'swap_horiz', exact: false },
    { path: '/inventory-item-details', label: 'Detalle', icon: 'qr_code_2', exact: false },
    {
      path: '/inventory-item-detail-photos',
      label: 'Fotos detalle',
      icon: 'photo_camera',
      exact: false,
    },
  ];

  closeNavigation(sidenav: MatSidenav): void {
    if (this.isCompact()) {
      void sidenav.close();
    }
  }
}
