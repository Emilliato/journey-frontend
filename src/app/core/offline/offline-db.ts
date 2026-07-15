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
  /** Serialized AvatarConfig JSON so the offline profile picker shows the child's avatar. */
  avatarConfig?: string | null;
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

/**
 * One chat bubble, persisted so a learner always continues from where
 * they left off — across page reloads, connectivity changes, and app
 * restarts. Chat text is conversation content, not a learner-linked
 * *server* table; it never syncs to the backend (goals/memories extracted
 * from it do, via their own pendingSync rows).
 */
export interface OfflineChatMessage {
  id: string;
  learnerId: string;
  role: 'learner' | 'journey';
  text: string;
  createdAt: string;
}

/**
 * A locally-verifiable login for offline continuation — CLAUDE.md
 * constraint 1 as amended 2026-07-15. Stores a PBKDF2 hash (never the
 * password) plus the last AuthResponse from a successful *online* login;
 * offline sign-in verifies against the hash and restores that session.
 */
export interface OfflineLogin {
  /** Lower-cased email (parent) or username (learner). */
  identifier: string;
  saltB64: string;
  hashB64: string;
  /** Serialized AuthResponse from the last successful online login. */
  sessionJson: string;
  updatedAt: string;
}

export class LearnBridgeOfflineDb extends Dexie {
  learnerProfiles!: Table<OfflineLearnerProfile, string>;
  goals!: Table<OfflineGoal, string>;
  journeyMemories!: Table<OfflineJourneyMemory, string>;
  chatMessages!: Table<OfflineChatMessage, string>;
  offlineLogins!: Table<OfflineLogin, string>;

  constructor() {
    super('LearnBridgeOffline');

    this.version(1).stores({
      learnerProfiles: 'id',
      goals: 'id, learnerId, pendingSync',
      journeyMemories: 'id, learnerId, pendingSync',
    });

    this.version(2).stores({
      learnerProfiles: 'id',
      goals: 'id, learnerId, pendingSync',
      journeyMemories: 'id, learnerId, pendingSync',
      chatMessages: 'id, learnerId, createdAt',
      offlineLogins: 'identifier',
    });
  }
}

export const offlineDb = new LearnBridgeOfflineDb();
