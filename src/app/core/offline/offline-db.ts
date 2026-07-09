import Dexie, { Table } from 'dexie';

/**
 * Mirrors the backend entities relevant to offline use (see
 * docs/ARCHITECTURE.md's data model). `pendingSync` marks rows written
 * offline (see OfflineJourneyService) that SyncManagerService still needs
 * to reconcile with the server; cleared once a sync batch resolves them.
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
