import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { LearnerService } from '../../../core/services/learner.service';
import { OfflineCacheService } from '../../../core/offline/offline-cache.service';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { AppShellComponent } from '../../../shared/ui/app-shell.component';
import {
  AVATAR_ACCESSORIES,
  AVATAR_EYES,
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_OUTFITS,
  AVATAR_SKINS,
  AvatarConfig,
  parseAvatarConfig,
  randomAvatarConfig,
} from '../../../shared/avatar/avatar-config';

const REACTIONS = ['Looking good! ✨', 'Ooh, that suits you!', 'Fresh vibes 🌟', 'Love it!', 'So YOU 💫'];

/**
 * The Avatar Studio: a joyful builder where the learner assembles their
 * companion from SVG layers. Save persists the config JSON to the backend
 * (and refreshes the offline cache) so it renders everywhere — home screen,
 * profile picker, parent dashboard — online and off.
 */
@Component({
  selector: 'app-avatar-studio-page',
  imports: [AvatarComponent, AppShellComponent],
  templateUrl: './avatar-studio-page.html',
  styleUrl: './avatar-studio-page.scss',
})
export class AvatarStudioPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly learnerService = inject(LearnerService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly connectivity = inject(ConnectivityService);

  protected readonly learnerId = this.route.snapshot.paramMap.get('learnerId')!;

  readonly config = signal<AvatarConfig>(parseAvatarConfig(null));
  readonly learnerName = signal<string | null>(null);
  readonly reaction = signal(REACTIONS[0]);
  readonly saveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Option palettes for the editors.
  protected readonly skins = AVATAR_SKINS;
  protected readonly hairs = AVATAR_HAIRS;
  protected readonly hairColors = AVATAR_HAIR_COLORS;
  protected readonly eyeStyles = AVATAR_EYES;
  protected readonly accessories = AVATAR_ACCESSORIES;
  protected readonly outfits = AVATAR_OUTFITS;

  readonly configJson = computed(() => JSON.stringify(this.config(), null, 2));

  readonly navItems = computed(() => [
    { path: `/learners/${this.learnerId}/journey`, label: 'Learn', icon: '🌟' },
    { path: `/learners/${this.learnerId}/avatar`, label: 'Avatar', icon: '🎨' },
    { path: `/learners/${this.learnerId}/dashboard`, label: 'Parents', icon: '👪' },
  ]);

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    const cached = await this.offlineCache.getCachedLearnerProfile(this.learnerId);
    if (cached) {
      this.learnerName.set(cached.displayName);
      this.config.set(parseAvatarConfig(cached.avatarConfig));
    }

    this.learnerService.getLearner(this.learnerId).subscribe({
      next: (learner) => {
        this.learnerName.set(learner.displayName);
        this.config.set(parseAvatarConfig(learner.avatarConfig));
        void this.offlineCache.cacheLearnerProfile(learner);
      },
      error: () => {
        /* Offline or unreachable — keep the cached config already shown. */
      },
    });
  }

  patch(patch: Partial<AvatarConfig>): void {
    this.config.update((c) => ({ ...c, ...patch }));
    this.reaction.set(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    if (this.saveState() === 'saved') {
      this.saveState.set('idle');
    }
  }

  randomise(): void {
    this.config.set(randomAvatarConfig());
    this.reaction.set(REACTIONS[Math.floor(Math.random() * REACTIONS.length)]);
    this.saveState.set('idle');
  }

  save(): void {
    if (!this.connectivity.isOnline()) {
      // Avatar save is a plain authenticated write with no offline queue;
      // saving needs connectivity. The preview stays as chosen.
      this.saveState.set('error');
      return;
    }

    const json = JSON.stringify(this.config());
    this.saveState.set('saving');

    this.learnerService.updateAvatar(this.learnerId, json).subscribe({
      next: (learner) => {
        this.saveState.set('saved');
        void this.offlineCache.cacheLearnerProfile(learner);
        setTimeout(() => {
          if (this.saveState() === 'saved') {
            this.saveState.set('idle');
          }
        }, 2000);
      },
      error: () => this.saveState.set('error'),
    });
  }
}
