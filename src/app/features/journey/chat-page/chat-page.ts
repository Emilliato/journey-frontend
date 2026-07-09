import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnerService } from '../../../core/services/learner.service';
import { JourneyService } from '../../../core/services/journey.service';
import { ChatMessage, Goal, GoalUpdate } from '../../../core/models/journey.models';

/**
 * The online JOURNEY chat surface — see PLAN.md Phase 3. Goal panel state
 * updates live from each message response's `goalUpdates`, no separate
 * polling: the backend returns them inline from the same tool calls that
 * wrote them (see JourneyConversationService on the backend).
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

  private readonly learnerId = this.route.snapshot.paramMap.get('learnerId')!;
  private sessionId: string | null = null;

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
    this.learnerService.getLearner(this.learnerId).subscribe({
      next: (learner) => this.learnerName.set(learner.displayName),
      error: () => this.learnerName.set(null),
    });

    this.journeyService.listGoals(this.learnerId).subscribe({
      next: (goals) => this.goals.set(goals),
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

  ngOnDestroy(): void {
    if (this.sessionId) {
      // Best-effort — the user is navigating away regardless.
      this.journeyService.completeSession(this.sessionId).subscribe({ error: () => {} });
    }
  }

  send(): void {
    if (this.form.invalid || this.isSending() || !this.sessionId) {
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

    this.journeyService.sendMessage(this.sessionId, text).subscribe({
      next: (response) => {
        this.isSending.set(false);
        this.messages.update((current) => [...current, { role: 'journey', text: response.reply }]);

        if (response.goalUpdates.length > 0) {
          this.goals.update((current) => this.mergeGoalUpdates(current, response.goalUpdates));
        }
      },
      error: () => {
        this.isSending.set(false);
        this.errorMessage.set('That message could not be sent. Please try again.');
      },
    });
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
