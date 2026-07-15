import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Tiny inline-SVG sparkline for stat tiles — no chart library. */
@Component({
  selector: 'lb-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      [attr.width]="width()"
      [attr.height]="height()"
      [attr.viewBox]="'0 0 ' + width() + ' ' + height()"
      style="overflow: visible"
    >
      <path [attr.d]="areaPath()" [attr.fill]="color()" opacity="0.12" />
      <path
        [attr.d]="linePath()"
        fill="none"
        [attr.stroke]="color()"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
})
export class SparklineComponent {
  readonly data = input<readonly number[]>([]);
  readonly color = input('var(--lb-indigo)');
  readonly width = input(96);
  readonly height = input(32);

  private readonly points = computed(() => {
    const data = this.data();
    const w = this.width();
    const h = this.height();

    if (data.length === 0) {
      return [`0,${h - 2}`, `${w},${h - 2}`];
    }

    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = Math.max(max - min, 1);
    const step = w / Math.max(data.length - 1, 1);

    return data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`);
  });

  protected readonly linePath = computed(() => `M ${this.points().join(' L ')}`);
  protected readonly areaPath = computed(
    () => `${this.linePath()} L ${this.width()},${this.height()} L 0,${this.height()} Z`,
  );
}
