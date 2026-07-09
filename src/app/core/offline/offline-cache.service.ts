import { Injectable } from '@angular/core';
import { Goal } from '../models/journey.models';
import { LearnerResponse } from '../models/learner.models';
import { OfflineGoal, offlineDb } from './offline-db';

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
}
