import { Injectable } from '@angular/core';
import { Goal } from '../models/journey.models';
import { findRelevantNotes } from './content-pack';
import { OfflinePersonaMemory, buildOfflineGreeting } from './offline-persona';
import { OfflineJourneyMemory, offlineDb } from './offline-db';
import { OfflineChatTurn, WebLlmService } from './webllm.service';

const GOAL_KEYWORD = /\bgoal\b/i;
const MEMORY_KEYWORDS = /\b(like|love|enjoy|favorite|favourite)\b/i;

export interface OfflineJourneyResult {
  reply: string;
  goalWritten: Goal | null;
  memoryWritten: boolean;
  /**
   * True when JOURNEY would have saved something but consent isn't active,
   * so the write was skipped. Lets the UI explain why nothing was recorded.
   */
  consentBlockedWrite: boolean;
}

/**
 * The offline counterpart to the backend's JourneyConversationService +
 * JourneyToolExecutor — much simpler by design (see offline-persona.ts):
 * a plain keyword match instead of a real tool-call loop, since the local
 * model isn't expected to do reliable tool use. Writes go straight to
 * Dexie flagged pendingSync for SyncManagerService to reconcile once back
 * online; there is no server round-trip here at all.
 *
 * Consent: writes are gated on the cached consent flag (constraint 2). This
 * is a client-side convenience gate — it stops JOURNEY from queueing rows
 * that the server would reject anyway. The authoritative gate is still
 * server-side in SyncService, which re-checks consent on every sync batch.
 */
@Injectable({ providedIn: 'root' })
export class OfflineJourneyService {
  constructor(private readonly webLlmService: WebLlmService) {}

  /**
   * The instant, personalised opening message for an offline session —
   * built from cache, no model inference, so it shows immediately.
   */
  greeting(learnerName: string | null, memories: readonly OfflinePersonaMemory[]): string {
    return buildOfflineGreeting(learnerName, memories);
  }

  async respond(
    learnerId: string,
    message: string,
    cachedGoals: readonly Goal[],
    memories: readonly OfflinePersonaMemory[] = [],
    consentActive = true,
    history: readonly OfflineChatTurn[] = [],
    onToken?: (delta: string) => void,
  ): Promise<OfflineJourneyResult> {
    // Ground the local model in the bundled content pack: pull the notes
    // most relevant to this message and pass them as reference context.
    const referenceNotes = findRelevantNotes(message);

    const reply = await this.webLlmService.generateReply(
      message,
      cachedGoals.map((goal) => goal.title),
      memories,
      referenceNotes,
      history,
      onToken,
    );

    let goalWritten: Goal | null = null;
    let memoryWritten = false;
    let consentBlockedWrite = false;

    const wantsGoalWrite = GOAL_KEYWORD.test(message);
    const wantsMemoryWrite = !wantsGoalWrite && MEMORY_KEYWORDS.test(message);

    if (wantsGoalWrite || wantsMemoryWrite) {
      if (!consentActive) {
        // Consent gate: never persist a learner-linked row without active
        // consent — not even to the offline queue.
        consentBlockedWrite = true;
      } else if (wantsGoalWrite) {
        goalWritten = await this.writeGoal(learnerId, message);
      } else {
        memoryWritten = await this.writeMemory(learnerId, message);
      }
    }

    return { reply, goalWritten, memoryWritten, consentBlockedWrite };
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

    const memory: OfflineJourneyMemory = {
      id: crypto.randomUUID(),
      learnerId,
      conversationSessionId: null,
      category: 'preference',
      content: message.slice(0, 500),
      createdAt: now,
      updatedAt: now,
      pendingSync: true,
    };

    await offlineDb.journeyMemories.put(memory);

    return true;
  }
}
