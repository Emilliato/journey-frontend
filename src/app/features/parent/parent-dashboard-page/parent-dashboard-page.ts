import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LearnerService } from '../../../core/services/learner.service';
import { JourneyService } from '../../../core/services/journey.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import { LearnerResponse } from '../../../core/models/learner.models';
import { JourneyMemory, JourneyMemoryCategory } from '../../../core/models/journey.models';
import { DashboardStats, TimelineEvent } from '../../../core/models/dashboard.models';
import { AppShellComponent } from '../../../shared/ui/app-shell.component';
import { AvatarComponent } from '../../../shared/avatar/avatar.component';
import { SparklineComponent } from '../../../shared/ui/sparkline.component';
import { AvatarConfig, parseAvatarConfig } from '../../../shared/avatar/avatar-config';

interface StatTile {
  label: string;
  value: string;
  series: number[];
  color: string;
}

interface MemoryGroup {
  category: JourneyMemoryCategory;
  label: string;
  tone: 'indigo' | 'coral' | 'amber' | 'mint';
  items: JourneyMemory[];
}

const CATEGORY_META: Record<
  JourneyMemoryCategory,
  { label: string; tone: 'indigo' | 'coral' | 'amber' | 'mint' }
> = {
  academic: { label: 'Academic', tone: 'indigo' },
  preference: { label: 'Preference', tone: 'coral' },
  engagement: { label: 'Engagement', tone: 'amber' },
  goal_related: { label: 'Goal-related', tone: 'mint' },
};

/**
 * Parent Dashboard: progress at a glance, the reviewable memory repository
 * (four fixed categories, with per-item removal), an activity timeline, and
 * the family/devices panel with the consent toggle. Every panel reads
 * server data through learner-scoped, audited endpoints.
 */
