import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SyncManagerService } from './core/offline/sync-manager.service';
import { WebLlmService } from './core/offline/webllm.service';

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

  private readonly webLlmService = inject(WebLlmService);

  constructor() {
    // Probe the GPU and warm the on-device model the moment the app opens:
    // downloads the model shards while connectivity exists (no-op once
    // cached, no-op on unsupported devices), so offline mode is ready
    // before it's ever needed. Background and non-blocking — bootstrap
    // and routing continue immediately.
    this.webLlmService.preload();
  }
}
