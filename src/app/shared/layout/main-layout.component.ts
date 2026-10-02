import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { map } from 'rxjs';
import { APP_VERSION } from '../../core/app-version';
import { AppIdentityService } from '../../core/services/app-identity.service';
import { AuthService } from '../../core/services/auth.service';
import { EventContextService } from '../../core/services/event-context.service';
import { RealtimeService } from '../../core/services/realtime.service';
import { UserService } from '../../core/services/user.service';
import { InternalChatFloatingPanelComponent } from '../../features/internal-chat/internal-chat-floating-panel/internal-chat-floating-panel.component';

// Covers tablets in both orientations, including the 1080px landscape viewport of iPad 9.
const COMPACT_LAYOUT_QUERY = '(max-width: 1100px)';
const SCREEN_ROUTE_BY_CODE: Record<string, string> = {
  DASHBOARD: '/dashboard',
  USERS: '/users',
  EVENTS: '/events',
  STORES: '/stores',
  STORE_ORDERS_REPORT: '/reports/store-orders',
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
    InternalChatFloatingPanelComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit, OnDestroy {
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly auth = inject(AuthService);
  readonly appIdentity = inject(AppIdentityService);
  readonly eventContext = inject(EventContextService);
  private readonly realtime = inject(RealtimeService);
  private readonly userService = inject(UserService);
  readonly currentUser = this.auth.getCurrentUser();
  readonly appVersion = APP_VERSION;
  readonly displayName = signal(this.auth.getCurrentUserDisplayName());
  readonly isCompact = toSignal(
    this.breakpointObserver
      .observe(COMPACT_LAYOUT_QUERY)
      .pipe(map((breakpointState) => breakpointState.matches)),
    { initialValue: this.breakpointObserver.isMatched(COMPACT_LAYOUT_QUERY) },
  );

  readonly navItems = computed(() =>
    this.auth
      .allowedScreens()
      .filter((screen) => screen.showInMenu)
      .map((screen) => {
        const path = this.resolveScreenPath(screen.code, screen.route, screen.title);

        return {
          code: screen.code,
          path,
          label: this.resolveScreenLabel(screen.code, screen.title),
          icon: screen.icon || 'chevron_right',
          accent: this.resolveScreenAccent(screen.code),
          exact: path === '/dashboard',
        };
      }),
  );

  ngOnInit(): void {
    this.auth.ensureMyScreensLoaded().subscribe({ error: () => undefined });
    this.eventContext.setActiveEvent(this.currentUser?.activeEvent ?? null);
    this.eventContext.loadActiveEvent();
    // Diferir la conexion en tiempo real para no bloquear el arranque del layout
    // si el socket falla (evita que el <router-outlet> quede sin montar).
    queueMicrotask(() => {
      try {
        this.realtime.connect();
      } catch (error) {
        console.warn('[layout] no se pudo iniciar el canal en tiempo real', error);
      }
    });
    this.loadCurrentUserName();
  }

  ngOnDestroy(): void {
    try {
      this.realtime.disconnect();
    } catch (error) {
      console.warn('[layout] no se pudo cerrar el canal en tiempo real', error);
    }
  }

  closeNavigation(sidenav: MatSidenav): void {
    if (this.isCompact()) {
      void sidenav.close();
    }
  }

  logout(): void {
    try {
      this.realtime.disconnect();
    } catch (error) {
      console.warn('[layout] no se pudo cerrar el canal en tiempo real', error);
    }
    this.auth.logout();
  }

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

  private resolveScreenLabel(code: string, title: string): string {
    if (code === 'INVENTORY_ITEMS') {
      return 'Inventarios';
    }

    if (code === 'TRANSPORT_REQUESTS') {
      return 'Transporte CO-31';
    }

    if (code === 'TRANSPORT_DELIVERY_RECEIPTS') {
      return 'Recibos CO-30';
    }

    if (code === 'STORE_ORDERS_REPORT') {
      return 'Pedidos por almacén';
    }

    return title;
  }

  private loadCurrentUserName(): void {
    const userId = this.currentUser?.userId;

    if (!userId) {
      return;
    }

    this.userService.getById(userId).subscribe({
      next: (user) => {
        const fullName = `${user.firstName} ${user.lastName}`.trim();

        if (fullName) {
          this.auth.updateCurrentUserName(user.firstName, user.lastName);
          this.displayName.set(fullName);
        }
      },
      error: () => undefined,
    });
  }

  private resolveScreenAccent(code: string): string {
    const accents: Record<string, string> = {
      DASHBOARD: 'cyan',
      USERS: 'violet',
      EVENTS: 'emerald',
      STORES: 'lime',
      STORE_ORDERS_REPORT: 'teal',
      INVENTORY_ITEMS: 'amber',
      INVENTORY_TRANSACTIONS: 'orange',
      INVENTORY_ITEM_DETAILS: 'sky',
      INVENTORY_ITEM_DETAIL_PHOTOS: 'rose',
      TRANSPORT_REQUESTS: 'blue',
      TRANSPORT_DELIVERY_RECEIPTS: 'teal',
      ADMIN_CREDENTIALS: 'fuchsia',
      SCREEN_ACCESS_ADMIN: 'indigo',
    };

    return accents[code] || 'slate';
  }
}
