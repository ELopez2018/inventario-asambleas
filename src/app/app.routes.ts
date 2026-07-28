import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { passwordChangeGuard } from './core/guards/password-change.guard';
import { screenAccessGuard } from './core/guards/screen-access.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/change-password/change-password.component').then(
        (m) => m.ChangePasswordComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard, passwordChangeGuard],
    loadComponent: () =>
      import('./shared/layout/main-layout.component').then((m) => m.MainLayoutComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'DASHBOARD' },
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'users',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'USERS' },
        loadComponent: () =>
          import('./features/users/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/new',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'USERS' },
        loadComponent: () =>
          import('./features/users/user-form/user-form.component').then((m) => m.UserFormComponent),
      },
      {
        path: 'users/:id/edit',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'USERS' },
        loadComponent: () =>
          import('./features/users/user-form/user-form.component').then((m) => m.UserFormComponent),
      },
      {
        path: 'events',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'EVENTS' },
        loadComponent: () =>
          import('./features/events/event-list/event-list.component').then(
            (m) => m.EventListComponent,
          ),
      },
      {
        path: 'events/new',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'EVENTS' },
        loadComponent: () =>
          import('./features/events/event-form/event-form.component').then(
            (m) => m.EventFormComponent,
          ),
      },
      {
        path: 'events/:id/edit',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'EVENTS' },
        loadComponent: () =>
          import('./features/events/event-form/event-form.component').then(
            (m) => m.EventFormComponent,
          ),
      },
      {
        path: 'inventory-items',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_ITEMS' },
        loadComponent: () =>
          import('./features/inventory-items/item-list/item-list.component').then(
            (m) => m.ItemListComponent,
          ),
      },
      {
        path: 'inventory-items/new',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_ITEMS' },
        loadComponent: () =>
          import('./features/inventory-items/item-form/item-form.component').then(
            (m) => m.ItemFormComponent,
          ),
      },
      {
        path: 'inventory-items/:id/edit',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_ITEMS' },
        loadComponent: () =>
          import('./features/inventory-items/item-form/item-form.component').then(
            (m) => m.ItemFormComponent,
          ),
      },
      {
        path: 'inventory-transactions',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_TRANSACTIONS' },
        loadComponent: () =>
          import('./features/inventory-transactions/transaction-list/transaction-list.component').then(
            (m) => m.TransactionListComponent,
          ),
      },
      {
        path: 'inventory-transactions/new',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_TRANSACTIONS' },
        loadComponent: () =>
          import('./features/inventory-transactions/transaction-form/transaction-form.component').then(
            (m) => m.TransactionFormComponent,
          ),
      },
      {
        path: 'inventory-transactions/:id/edit',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_TRANSACTIONS' },
        loadComponent: () =>
          import('./features/inventory-transactions/transaction-form/transaction-form.component').then(
            (m) => m.TransactionFormComponent,
          ),
      },
      {
        path: 'inventory-item-details',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_ITEM_DETAILS' },
        loadComponent: () =>
          import('./features/inventory-item-details/detail-list/detail-list.component').then(
            (m) => m.DetailListComponent,
          ),
      },
      {
        path: 'inventory-item-details/new',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_ITEM_DETAILS' },
        loadComponent: () =>
          import('./features/inventory-item-details/detail-form/detail-form.component').then(
            (m) => m.DetailFormComponent,
          ),
      },
      {
        path: 'inventory-item-details/:id/edit',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_ITEM_DETAILS' },
        loadComponent: () =>
          import('./features/inventory-item-details/detail-form/detail-form.component').then(
            (m) => m.DetailFormComponent,
          ),
      },
      {
        path: 'inventory-item-detail-photos',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'INVENTORY_ITEM_DETAIL_PHOTOS' },
        loadComponent: () =>
          import('./features/inventory-item-detail-photos/photo-list/photo-list.component').then(
            (m) => m.PhotoListComponent,
          ),
      },
      {
        path: 'transport-requests',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'TRANSPORT_REQUESTS' },
        loadComponent: () =>
          import('./features/transport-requests/request-list/request-list.component').then(
            (m) => m.RequestListComponent,
          ),
      },
      {
        path: 'transport-requests/new',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'TRANSPORT_REQUESTS' },
        loadComponent: () =>
          import('./features/transport-requests/request-form/request-form.component').then(
            (m) => m.RequestFormComponent,
          ),
      },
      {
        path: 'transport-requests/:id/edit',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'TRANSPORT_REQUESTS' },
        loadComponent: () =>
          import('./features/transport-requests/request-form/request-form.component').then(
            (m) => m.RequestFormComponent,
          ),
      },
      {
        path: 'admin/credentials',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'ADMIN_CREDENTIALS' },
        loadComponent: () =>
          import('./features/auth/admin-credentials/admin-credentials.component').then(
            (m) => m.AdminCredentialsComponent,
          ),
      },
      {
        path: 'admin/screen-access',
        canActivate: [screenAccessGuard],
        data: { screenCode: 'SCREEN_ACCESS_ADMIN' },
        loadComponent: () =>
          import('./features/auth/screen-access-admin/screen-access-admin.component').then(
            (m) => m.ScreenAccessAdminComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
