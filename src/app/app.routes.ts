import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { passwordChangeGuard } from './core/guards/password-change.guard';
import { superRoleGuard } from './core/guards/super-role.guard';

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
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./features/users/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/new',
        loadComponent: () =>
          import('./features/users/user-form/user-form.component').then((m) => m.UserFormComponent),
      },
      {
        path: 'users/:id/edit',
        loadComponent: () =>
          import('./features/users/user-form/user-form.component').then((m) => m.UserFormComponent),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./features/events/event-list/event-list.component').then(
            (m) => m.EventListComponent,
          ),
      },
      {
        path: 'events/new',
        loadComponent: () =>
          import('./features/events/event-form/event-form.component').then(
            (m) => m.EventFormComponent,
          ),
      },
      {
        path: 'events/:id/edit',
        loadComponent: () =>
          import('./features/events/event-form/event-form.component').then(
            (m) => m.EventFormComponent,
          ),
      },
      {
        path: 'inventory-items',
        loadComponent: () =>
          import('./features/inventory-items/item-list/item-list.component').then(
            (m) => m.ItemListComponent,
          ),
      },
      {
        path: 'inventory-items/new',
        loadComponent: () =>
          import('./features/inventory-items/item-form/item-form.component').then(
            (m) => m.ItemFormComponent,
          ),
      },
      {
        path: 'inventory-items/:id/edit',
        loadComponent: () =>
          import('./features/inventory-items/item-form/item-form.component').then(
            (m) => m.ItemFormComponent,
          ),
      },
      {
        path: 'inventory-transactions',
        loadComponent: () =>
          import('./features/inventory-transactions/transaction-list/transaction-list.component').then(
            (m) => m.TransactionListComponent,
          ),
      },
      {
        path: 'inventory-transactions/new',
        loadComponent: () =>
          import('./features/inventory-transactions/transaction-form/transaction-form.component').then(
            (m) => m.TransactionFormComponent,
          ),
      },
      {
        path: 'inventory-transactions/:id/edit',
        loadComponent: () =>
          import('./features/inventory-transactions/transaction-form/transaction-form.component').then(
            (m) => m.TransactionFormComponent,
          ),
      },
      {
        path: 'inventory-item-details',
        loadComponent: () =>
          import('./features/inventory-item-details/detail-list/detail-list.component').then(
            (m) => m.DetailListComponent,
          ),
      },
      {
        path: 'inventory-item-details/new',
        loadComponent: () =>
          import('./features/inventory-item-details/detail-form/detail-form.component').then(
            (m) => m.DetailFormComponent,
          ),
      },
      {
        path: 'inventory-item-details/:id/edit',
        loadComponent: () =>
          import('./features/inventory-item-details/detail-form/detail-form.component').then(
            (m) => m.DetailFormComponent,
          ),
      },
      {
        path: 'inventory-item-detail-photos',
        loadComponent: () =>
          import('./features/inventory-item-detail-photos/photo-list/photo-list.component').then(
            (m) => m.PhotoListComponent,
          ),
      },
      {
        path: 'transport-requests',
        loadComponent: () =>
          import('./features/transport-requests/request-list/request-list.component').then(
            (m) => m.RequestListComponent,
          ),
      },
      {
        path: 'transport-requests/new',
        loadComponent: () =>
          import('./features/transport-requests/request-form/request-form.component').then(
            (m) => m.RequestFormComponent,
          ),
      },
      {
        path: 'transport-requests/:id/edit',
        loadComponent: () =>
          import('./features/transport-requests/request-form/request-form.component').then(
            (m) => m.RequestFormComponent,
          ),
      },
      {
        path: 'admin/credentials',
        canActivate: [superRoleGuard],
        loadComponent: () =>
          import('./features/auth/admin-credentials/admin-credentials.component').then(
            (m) => m.AdminCredentialsComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
