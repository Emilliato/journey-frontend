import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ConnectionPillComponent } from './connection-pill.component';

/**
 * The learner/parent chrome: brand header with a connection pill and a
 * floating bottom nav. `variant` swaps the body font (rounded display for
 * learners, clean sans for parents) and the nav items.
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
  readonly title = input('');
  readonly variant = input<'learner' | 'parent'>('learner');
  /** Optional override; defaults to the learner nav set. */
  readonly navItems = input<{ path: string; label: string; icon: string; exact?: boolean }[]>([
    { path: '/learners', label: 'Home', icon: '🏠', exact: true },
    { path: '/avatar', label: 'Avatar', icon: '🎨' },
    { path: '/parent', label: 'Parents', icon: '👪' },
  ]);
}
