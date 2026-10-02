import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';

const SCREEN_ROUTE_BY_CODE: Record<string, string> = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
  EVENTS: '/events',
  STORES: '/stores',
  INVENTORY_ITEMS: '/inventory-items',
  INVENTORY_TRANSACTIONS: '/inventory-transactions',
  INVENTORY_ITEM_DETAILS: '/inventory-item-details',
  INVENTORY_ITEM_DETAIL_PHOTOS: '/inventory-item-detail-photos',
  TRANSPORT_REQUESTS: '/transport-requests',
  TRANSPORT_DELIVERY_RECEIPTS: '/transport-delivery-receipts',
  ADMIN_CREDENTIALS: '/admin/credentials',
  SCREEN_ACCESS_ADMIN: '/admin/screen-access',
};

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
    ['STORES', 'Prioridad para surtido automatico'],
    ['INVENTORY_ITEMS', 'Existencias y estado'],
    ['INVENTORY_TRANSACTIONS', 'Historial del inventario'],
    ['INVENTORY_ITEM_DETAILS', 'Unidades por articulo y bodega'],
    ['INVENTORY_ITEM_DETAIL_PHOTOS', 'Fotos con validacion GPS'],
    ['TRANSPORT_REQUESTS', 'Solicitudes CO-31 y elementos a transportar'],
    ['TRANSPORT_DELIVERY_RECEIPTS', 'Recibos CO-30 registrados'],
    ['ADMIN_CREDENTIALS', 'Credenciales y roles del sistema'],
    ['SCREEN_ACCESS_ADMIN', 'Permisos por rol y usuario'],
  ]);
  private readonly accents = new Map([
    ['USERS', 'violet'],
    ['EVENTS', 'emerald'],
    ['STORES', 'lime'],
    ['INVENTORY_ITEMS', 'amber'],
    ['INVENTORY_TRANSACTIONS', 'orange'],
    ['INVENTORY_ITEM_DETAILS', 'cyan'],
    ['INVENTORY_ITEM_DETAIL_PHOTOS', 'rose'],
    ['TRANSPORT_REQUESTS', 'blue'],
    ['TRANSPORT_DELIVERY_RECEIPTS', 'teal'],
    ['ADMIN_CREDENTIALS', 'indigo'],
    ['SCREEN_ACCESS_ADMIN', 'fuchsia'],
  ]);

  readonly modules = computed(() =>
    this.auth
      .allowedScreens()
      .filter((screen) => screen.code !== 'DASHBOARD' && screen.showInMenu)
      .map((screen) => ({
        path: this.resolveScreenPath(screen.code, screen.route, screen.title),
        icon: screen.icon || 'chevron_right',
        title: screen.code === 'INVENTORY_ITEMS' ? 'Inventarios' : screen.title,
        caption: this.captions.get(screen.code) ?? screen.section,
        accent: this.accents.get(screen.code) ?? 'slate',
      })),
  );

  readonly canCreateTransportRequestShortcut = computed(() =>
    this.auth.canAccessAction('TRANSPORT_REQUESTS', 'create'),
  );

  private normalizeRoute(route: string): string {
    const trimmed = route.trim();

    if (!trimmed) {
      return '/dashboard';
    }

    const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return normalized.replace(/\/+/g, '/').toLowerCase();
  }

  private resolveScreenPath(code: string, route: string, title: string): string {
    const canonicalPath = SCREEN_ROUTE_BY_CODE[code];

    if (canonicalPath) {
      return canonicalPath;
    }

    const normalizedRoute = this.normalizeRoute(route);

    if (Object.values(SCREEN_ROUTE_BY_CODE).some((path) => normalizedRoute.startsWith(path))) {
      return normalizedRoute;
    }

    const normalizedTitle = title.trim().toLowerCase();

    if (normalizedTitle.includes('recib') && normalizedTitle.includes('oper')) {
      return '/transport-delivery-receipts';
    }

    return normalizedRoute;
  }
}
