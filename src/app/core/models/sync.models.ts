export interface SyncGoalDto {
  id: string;
  title: string;
  description: string | null;
  status: 'Active' | 'Completed' | 'Abandoned';
  updatedAt: string;
}

export interface SyncJourneyMemoryDto {
  id: string;
  conversationSessionId: string | null;
  category: 'academic' | 'preference' | 'engagement' | 'goal_related';
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncBatchRequest {
  learnerId: string;
  goals: SyncGoalDto[];
  journeyMemories: SyncJourneyMemoryDto[];
}

export interface SyncBatchResponse {
  goals: SyncGoalDto[];
  journeyMemories: SyncJourneyMemoryDto[];
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
