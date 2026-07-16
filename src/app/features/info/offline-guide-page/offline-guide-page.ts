import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { RouterLink } from '@angular/router';

/**
 * A parent-facing information page explaining how JOURNEY works offline —
 * the on-device model lifecycle, how a reply is produced, why the app stays
 * responsive, the consent/sync guarantees, and device requirements. Static
 * content, styled with the app's design tokens; reachable from the parent
 * dashboard and the profile picker.
 */
@Component({
  selector: 'app-offline-guide-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './offline-guide-page.html',
  styleUrl: './offline-guide-page.scss',
})
export class OfflineGuidePage {
  private readonly location = inject(Location);

  back(): void {
    // Prefer returning to wherever the parent came from; fall back to the picker.
    if (history.length > 1) {
      this.location.back();
    }
  }
}
