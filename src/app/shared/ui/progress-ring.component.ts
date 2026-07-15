import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Inline-SVG progress ring for quest cards — no chart library. */
@Component({
  selector: 'lb-progress-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="ring"
      [style.width.px]="size()"
      [style.height.px]="size()"
    >
      <svg [attr.width]="size()" [attr.height]="size()" style="transform: rotate(-90deg)">
        <circle
          [attr.cx]="size() / 2"
          [attr.cy]="size() / 2"
          [attr.r]="radius()"
          [attr.stroke-width]="stroke()"
          stroke="var(--lb-line)"
          fill="none"
        />
        <circle
          [attr.cx]="size() / 2"
          [attr.cy]="size() / 2"
          [attr.r]="radius()"
          [attr.stroke-width]="stroke()"
          [attr.stroke]="color()"
          fill="none"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="offset()"
          stroke-linecap="round"
          style="transition: stroke-dashoffset 0.6s var(--lb-spring)"
        />
      </svg>
      <div class="ring-label"><ng-content /></div>
    </div>
  `,
  styles: `
    .ring {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .ring-label {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--lb-ink);
    }
  `,
})
export class ProgressRingComponent {
  /** 0..1 */
  readonly value = input(0);
  readonly size = input(56);
  readonly stroke = input(6);
  readonly color = input('var(--lb-indigo)');

  protected readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly offset = computed(
    () => this.circumference() - Math.min(Math.max(this.value(), 0), 1) * this.circumference(),
  );
}
