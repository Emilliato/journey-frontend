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
  /**
   * Cached from LearnerResponse.consentActive while online. The offline
   * consent gate (OfflineJourneyService) reads this to decide whether new
   * offline memories/goals may be written — the authoritative gate is still
   * server-side in SyncService, this just avoids queueing writes that would
   * be rejected on sync. Absent (older cache) is treated as not-granted.
   */
  consentActive: boolean;
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
