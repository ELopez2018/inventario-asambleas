import { CommonModule } from '@angular/common';
import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, OnInit, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { map } from 'rxjs';
import { APP_VERSION } from '../../core/app-version';
import { AuthService } from '../../core/services/auth.service';
import { EventContextService } from '../../core/services/event-context.service';

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
    MatFormFieldModule,
    MatIconModule,
    MatListModule,
    MatSelectModule,
    MatSidenavModule,
    MatToolbarModule,
  ],
  templateUrl: './main-layout.component.html',
  styleUrl: './main-layout.component.css',
})
export class MainLayoutComponent implements OnInit {
  private readonly breakpointObserver = inject(BreakpointObserver);

  readonly auth = inject(AuthService);
  readonly eventContext = inject(EventContextService);
  readonly currentUser = this.auth.getCurrentUser();
  readonly appVersion = APP_VERSION;
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
      .map((screen) => ({
        code: screen.code,
        path: this.normalizeRoute(screen.route),
        label: this.resolveScreenLabel(screen.code, screen.title),
        icon: screen.icon || 'chevron_right',
        exact: screen.route === '/dashboard' || screen.route === 'dashboard',
      })),
  );

  ngOnInit(): void {
    this.auth.ensureMyScreensLoaded().subscribe({ error: () => undefined });
    this.eventContext.loadEvents();
  }

  selectEvent(eventId: number): void {
    this.eventContext.selectEvent(Number(eventId) || null);
  }

  closeNavigation(sidenav: MatSidenav): void {
    if (this.isCompact()) {
      void sidenav.close();
    }
  }

  private normalizeRoute(route: string): string {
    return route.startsWith('/') ? route : `/${route}`;
  }

  private resolveScreenLabel(code: string, title: string): string {
    if (code === 'INVENTORY_ITEMS') {
      return 'Inventarios';
    }

    return title;
  }
}
