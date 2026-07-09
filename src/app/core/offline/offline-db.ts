import Dexie, { Table } from 'dexie';

/**
 * Mirrors the backend entities relevant to offline use (see
 * docs/ARCHITECTURE.md's data model). `pendingSync` exists on the two
 * writable tables now so the schema is ready for Phase 5 (the sync API and
 * Angular Sync Manager) — nothing in Phase 4 sets it to true yet, since the
 * offline WebLLM persona is scoped to read-only recall/encouragement, not
 * tool use (see OFFLINE_SYSTEM_PROMPT).
 */
export interface OfflineLearnerProfile {
  id: string; // learnerId
  displayName: string;
  cachedAt: string;
}

export interface OfflineGoal {
  id: string;
  learnerId: string;
  title: string;
  description: string | null;
  status: 'Active' | 'Completed' | 'Abandoned';
  updatedAt: string;
  pendingSync: boolean;
}

export interface OfflineJourneyMemory {
  id: string;
  learnerId: string;
  conversationSessionId: string | null;
  category: 'academic' | 'preference' | 'engagement' | 'goal_related';
  content: string;
  createdAt: string;
  updatedAt: string;
  pendingSync: boolean;
}

export class LearnBridgeOfflineDb extends Dexie {
  learnerProfiles!: Table<OfflineLearnerProfile, string>;
  goals!: Table<OfflineGoal, string>;
  journeyMemories!: Table<OfflineJourneyMemory, string>;

  constructor() {
    super('LearnBridgeOffline');

    this.version(1).stores({
      learnerProfiles: 'id',
      goals: 'id, learnerId, pendingSync',
      journeyMemories: 'id, learnerId, pendingSync',
    });
  }
}

export const offlineDb = new LearnBridgeOfflineDb();
