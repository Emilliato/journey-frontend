import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { LearnerService } from '../../../core/services/learner.service';
import { JourneyService } from '../../../core/services/journey.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { OfflineCacheService } from '../../../core/offline/offline-cache.service';
import { OfflineJourneyService } from '../../../core/offline/offline-journey.service';
import { WebLlmService } from '../../../core/offline/webllm.service';
import { ChatMessage, Goal, GoalUpdate } from '../../../core/models/journey.models';
import { BrainSparkQuestion } from '../../../core/models/dashboard.models';
import { OfflinePersonaMemory } from '../../../core/offline/offline-persona';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { AppShellComponent } from '../../../shared/ui/app-shell.component';
import { ProgressRingComponent } from '../../../shared/ui/progress-ring.component';
import { BadgeIconComponent, BadgeKind } from '../../../shared/ui/badge-icon.component';
import { ConfettiComponent } from '../../../shared/ui/confetti.component';
import { AvatarConfig, AvatarState, parseAvatarConfig } from '../../../shared/avatar/avatar-config';

interface QuestBadge {
  name: string;
  icon: BadgeKind;
  earned: boolean;
}

/**
 * The JOURNEY Learner Home. Wraps the (unchanged) online/offline chat engine
 * in the investor-demo experience: an avatar companion whose expression
 * tracks chat state, a quest board built from the learner's goals, a
 * streak/badges strip, and Brain Sparks — quick preference questions that
 * teach JOURNEY how the child likes to learn (consent-gated, server-side).
 *
 * Online/offline mode is decided from the real connectivity signal at page
 * load AND re-evaluated live mid-conversation: losing the connection hands
 * the running chat to the on-device model; reconnecting starts a fresh
 * backend session and lets SyncManagerService push queued offline writes.
 */
