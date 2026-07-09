import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SyncManagerService } from './core/offline/sync-manager.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  // Injected here (not lazily via a feature component) so the sync manager
  // exists — and its reconnect-watching effect is live — for the whole
  // time the app is open, not just while a chat page happens to be mounted.
  protected readonly syncManager = inject(SyncManagerService);
}