@Component({
  selector: 'app-parent-dashboard-page',
  imports: [AppShellComponent, AvatarComponent, SparklineComponent, DatePipe, RouterLink],
  templateUrl: './parent-dashboard-page.html',
  styleUrl: './parent-dashboard-page.scss',
})
export class ParentDashboardPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly learnerService = inject(LearnerService);
  private readonly journeyService = inject(JourneyService);
  private readonly dashboardService = inject(DashboardService);

  protected readonly learnerId = this.route.snapshot.paramMap.get('learnerId')!;

  readonly learner = signal<LearnerResponse | null>(null);
  readonly stats = signal<DashboardStats | null>(null);
  readonly timeline = signal<TimelineEvent[]>([]);
  readonly memories = signal<JourneyMemory[]>([]);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly confirmRevoke = signal(false);

  readonly avatar = computed<AvatarConfig>(() => parseAvatarConfig(this.learner()?.avatarConfig));

  readonly navItems = computed(() => [
    { path: `/learners/${this.learnerId}/dashboard`, label: 'Home', icon: '🏠', exact: true },
    { path: `/learners/${this.learnerId}/journey`, label: 'Learner', icon: '🌟' },
    { path: `/learners/${this.learnerId}/avatar`, label: 'Avatar', icon: '🎨' },
  ]);

  readonly tiles = computed<StatTile[]>(() => {
    const s = this.stats();
    if (!s) {
      return [];
    }

    return [
      { label: 'Current streak', value: `${s.streakDays}d`, series: s.sessionsPerDay, color: 'var(--lb-coral)' },
      { label: 'Sessions (7d)', value: `${s.sessionsLast7Days}`, series: s.sessionsPerDay, color: 'var(--lb-indigo)' },
      { label: 'Active goals', value: `${s.activeGoals}`, series: s.goalsCompletedPerWeek.slice(-7), color: 'var(--lb-amber)' },
      { label: 'Completed', value: `${s.completedGoals}`, series: s.goalsCompletedPerWeek.slice(-7), color: 'var(--lb-mint)' },
      { label: 'Learning minutes', value: `${s.learningMinutesLast7Days}`, series: s.minutesPerDay, color: 'var(--lb-indigo)' },
    ];
  });

  readonly memoryGroups = computed<MemoryGroup[]>(() => {
    const all = this.memories();
    return (['academic', 'preference', 'engagement', 'goal_related'] as JourneyMemoryCategory[]).map(
      (category) => ({
        category,
        label: CATEGORY_META[category].label,
        tone: CATEGORY_META[category].tone,
        items: all.filter((m) => m.category === category),
      }),
    );
  });

  /** Topics chart, derived from the memory category mix (server aggregate). */
  readonly topics = computed(() => {
    const counts = this.stats()?.memoryCategoryCounts ?? [];
    const max = Math.max(...counts.map((c) => c.count), 1);
    return counts.map((c) => ({
      label: CATEGORY_META[c.category].label,
      value: c.count,
      pct: (c.count / max) * 100,
    }));
  });

  readonly areaPath = computed(() => this.buildAreaPath(this.stats()?.goalsCompletedPerWeek ?? []));
  readonly linePath = computed(() => this.buildLinePath(this.stats()?.goalsCompletedPerWeek ?? []));

  ngOnInit(): void {
    this.learnerService.getLearner(this.learnerId).subscribe({
      next: (learner) => this.learner.set(learner),
      error: () => {},
    });

    this.dashboardService.getDashboard(this.learnerId).subscribe({
      next: (dashboard) => {
        this.stats.set(dashboard.stats);
        this.timeline.set(dashboard.timeline);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load the dashboard right now.');
        this.isLoading.set(false);
      },
    });

    this.journeyService.listMemories(this.learnerId).subscribe({
      next: (memories) => this.memories.set(memories),
      error: () => {},
    });
  }

  removeMemory(memoryId: string): void {
    const previous = this.memories();
    // Optimistic — the card is gone immediately; restore on failure.
    this.memories.set(previous.filter((m) => m.id !== memoryId));

    this.dashboardService.deleteMemory(this.learnerId, memoryId).subscribe({
      error: () => this.memories.set(previous),
    });
  }

  toggleConsent(): void {
    const learner = this.learner();
    if (!learner) {
      return;
    }

    if (learner.consentActive) {
      // Revoking is serious — confirm first.
      this.confirmRevoke.set(true);
    } else {
      this.setConsent(true);
    }
  }

  confirmRevokeConsent(): void {
    this.confirmRevoke.set(false);
    this.setConsent(false);
  }

  cancelRevoke(): void {
    this.confirmRevoke.set(false);
  }

  private setConsent(active: boolean): void {
    const learner = this.learner();
    if (!learner) {
      return;
    }

    this.learner.set({ ...learner, consentActive: active });

    this.learnerService.setConsent(this.learnerId, active).subscribe({
      next: (updated) => this.learner.set(updated),
      error: () => this.learner.set(learner),
    });
  }

  timelineColor(kind: TimelineEvent['kind']): string {
    switch (kind) {
      case 'goal':
        return 'var(--lb-mint)';
      case 'sync':
        return 'var(--lb-indigo)';
      case 'spark':
        return 'var(--lb-amber)';
      default:
        return 'var(--lb-coral)';
    }
  }

  timelineIcon(kind: TimelineEvent['kind']): string {
    switch (kind) {
      case 'goal':
        return '🏆';
      case 'sync':
        return '🔄';
      case 'spark':
        return '✨';
      default:
        return '💬';
    }
  }

  private buildLinePath(data: number[]): string {
    if (data.length === 0) {
      return 'M 0 116';
    }
    const w = 320;
    const h = 120;
    const max = Math.max(...data, 1);
    const step = w / Math.max(data.length - 1, 1);
    const pts = data.map((v, i) => `${i * step},${h - (v / max) * (h - 10) - 4}`);
    return `M ${pts.join(' L ')}`;
  }

  private buildAreaPath(data: number[]): string {
    if (data.length === 0) {
      return '';
    }
    return `${this.buildLinePath(data)} L 320,120 L 0,120 Z`;
  }
}
