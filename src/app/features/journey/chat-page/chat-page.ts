import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnerService } from '../../../core/services/learner.service';
import { JourneyService } from '../../../core/services/journey.service';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { OfflineCacheService } from '../../../core/offline/offline-cache.service';
import { OfflineJourneyService } from '../../../core/offline/offline-journey.service';
import { WebLlmService } from '../../../core/offline/webllm.service';
import { ChatMessage, Goal, GoalUpdate } from '../../../core/models/journey.models';

/**
 * The JOURNEY chat surface. Online/offline mode is decided once, from the
 * real connectivity signal at page load (see ConnectivityService) — not
 * re-evaluated mid-conversation, so a session's history never mixes the
 * Claude Proxy and the local WebLLM model. Reconnect mid-session is Phase
 * 5's Sync Manager territory, not this page's job.
 */
@Component({
  selector: 'app-chat-page',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.scss',
})
export class ChatPage implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly learnerService = inject(LearnerService);
  private readonly journeyService = inject(JourneyService);
  private readonly connectivityService = inject(ConnectivityService);
  private readonly offlineCache = inject(OfflineCacheService);
  private readonly offlineJourneyService = inject(OfflineJourneyService);
  protected readonly webLlmService = inject(WebLlmService);

  private readonly learnerId = this.route.snapshot.paramMap.get('learnerId')!;
  private sessionId: string | null = null;

  readonly isOnlineMode = signal(true);
  readonly learnerName = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly goals = signal<Goal[]>([]);
  readonly isStarting = signal(true);
  readonly isSending = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    message: ['', [Validators.required]],
  });

  ngOnInit(): void {
    // A one-shot real check here, not the continuously-updated isOnline
    // signal — on a fresh page load the signal's first health-check poll
    // hasn't resolved yet, so reading it synchronously would just be
    // reading its navigator.onLine-based initial value, the exact thing
    // this service exists to not rely on.
    this.connectivityService.checkOnline().subscribe((online) => {
      this.isOnlineMode.set(online);

      if (online) {
        this.initOnline();
      } else {
        void this.initOffline();
      }
    });
  }

  ngOnDestroy(): void {
    if (this.isOnlineMode() && this.sessionId) {
      // Best-effort — the user is navigating away regardless.
      this.journeyService.completeSession(this.sessionId).subscribe({ error: () => {} });
    }
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

    this.messages.update((current) => [...current, { role: 'learner', text }]);
    this.form.reset();
    this.isSending.set(true);
    this.errorMessage.set(null);

    if (this.isOnlineMode() && this.sessionId) {
      this.sendOnline(text);
    } else if (this.webLlmService.isSupported()) {
      void this.sendOffline(text);
    } else {
      this.isSending.set(false);
      this.errorMessage.set("JOURNEY can't generate replies offline on this device.");
    }
  }

  private initOnline(): void {
    this.learnerService.getLearner(this.learnerId).subscribe({
      next: (learner) => {
        this.learnerName.set(learner.displayName);
        void this.offlineCache.cacheLearnerProfile(learner);
      },
      error: () => this.learnerName.set(null),
    });

    this.journeyService.listGoals(this.learnerId).subscribe({
      next: (goals) => {
        this.goals.set(goals);
        void this.offlineCache.cacheGoals(this.learnerId, goals);
      },
      error: () => {
        /* Non-fatal — the goal panel just starts empty and still updates live. */
      },
    });

    this.journeyService.startSession(this.learnerId).subscribe({
      next: (session) => {
        this.sessionId = session.sessionId;
        this.isStarting.set(false);
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

  private async initOffline(): Promise<void> {
    const [profile, cachedGoals] = await Promise.all([
      this.offlineCache.getCachedLearnerProfile(this.learnerId),
      this.offlineCache.getCachedGoals(this.learnerId),
    ]);

    this.learnerName.set(profile?.displayName ?? null);
    this.goals.set(
      cachedGoals.map((goal) => ({
        id: goal.id,
        title: goal.title,
        description: goal.description,
        status: goal.status,
        updatedAt: goal.updatedAt,
      })),
    );
    this.isStarting.set(false);

    if (!this.webLlmService.isSupported()) {
      this.errorMessage.set(
        "You're offline and this device doesn't support on-device AI, so JOURNEY can't chat right now — your saved goals are still shown below.",
      );
    }
  }

  private sendOnline(text: string): void {
    this.journeyService.sendMessage(this.sessionId!, text).subscribe({
      next: (response) => {
        this.isSending.set(false);
        this.messages.update((current) => [...current, { role: 'journey', text: response.reply }]);

        if (response.goalUpdates.length > 0) {
          const merged = this.mergeGoalUpdates(this.goals(), response.goalUpdates);
          this.goals.set(merged);
          void this.offlineCache.cacheGoals(this.learnerId, merged);
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
      const result = await this.offlineJourneyService.respond(this.learnerId, text, this.goals());
      this.isSending.set(false);
      this.messages.update((current) => [...current, { role: 'journey', text: result.reply }]);

      if (result.goalWritten) {
        this.goals.update((current) => [result.goalWritten!, ...current]);
      }
    } catch {
      this.isSending.set(false);
      this.errorMessage.set('JOURNEY could not generate an offline reply just now.');
    }
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
