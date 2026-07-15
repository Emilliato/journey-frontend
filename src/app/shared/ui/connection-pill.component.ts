import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ConnectivityService } from '../../core/services/connectivity.service';

/** The always-visible online/offline state pill (real reachability, not navigator.onLine). */
@Component({
  selector: 'lb-connection-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (connectivity.isOnline()) {
      <span class="lb-pill online">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M5 13a10 10 0 0 1 14 0" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>
        Online
      </span>
    } @else {
      <span class="lb-pill offline">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M2 2l20 20" />
          <path d="M8.5 16.5a5 5 0 0 1 7 0" />
          <circle cx="12" cy="20" r="1" fill="currentColor" />
        </svg>
        Offline<span class="pill-suffix"> — JOURNEY on device</span>
      </span>
    }
  `,
  // The long offline descriptor is dropped on narrow screens so the header
  // never overflows — the icon + "Offline" already reads clearly.
  styles: `
    @media (max-width: 560px) {
      .pill-suffix {
        display: none;
      }
    }
  `,
})
export class ConnectionPillComponent {
  protected readonly connectivity = inject(ConnectivityService);
}
