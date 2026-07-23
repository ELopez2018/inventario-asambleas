import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly auth = inject(AuthService);
  private readonly captions = new Map([
    ['USERS', 'Responsables y contactos'],
    ['EVENTS', 'Fechas y observaciones'],
    ['INVENTORY_ITEMS', 'Existencias y estado'],
    ['INVENTORY_TRANSACTIONS', 'Historial del inventario'],
    ['INVENTORY_ITEM_DETAILS', 'Unidades por articulo y bodega'],
    ['INVENTORY_ITEM_DETAIL_PHOTOS', 'Fotos con validacion GPS'],
    ['TRANSPORT_REQUESTS', 'Solicitudes y elementos a transportar'],
    ['SCREEN_ACCESS_ADMIN', 'Permisos por rol y usuario'],
  ]);

  readonly modules = computed(() =>
    this.auth
      .allowedScreens()
      .filter((screen) => screen.code !== 'DASHBOARD' && screen.showInMenu)
      .map((screen) => ({
        path: screen.route.startsWith('/') ? screen.route : `/${screen.route}`,
        icon: screen.icon || 'chevron_right',
        title: screen.code === 'INVENTORY_ITEMS' ? 'Inventarios' : screen.title,
        caption: this.captions.get(screen.code) ?? screen.section,
      })),
  );

  readonly canAccessMovements = computed(() =>
    this.auth.canAccessScreen('INVENTORY_TRANSACTIONS'),
  );
}
