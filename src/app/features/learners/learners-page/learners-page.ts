import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LearnerService } from '../../../core/services/learner.service';
import { OfflineCacheService } from '../../../core/offline/offline-cache.service';
import { LearnerResponse } from '../../../core/models/learner.models';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { ConnectionPillComponent } from '../../../shared/ui/connection-pill.component';
import { AvatarConfig, parseAvatarConfig } from '../../../shared/avatar/avatar-config';

interface PickerLearner {
  id: string;
  displayName: string;
  consentActive: boolean;
  avatar: AvatarConfig;
}

/**
 * The "who's learning today?" profile picker. Parents see and manage
 * every child; a learner account skips this page entirely (login routes
 * them straight to their home, and deep links redirect below). With no
 * connection the picker falls back to the profiles cached on this device,
 * so switching children still works offline.
 */
@Component({
  selector: 'app-learners-page',
  imports: [RouterLink, AvatarComponent, ConnectionPillComponent],
  templateUrl: './learners-page.html',
  styleUrl: './learners-page.scss',
})
export class LearnersPage implements OnInit {
  private readonly learnerService = inject(LearnerService);
  private readonly authService = inject(AuthService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly router = inject(Router);

  readonly learners = signal<LearnerResponse[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly isOfflineList = signal(false);

  /** View model: parsed avatar config alongside each learner. */
  readonly pickerLearners = computed<PickerLearner[]>(() =>
    this.learners().map((l) => ({
      id: l.id,
      displayName: l.displayName,
      consentActive: l.consentActive,
      avatar: parseAvatarConfig(l.avatarConfig),
    })),
  );

  ngOnInit(): void {
    // A learner account has exactly one profile — theirs. No picker.
    const session = this.authService.currentSession();

    if (session?.role === 'Learner' && session.learnerId) {
      void this.router.navigate(['/learners', session.learnerId, 'journey']);
      return;
    }

    this.learnerService.listLearners().subscribe({
      next: (learners) => {
        this.learners.set(learners);
        this.isLoading.set(false);

        // Keep the offline picker's data fresh for the next time this
        // device has no connection.
        for (const learner of learners) {
          void this.offlineCache.cacheLearnerProfile(learner);
        }
      },
      error: () => void this.loadFromCache(),
    });
  }

  logout(): void {
    this.authService.logout();
    void this.router.navigateByUrl('/login');
  }

  /**
   * API unreachable (offline or backend down): show the profiles this
   * device has cached so a child can still be picked and chat offline.
   */
  private async loadFromCache(): Promise<void> {
    const cached = await this.offlineCache.getAllCachedLearnerProfiles();

    if (cached.length === 0) {
      this.errorMessage.set(
        'Could not load your children right now, and none are saved on this device yet.',
      );
      this.isLoading.set(false);
      return;
    }

    this.learners.set(
      cached.map((profile) => ({
        id: profile.id,
        displayName: profile.displayName,
        createdAt: profile.cachedAt,
        consentActive: profile.consentActive,
        avatarConfig: profile.avatarConfig ?? null,
      })),
    );
    this.isOfflineList.set(true);
    this.isLoading.set(false);
  }
}
