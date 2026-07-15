import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type BadgeKind = 'star' | 'flame' | 'compass' | 'bulb' | 'moon' | 'rocket';

/** SVG achievement badge (rosette + glyph) for the learner badge shelf. */
@Component({
  selector: 'lb-badge-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      viewBox="0 0 48 48"
      [attr.width]="size()"
      [attr.height]="size()"
      [style.opacity]="earned() ? 1 : 0.45"
    >
      <path
        d="M24 3 L29 8 L36 6 L38 13 L45 16 L42 23 L45 30 L38 33 L36 40 L29 38 L24 43 L19 38 L12 40 L10 33 L3 30 L6 23 L3 16 L10 13 L12 6 L19 8 Z"
        [attr.fill]="earned() ? 'var(--lb-amber)' : 'var(--lb-line)'"
      />
      <circle cx="24" cy="23" r="10" fill="#fff" opacity="0.95" />
      <g
        transform="translate(24 23)"
        [attr.fill]="earned() ? 'var(--lb-indigo)' : 'var(--lb-ink-soft)'"
        [attr.stroke]="earned() ? 'var(--lb-indigo)' : 'var(--lb-ink-soft)'"
        stroke-width="0"
      >
        @switch (kind()) {
          @case ('star') {
            <path d="M0 -6 L1.8 -1.8 L6 -1.8 L2.4 1.1 L3.8 6 L0 3.2 L-3.8 6 L-2.4 1.1 L-6 -1.8 L-1.8 -1.8 Z" />
          }
          @case ('flame') {
            <path d="M0 -6 Q3 -2 3 1 Q3 5 0 6 Q-3 5 -3 1 Q-3 -2 0 -6 Z" />
          }
          @case ('compass') {
            <circle r="6" fill="none" stroke-width="1.5" />
            <path d="M0 -4 L2 0 L0 4 L-2 0 Z" />
          }
          @case ('bulb') {
            <circle cy="-1" r="4" />
            <rect x="-2" y="3" width="4" height="2.5" rx="1" />
          }
          @case ('moon') {
            <path d="M3 -5 A6 6 0 1 0 3 5 A5 5 0 1 1 3 -5 Z" />
          }
          @case ('rocket') {
            <path d="M0 -6 Q3 -3 3 2 L1.5 4 L-1.5 4 L-3 2 Q-3 -3 0 -6 Z" />
          }
        }
      </g>
    </svg>
  `,
})
export class BadgeIconComponent {
  readonly kind = input<BadgeKind>('star');
  readonly earned = input(true);
  readonly size = input(44);
}
