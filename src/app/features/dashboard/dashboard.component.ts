import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
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
