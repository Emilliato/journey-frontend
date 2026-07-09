import { Injectable } from '@angular/core';
import { Goal } from '../models/journey.models';
import { offlineDb } from './offline-db';
import { WebLlmService } from './webllm.service';

const GOAL_KEYWORD = /\bgoal\b/i;
const MEMORY_KEYWORDS = /\b(like|love|enjoy|favorite|favourite)\b/i;

export interface OfflineJourneyResult {
  reply: string;
  goalWritten: Goal | null;
  memoryWritten: boolean;
}

/**
 * The offline counterpart to the backend's JourneyConversationService +
 * JourneyToolExecutor — much simpler by design (see offline-persona.ts):
 * a plain keyword match instead of a real tool-call loop, since the local
 * model isn't expected to do reliable tool use. Writes go straight to
 * Dexie flagged pendingSync for SyncManagerService to reconcile once back
 * online; there is no server round-trip here at all.
 */
@Injectable({ providedIn: 'root' })
export class OfflineJourneyService {
  constructor(private readonly webLlmService: WebLlmService) {}

  async respond(learnerId: string, message: string, cachedGoals: readonly Goal[]): Promise<OfflineJourneyResult> {
    const reply = await this.webLlmService.generateReply(
      message,
      cachedGoals.map((goal) => goal.title),
    );

    let goalWritten: Goal | null = null;
    let memoryWritten = false;

    if (GOAL_KEYWORD.test(message)) {
      goalWritten = await this.writeGoal(learnerId, message);
    } else if (MEMORY_KEYWORDS.test(message)) {
      memoryWritten = await this.writeMemory(learnerId, message);
    }

    return { reply, goalWritten, memoryWritten };
  }

  private async writeGoal(learnerId: string, message: string): Promise<Goal> {
    const now = new Date().toISOString();
    const goal = {
      id: crypto.randomUUID(),
      learnerId,
      title: message.slice(0, 80),
      description: null,
      status: 'Active' as const,
      updatedAt: now,
      pendingSync: true,
    };

    await offlineDb.goals.put(goal);

    return { id: goal.id, title: goal.title, description: goal.description, status: goal.status, updatedAt: goal.updatedAt };
  }

  private async writeMemory(learnerId: string, message: string): Promise<boolean> {
    const now = new Date().toISOString();

    await offlineDb.journeyMemories.put({
      id: crypto.randomUUID(),
      learnerId,
      conversationSessionId: null,
      category: 'preference',
      content: message.slice(0, 500),
      createdAt: now,
      updatedAt: now,
      pendingSync: true,
    });

    return true;
  }
}
