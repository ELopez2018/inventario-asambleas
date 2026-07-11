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
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
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
