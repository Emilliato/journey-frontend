export interface CategoryCount {
  category: 'academic' | 'preference' | 'engagement' | 'goal_related';
  count: number;
}

export interface DashboardStats {
  streakDays: number;
  sessionsLast7Days: number;
  learningMinutesLast7Days: number;
  activeGoals: number;
  completedGoals: number;
  sessionsPerDay: number[];
  minutesPerDay: number[];
  goalsCompletedPerWeek: number[];
  memoryCategoryCounts: CategoryCount[];
  offlineSessions: number;
}

export interface TimelineEvent {
  kind: 'session' | 'goal' | 'spark' | 'sync';
  title: string;
  detail: string | null;
  at: string;
}

export interface DashboardResponse {
  stats: DashboardStats;
  timeline: TimelineEvent[];
}

export interface BrainSparkQuestion {
  id: string;
  kind: 'this_or_that' | 'would_you_rather' | 'poll';
  prompt: string;
  options: string[];
  category: 'preference' | 'engagement';
}

export interface BrainSparkAnswerResponse {
  id: string;
  category: 'preference' | 'engagement';
  content: string;
  createdAt: string;
}
