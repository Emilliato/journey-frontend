import { ChangeDetectionStrategy, Component } from '@angular/core';

interface ConfettiBit {
  dx: string;
  dy: string;
  delay: string;
  color: string;
}

const PALETTE = ['#F59E0B', '#FB7185', '#34D399', '#4338CA', '#A78BFA'];

/**
 * CSS/SVG-only confetti burst (goal celebrations). Mount it as a sibling of
 * the celebrating element; it animates once via the lb-confetti keyframes
 * and is torn down by the parent's @if.
 */
@Component({
  selector: 'lb-confetti',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lb-confetti burst" aria-hidden="true">
      @for (bit of bits; track $index) {
        <span
          [style.left]="'50%'"
          [style.top]="'40%'"
          [style.background]="bit.color"
          [style.--dx]="bit.dx"
          [style.--dy]="bit.dy"
          [style.animation-delay]="bit.delay"
        ></span>
      }
    </div>
  `,
  styles: `
    .burst {
      position: absolute;
      inset: 0;
      pointer-events: none;
    }
  `,
})
export class ConfettiComponent {
  protected readonly bits: ConfettiBit[] = Array.from({ length: 18 }, (_, i) => ({
    dx: `${(Math.random() - 0.5) * 160}px`,
    dy: `${-Math.random() * 140 - 20}px`,
    delay: `${i * 20}ms`,
    color: PALETTE[i % PALETTE.length],
  }));
}
