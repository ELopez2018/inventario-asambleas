import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppIdentityService } from './core/services/app-identity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly appIdentity = inject(AppIdentityService);
}
