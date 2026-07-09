import { Injectable, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ConnectivityService } from '../services/connectivity.service';
import { SyncApiService } from '../services/sync-api.service';
import { SyncBatchRequest, SyncBatchResponse, SyncStatus } from '../models/sync.models';
import { OfflineGoal, OfflineJourneyMemory, offlineDb } from './offline-db';

/**
 * Detects reconnect (via ConnectivityService's continuously-updated
 * isOnline signal, not navigator.onLine) and pushes every learner's queued
 * offline writes in one batch per learner, clearing pendingSync on
 * whatever the server returns as authoritative — win or lose the
 * last-write-wins comparison, the local copy is replaced, never merged.
 */
@Injectable({ providedIn: 'root' })
export class SyncManagerService {
  private readonly connectivityService = inject(ConnectivityService);
  private readonly syncApiService = inject(SyncApiService);

  readonly status = signal<SyncStatus>('idle');

  private wasOnline = this.connectivityService.isOnline();
  private syncInFlight = false;

  constructor() {
    if (this.wasOnline) {
      void this.runSync();
    }

    effect(() => {
      const online = this.connectivityService.isOnline();

      if (online && !this.wasOnline) {
        void this.runSync();
      } else if (!online) {
        this.status.set('offline');
      }

      this.wasOnline = online;
    });
  }

  private async runSync(): Promise<void> {
    if (this.syncInFlight) {
      return;
    }

    this.syncInFlight = true;
    this.status.set('syncing');

    try {
      const [pendingGoals, pendingMemories] = await Promise.all([
        offlineDb.goals.filter((g) => g.pendingSync).toArray(),
        offlineDb.journeyMemories.filter((m) => m.pendingSync).toArray(),
      ]);

      const learnerIds = new Set([
        ...pendingGoals.map((g) => g.learnerId),
        ...pendingMemories.map((m) => m.learnerId),
      ]);

      if (learnerIds.size === 0) {
        this.status.set('synced');
        return;
      }

      for (const learnerId of learnerIds) {
        await this.syncLearner(
          learnerId,
          pendingGoals.filter((g) => g.learnerId === learnerId),
          pendingMemories.filter((m) => m.learnerId === learnerId),
        );
      }

      this.status.set('synced');
    } catch {
      this.status.set('error');
    } finally {
      this.syncInFlight = false;
    }
  }

  private async syncLearner(
    learnerId: string,
    goals: OfflineGoal[],
    memories: OfflineJourneyMemory[],
  ): Promise<void> {
    const request: SyncBatchRequest = {
      learnerId,
      goals: goals.map((g) => ({
        id: g.id,
        title: g.title,
        description: g.description,
        status: g.status,
        updatedAt: g.updatedAt,
      })),
      journeyMemories: memories.map((m) => ({
        id: m.id,
        conversationSessionId: m.conversationSessionId,
        category: m.category,
        content: m.content,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    };

    const response = await firstValueFrom(this.syncApiService.syncBatch(request));

    await this.applyResolvedState(learnerId, response);
  }

  private async applyResolvedState(learnerId: string, response: SyncBatchResponse): Promise<void> {
    const resolvedGoals: OfflineGoal[] = response.goals.map((g) => ({
      id: g.id,
      learnerId,
      title: g.title,
      description: g.description,
      status: g.status,
      updatedAt: g.updatedAt,
      pendingSync: false,
    }));

    const resolvedMemories: OfflineJourneyMemory[] = response.journeyMemories.map((m) => ({
      id: m.id,
      learnerId,
      conversationSessionId: m.conversationSessionId,
      category: m.category,
      content: m.content,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      pendingSync: false,
    }));

    await Promise.all([offlineDb.goals.bulkPut(resolvedGoals), offlineDb.journeyMemories.bulkPut(resolvedMemories)]);
  }
}
