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
import { OfflinePersonaMemory } from '../../../core/offline/offline-persona';
import { MarkdownPipe } from '../../../shared/pipes/markdown.pipe';

/**
 * The JOURNEY chat surface. Online/offline mode is decided once, from the
 * real connectivity signal at page load (see ConnectivityService) — not
 * re-evaluated mid-conversation, so a session's history never mixes the
 * Claude Proxy and the local WebLLM model. Reconnect mid-session is Phase
 * 5's Sync Manager territory, not this page's job.
 */
@Component({
  selector: 'app-chat-page',
  imports: [ReactiveFormsModule, RouterLink, MarkdownPipe],
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

  // Offline-only: the learner's memory repository (from cache) that the
  // local persona recalls, and the cached consent flag that gates offline
  // writes. Unused in online mode, where the server handles both.
  private offlineMemories: OfflinePersonaMemory[] = [];
  readonly offlineConsentActive = signal(true);

  readonly isOnlineMode = signal(true);
  readonly learnerName = signal<string | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly goals = signal<Goal[]>([]);
  readonly isStarting = signal(true);

  // "Check offline readiness" button state — see checkOfflineReadiness().
  readonly isCheckingReadiness = signal(false);
  readonly offlineReady = signal(false);
  readonly readinessMessage = signal<string | null>(null);
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
    } else if (!this.offlineConsentActive()) {
      // Offline consent gate — refuse to chat or record without consent.
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

  /**
   * Explicitly verifies that offline mode will work on this device: probes
   * the GPU and loads the on-device model (downloading it if not yet
   * cached — so this doubles as a "prepare offline mode" action). The
   * result stays on screen so a parent can confirm readiness before the
   * learner goes somewhere without connectivity.
   */
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

  private initOnline(): void {
    // Warm the on-device model cache while we still have connectivity.
    // preload() was previously only called on the *offline* path — but a
    // device that has never cached the model can't download ~880 MB of
    // shards once it's actually offline, so first-ever offline use always
    // failed. Downloading during an online session means offline mode
    // starts from cache. Idempotent and background; no-op if unsupported
    // or already loaded.
    this.webLlmService.preload();

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

    // Cache the memory repository so the offline persona knows the learner
    // the same way the online system prompt does.
    this.journeyService.listMemories(this.learnerId).subscribe({
      next: (memories) => void this.offlineCache.cacheMemories(this.learnerId, memories),
      error: () => {
        /* Non-fatal — offline just falls back to a non-personalised persona. */
      },
    });

    this.journeyService.startSession(this.learnerId).subscribe({
      next: (session) => {
        this.sessionId = session.sessionId;
        this.isStarting.set(false);

        // JOURNEY opens the conversation — an introduction for a new
        // learner, a personalised welcome-back for a known one.
        if (session.greeting) {
          this.messages.update((current) => [...current, { role: 'journey', text: session.greeting }]);
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

  private async initOffline(): Promise<void> {
    const [profile, cachedGoals, cachedMemories] = await Promise.all([
      this.offlineCache.getCachedLearnerProfile(this.learnerId),
      this.offlineCache.getCachedGoals(this.learnerId),
      this.offlineCache.getCachedMemories(this.learnerId),
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

    // Offline consent gate, mirroring the online session start (which the
    // server rejects with 422 when consent isn't active). A cache with no
    // recorded consent is treated as not-granted — fail closed.
    this.offlineConsentActive.set(profile?.consentActive ?? false);

    // The repository the offline persona recalls from, ordered newest-first
    // like the online prompt.
    this.offlineMemories = cachedMemories
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((m) => ({ category: m.category, content: m.content }));

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

    // JOURNEY speaks first offline too — an instant, personalised greeting
    // built from cache with no model inference, so it appears immediately
    // even while the local model is still loading.
    this.messages.update((current) => [
      ...current,
      { role: 'journey', text: this.offlineJourneyService.greeting(this.learnerName(), this.offlineMemories) },
    ]);

    // Kick off the model load now, in the background, so it overlaps with
    // the learner reading the greeting and typing — the first real reply is
    // then much faster (the "fast, like online" part of the offline path).
    this.webLlmService.preload();
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
      const result = await this.offlineJourneyService.respond(
        this.learnerId,
        text,
        this.goals(),
        this.offlineMemories,
        this.offlineConsentActive(),
      );
      this.isSending.set(false);
      this.messages.update((current) => [...current, { role: 'journey', text: result.reply }]);

      if (result.goalWritten) {
        this.goals.update((current) => [result.goalWritten!, ...current]);
      }

      if (result.consentBlockedWrite) {
        this.errorMessage.set(
          "I couldn't save that — parental consent for this learner isn't active right now.",
        );
      }
    } catch (error) {
      this.isSending.set(false);
      // Include the underlying reason: offline failures happen on devices
      // (phones) where there's no console to inspect, and "could not
      // generate" alone is undiagnosable remotely.
      const detail =
        this.webLlmService.lastError() ??
        (error instanceof Error ? error.message : String(error));
      this.errorMessage.set(
        `JOURNEY could not generate an offline reply just now.${detail ? ` (${detail})` : ''}`,
      );
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
