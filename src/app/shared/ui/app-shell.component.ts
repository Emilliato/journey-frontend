import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ConnectionPillComponent } from './connection-pill.component';
import { AuthService } from '../../core/services/auth.service';
import { ConnectivityService } from '../../core/services/connectivity.service';

/**
 * The learner/parent chrome: brand header with a connection pill, a
 * sign-out control, and a floating bottom nav. `variant` swaps the body
 * font (rounded display for learners, clean sans for parents) and the nav
 * items.
 */
@Component({
  selector: 'lb-app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, ConnectionPillComponent],
  template: `
    <div class="shell" [class.font-learner]="variant() === 'learner'" [class.font-parent]="variant() === 'parent'">
      <header class="shell-header">
        <a class="brand" routerLink="/learners">
          <svg width="30" height="30" viewBox="0 0 40 40" aria-hidden="true">
            <rect x="2" y="2" width="36" height="36" rx="12" fill="var(--lb-indigo)" />
            <path d="M11 26 L11 14 L15 14 L15 22 L23 22 L23 26 Z" fill="#fff" />
            <circle cx="28" cy="15" r="4" fill="var(--lb-amber)" />
          </svg>
          <span class="brand-name font-display">Learn<span>Bridge</span></span>
        </a>
        <div class="shell-title">{{ title() }}</div>
        <div class="shell-right">
          <lb-connection-pill />
          <!-- Sign-out lives on every shell page so both roles can always
               leave. Hidden offline: signing out clears the cached session
               this device needs to keep working without connectivity. -->
          @if (connectivity.isOnline()) {
            <button type="button" class="sign-out" (click)="logout()" aria-label="Sign out" title="Sign out">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          }
        </div>
      </header>

      <main class="shell-main">
        <ng-content />
      </main>

      <nav class="bottom-nav" aria-label="Primary">
        <div class="bottom-nav-inner">
          @for (item of navItems(); track item.path) {
            <a
              [routerLink]="item.path"
              routerLinkActive="active"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
            >
              <span aria-hidden="true">{{ item.icon }}</span>
              {{ item.label }}
            </a>
          }
        </div>
      </nav>
    </div>
  `,
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly connectivity = inject(ConnectivityService);

  readonly title = input('');
  readonly variant = input<'learner' | 'parent'>('learner');
  /** Optional override; defaults to the learner nav set. */
  readonly navItems = input<{ path: string; label: string; icon: string; exact?: boolean }[]>([
    { path: '/learners', label: 'Home', icon: '🏠', exact: true },
    { path: '/avatar', label: 'Avatar', icon: '🎨' },
    { path: '/parent', label: 'Parents', icon: '👪' },
  ]);

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }
}
