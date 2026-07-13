import { Injectable } from '@angular/core';
import { Goal, JourneyMemory } from '../models/journey.models';
import { LearnerResponse } from '../models/learner.models';
import { OfflineGoal, OfflineJourneyMemory, offlineDb } from './offline-db';

/**
 * Populated while online so there's something real for the offline WebLLM
 * persona to recall from — see ChatPage, which caches on every successful
 * online load/response.
 */
@Injectable({ providedIn: 'root' })
export class OfflineCacheService {
  async cacheLearnerProfile(learner: LearnerResponse): Promise<void> {
    await offlineDb.learnerProfiles.put({
      id: learner.id,
      displayName: learner.displayName,
      consentActive: learner.consentActive,
      cachedAt: new Date().toISOString(),
    });
  }

  async getCachedLearnerProfile(learnerId: string) {
    return offlineDb.learnerProfiles.get(learnerId);
  }

  async cacheGoals(learnerId: string, goals: readonly Goal[]): Promise<void> {
    const rows: OfflineGoal[] = goals.map((goal) => ({
      id: goal.id,
      learnerId,
      title: goal.title,
      description: goal.description,
      status: goal.status,
      updatedAt: goal.updatedAt,
      pendingSync: false,
    }));

    await offlineDb.goals.where('learnerId').equals(learnerId).delete();
    await offlineDb.goals.bulkPut(rows);
  }

  async getCachedGoals(learnerId: string): Promise<OfflineGoal[]> {
    return offlineDb.goals.where('learnerId').equals(learnerId).toArray();
  }

  /**
   * Caches the learner's memory repository for the offline persona. Only
   * server-authoritative rows are replaced — memories written offline and
   * not yet synced (pendingSync) are preserved, so a mid-sync refresh never
   * drops a queued write.
   */
  async cacheMemories(learnerId: string, memories: readonly JourneyMemory[]): Promise<void> {
    const rows: OfflineJourneyMemory[] = memories.map((memory) => ({
      id: memory.id,
      learnerId,
      conversationSessionId: memory.conversationSessionId,
      category: memory.category,
      content: memory.content,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
      pendingSync: false,
    }));

    await offlineDb.journeyMemories
      .where('learnerId')
      .equals(learnerId)
      .and((m) => !m.pendingSync)
      .delete();
    await offlineDb.journeyMemories.bulkPut(rows);
  }

  async getCachedMemories(learnerId: string): Promise<OfflineJourneyMemory[]> {
    return offlineDb.journeyMemories.where('learnerId').equals(learnerId).toArray();
  }
}