@Component({
  selector: 'app-chat-page',
  imports: [
    ReactiveFormsModule,
    MarkdownPipe,
    AvatarComponent,
    AppShellComponent,
    ProgressRingComponent,
    BadgeIconComponent,
    ConfettiComponent,
  ],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
})
export class ChatPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly learnerService = inject(LearnerService);
  private readonly journeyService = inject(JourneyService);
  private readonly dashboardService = inject(DashboardService);
  private readonly connectivityService = inject(ConnectivityService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly offlineJourneyService = inject(OfflineJourneyService);
  protected readonly webLlmService = inject(WebLlmService);

  protected readonly learnerId = this.route.snapshot.paramMap.get('learnerId')!;
  private sessionId: string | null = null;

  private initialCheckDone = false;

  private offlineMemories: OfflinePersonaMemory[] = [];
  readonly offlineConsentActive = signal(true);

  readonly isOnlineMode = signal(true);
  readonly learnerName = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly goals = signal<Goal[]>([]);
  readonly isStarting = signal(true);

  readonly isCheckingReadiness = signal(false);
  readonly offlineReady = signal(false);
  readonly readinessMessage = signal<string | null>(null);
  readonly isSending = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // ---- Demo experience state ----
  readonly avatarConfig = signal<AvatarConfig>(parseAvatarConfig(null));
  readonly streakDays = signal(0);
  readonly celebrating = signal(false);

  private readonly brainSparks = signal<BrainSparkQuestion[]>([]);
  private readonly sparkIndex = signal(0);
  readonly sparkAnswered = signal(false);
  readonly sparkDismissed = signal(false);

  readonly currentSpark = computed<BrainSparkQuestion | null>(() => {
    const sparks = this.brainSparks();
    return sparks.length > 0 ? sparks[this.sparkIndex() % sparks.length] : null;
  });

  readonly showSpark = computed(
    () => !this.sparkDismissed() && this.currentSpark() !== null && this.offlineConsentActive(),
  );

  readonly avatarState = computed<AvatarState>(() => {
    if (this.isSending()) return 'thinking';
    if (this.celebrating()) return 'celebrating';
    if (!this.isOnlineMode()) return 'sleepy';
    return 'idle';
  });

  readonly themeColor = computed(() => this.avatarConfig().themeColor);
  readonly heroBackground = computed(
    () => `linear-gradient(135deg, ${this.themeColor()}18, var(--lb-paper) 55%)`,
  );

  readonly navItems = computed(() => [
    { path: `/learners/${this.learnerId}/journey`, label: 'Learn', icon: '🌟' },
    { path: `/learners/${this.learnerId}/avatar`, label: 'Avatar', icon: '🎨' },
    { path: `/learners/${this.learnerId}/dashboard`, label: 'Parents', icon: '👪' },
  ]);

  /** Badge shelf — earned state derived from streak and progress signals. */
  readonly badges = computed<QuestBadge[]>(() => {
    const completed = this.goals().filter((g) => g.status === 'Completed').length;
    const streak = this.streakDays();

    return [
      { name: 'First Goal', icon: 'star', earned: completed >= 1 },
      { name: '5 Sessions', icon: 'flame', earned: streak >= 5 },
      { name: 'Offline Explorer', icon: 'compass', earned: this.webLlmService.isReady() },
      { name: 'Curious Mind', icon: 'bulb', earned: this.sparkAnswered() },
      { name: 'Night Owl', icon: 'moon', earned: streak >= 7 },
      { name: 'Goal Getter', icon: 'rocket', earned: completed >= 3 },
    ];
  });

  readonly form = this.fb.group({
    message: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const online = this.connectivityService.isOnline();

      if (!this.initialCheckDone || online === this.isOnlineMode()) {
        return;
      }

      if (online) {
        this.resumeOnline();
      } else {
        void this.switchToOffline();
      }
    });
  }

  ngOnInit(): void {
    void this.init();
  }

  ngOnDestroy(): void {
    if (this.isOnlineMode() && this.sessionId) {
      this.journeyService.completeSession(this.sessionId).subscribe({ error: () => {} });
    }
  }

  private async init(): Promise<void> {
    const cachedChat = await this.offlineCache.getCachedChat(this.learnerId);

    if (cachedChat.length > 0) {
      this.messages.set(cachedChat.map((m) => ({ role: m.role, text: m.text })));
    }

    // Show the cached avatar immediately, before any network resolves.
    const cachedProfile = await this.offlineCache.getCachedLearnerProfile(this.learnerId);
    if (cachedProfile?.avatarConfig) {
      this.avatarConfig.set(parseAvatarConfig(cachedProfile.avatarConfig));
    }

    this.connectivityService.checkOnline().subscribe((online) => {
      this.isOnlineMode.set(online);
      this.initialCheckDone = true;

      if (online) {
        this.initOnline();
      } else {
        void this.initOffline();
      }
    });
  }

  send(): void {
    if (this.form.invalid || this.isSending()) {
      this.form.markAllAsTouched();
      return;
    }

    const text = this.form.getRawValue().message!.trim();
    if (!text) {
      return;
    }

    this.appendMessage('learner', text);
    this.form.reset();
    this.isSending.set(true);
    this.errorMessage.set(null);

    if (this.isOnlineMode() && this.sessionId) {
      this.sendOnline(text);
    } else if (!this.offlineConsentActive()) {
      this.isSending.set(false);
      this.errorMessage.set(
        'Parental consent for this learner is not active, so JOURNEY cannot chat or save anything.',
      );
    } else if (this.webLlmService.isSupported()) {
      void this.sendOffline(text);
    } else {
      this.isSending.set(false);
      this.errorMessage.set("JOURNEY can't generate replies offline on this device.");
    }
  }

  async checkOfflineReadiness(): Promise<void> {
    this.isCheckingReadiness.set(true);
    this.readinessMessage.set(null);

    const ready = await this.webLlmService.checkReadiness();

    this.isCheckingReadiness.set(false);
    this.offlineReady.set(ready);

    if (ready) {
      const gpuLabel =
        this.webLlmService.gpuStatus() === 'no-f16'
          ? 'GPU ready (compatibility mode)'
          : 'GPU ready';
      this.readinessMessage.set(
        `✓ ${gpuLabel} · ✓ Offline model loaded — JOURNEY can reply without internet.`,
      );
    } else {
      const reason = this.webLlmService.lastError() ?? 'This device does not support WebGPU.';
      this.readinessMessage.set(`✗ Offline mode is not ready: ${reason}`);
    }
  }

  // ---- Brain Sparks ----

  answerSpark(option: string): void {
    const spark = this.currentSpark();
    if (!spark || this.sparkAnswered()) {
      return;
    }

    this.sparkAnswered.set(true);

    // Online write only — offline Brain Spark answers would need their own
    // sync queue; keeping them online-only avoids silently dropping them.
    if (this.isOnlineMode()) {
      this.dashboardService.answerBrainSpark(this.learnerId, spark.id, option).subscribe({
        error: () => {
          /* Non-fatal for the demo — the celebratory copy still shows. */
        },
      });
    }
  }

  nextSpark(): void {
    this.sparkAnswered.set(false);
    this.sparkIndex.update((i) => i + 1);
  }

  dismissSpark(): void {
    this.sparkDismissed.set(true);
  }

  questTone(status: Goal['status']): 'indigo' | 'mint' | 'amber' {
    return status === 'Completed' ? 'mint' : status === 'Abandoned' ? 'amber' : 'indigo';
  }

  questLabel(status: Goal['status']): string {
    return status === 'Abandoned' ? 'Paused' : status;
  }

  questColor(status: Goal['status']): string {
    return status === 'Completed'
      ? 'var(--lb-mint)'
      : status === 'Abandoned'
        ? 'var(--lb-amber)'
        : 'var(--lb-indigo)';
  }

  questProgress(goal: Goal): number {
    return goal.status === 'Completed' ? 1 : goal.status === 'Abandoned' ? 0.2 : 0.5;
  }

  private appendMessage(role: 'learner' | 'journey', text: string): void {
    this.messages.update((current) => [...current, { role, text }]);
    void this.offlineCache.appendChatMessage(this.learnerId, role, text);
  }

  private initOnline(): void {
    this.webLlmService.preload();
    this.loadBrainSparks();
    this.loadDashboard();

    this.learnerService.getLearner(this.learnerId).subscribe({
      next: (learner) => {
        this.learnerName.set(learner.displayName);
        this.avatarConfig.set(parseAvatarConfig(learner.avatarConfig));
        void this.offlineCache.cacheLearnerProfile(learner);
      },
      error: () => this.learnerName.set(null),
    });

    this.journeyService.listGoals(this.learnerId).subscribe({
      next: (goals) => {
        this.goals.set(goals);
        void this.offlineCache.cacheGoals(this.learnerId, goals);
      },
      error: () => {},
    });

    this.journeyService.listMemories(this.learnerId).subscribe({
      next: (memories) => void this.offlineCache.cacheMemories(this.learnerId, memories),
      error: () => {},
    });

    this.journeyService.startSession(this.learnerId).subscribe({
      next: (session) => {
        this.sessionId = session.sessionId;
        this.isStarting.set(false);

        if (session.greeting && this.messages().length === 0) {
          this.appendMessage('journey', session.greeting);
        }
      },
      error: (error: HttpErrorResponse) => {
        this.isStarting.set(false);
        this.errorMessage.set(
          error.status === 422
            ? 'Parental consent for this learner is not active, so a JOURNEY session cannot start.'
            : 'Could not start a JOURNEY session right now. Please try again.',
        );
      },
    });
  }

  private loadBrainSparks(): void {
    this.dashboardService.listBrainSparks().subscribe({
      next: (sparks) => this.brainSparks.set(sparks),
      error: () => {},
    });
  }

  private loadDashboard(): void {
    this.dashboardService.getDashboard(this.learnerId).subscribe({
      next: (dashboard) => this.streakDays.set(dashboard.stats.streakDays),
      error: () => {},
    });
  }

  private async initOffline(): Promise<void> {
    await this.loadOfflineContext();

    this.isStarting.set(false);

    if (!this.offlineConsentActive()) {
      this.errorMessage.set(
        'Parental consent for this learner is not active, so JOURNEY cannot chat or save anything — online or offline.',
      );
      return;
    }

    if (!this.webLlmService.isSupported()) {
      this.errorMessage.set(
        "You're offline and this device doesn't support on-device AI, so JOURNEY can't chat right now — your saved goals are still shown below.",
      );
      return;
    }

    if (this.messages().length === 0) {
      this.appendMessage(
        'journey',
        this.offlineJourneyService.greeting(this.learnerName(), this.offlineMemories),
      );
    }

    this.webLlmService.preload();
  }

  private async loadOfflineContext(): Promise<void> {
    const [profile, cachedGoals, cachedMemories] = await Promise.all([
      this.offlineCache.getCachedLearnerProfile(this.learnerId),
      this.offlineCache.getCachedGoals(this.learnerId),
      this.offlineCache.getCachedMemories(this.learnerId),
    ]);

    this.learnerName.set(profile?.displayName ?? this.learnerName());

    if (profile?.avatarConfig) {
      this.avatarConfig.set(parseAvatarConfig(profile.avatarConfig));
    }

    this.goals.set(
      cachedGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        updatedAt: goal.updatedAt,
      })),
    );

    this.offlineConsentActive.set(profile?.consentActive ?? false);

    this.offlineMemories = cachedMemories
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((m) => ({ category: m.category, content: m.content }));
  }

  private async switchToOffline(): Promise<void> {
    this.isOnlineMode.set(false);
    this.sessionId = null;

    await this.loadOfflineContext();
    this.webLlmService.preload();
  }

  private resumeOnline(): void {
    this.isOnlineMode.set(true);
    this.errorMessage.set(null);

    this.journeyService.startSession(this.learnerId).subscribe({
      next: (session) => {
        this.sessionId = session.sessionId;
      },
      error: () => {},
    });
  }

  private sendOnline(text: string): void {
    this.journeyService.sendMessage(this.sessionId!, text).subscribe({
      next: (response) => {
        this.isSending.set(false);
        this.appendMessage('journey', response.reply);

        if (response.goalUpdates.length > 0) {
          const merged = this.mergeGoalUpdates(this.goals(), response.goalUpdates);
          this.goals.set(merged);
          void this.offlineCache.cacheGoals(this.learnerId, merged);
          this.celebrateIfCompleted(response.goalUpdates);
        }
      },
      error: () => {
        this.isSending.set(false);
        this.errorMessage.set('That message could not be sent. Please try again.');
      },
    });
  }

  private async sendOffline(text: string): Promise<void> {
    try {
      const history = this.messages()
        .slice(0, -1)
        .map((m) => ({
          role: m.role === 'learner' ? ('user' as const) : ('assistant' as const),
          content: m.text,
        }));

      const result = await this.offlineJourneyService.respond(
        this.learnerId,
        text,
        this.goals(),
        this.offlineMemories,
        this.offlineConsentActive(),
        history,
      );
      this.isSending.set(false);
      this.appendMessage('journey', result.reply);

      if (result.goalWritten) {
        this.goals.update((current) => [result.goalWritten!, ...current]);

        if (result.goalWritten.status === 'Completed') {
          this.triggerCelebration();
        }
      }

      if (result.consentBlockedWrite) {
        this.errorMessage.set(
          "I couldn't save that — parental consent for this learner isn't active right now.",
        );
      }
    } catch (error) {
      this.isSending.set(false);
      const detail =
        this.webLlmService.lastError() ??
        (error instanceof Error ? error.message : String(error));
      this.errorMessage.set(
        `JOURNEY could not generate an offline reply just now.${detail ? ` (${detail})` : ''}`,
      );
    }
  }

  private celebrateIfCompleted(updates: readonly GoalUpdate[]): void {
    if (updates.some((u) => u.status === 'Completed')) {
      this.triggerCelebration();
    }
  }

  private triggerCelebration(): void {
    this.celebrating.set(true);
    setTimeout(() => this.celebrating.set(false), 1400);
  }

  private mergeGoalUpdates(current: Goal[], updates: readonly GoalUpdate[]): Goal[] {
    const byId = new Map(current.map((goal) => [goal.id, goal]));
    const now = new Date().toISOString();

    for (const update of updates) {
      byId.set(update.id, {
        id: update.id,
        title: update.title,
        description: update.description,
        status: update.status,
        updatedAt: now,
      });
    }

    return Array.from(byId.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }
}
