import { JourneyMemoryCategory } from '../models/journey.models';
import { ContentNote } from './content-pack';

/** A cached memory, trimmed to what the offline persona needs. */
export interface OfflinePersonaMemory {
  category: JourneyMemoryCategory;
  content: string;
}

/**
 * The offline JOURNEY persona — deliberately short and directive, unlike
 * the fuller online system prompt (see JourneyPersona on the backend).
 * Small quantized local models follow nuanced multi-part instructions worse
 * than Claude, so this is scoped tightly to encouragement, goal recall, and
 * simple cached-content Q&A rather than open-ended coaching — see
 * docs/ARCHITECTURE.md.
 */
const OFFLINE_BASE_PROMPT = `You are JOURNEY, currently offline.
Be brief, warm, and encouraging — 1 to 3 short sentences per reply.
You have a small built-in library of school-topic notes; when relevant notes
are provided below, use them to help explain things accurately. You can also
remind the learner of their saved goals and use what you already know about
them. If a question needs something beyond your notes, say you'll be able to
help more once back online — don't make facts up.
Write maths in plain text (like 1/4 or 3 x 4 = 12), never LaTeX.
Never discuss health, feelings, mood, or family — redirect to learning.`;

// Backwards-compatible export for the no-memory case (used by tests/specs).
export const OFFLINE_SYSTEM_PROMPT = OFFLINE_BASE_PROMPT;

/**
 * Builds the offline system prompt, injecting the cached memory repository
 * so the local model has the same personalised context the online prompt
 * gets. Capped to keep the prompt small and fast for the local model.
 */
export function buildOfflineSystemPrompt(
  memories: readonly OfflinePersonaMemory[],
  referenceNotes: readonly ContentNote[] = [],
): string {
  let prompt = OFFLINE_BASE_PROMPT;

  if (referenceNotes.length > 0) {
    const notes = referenceNotes.map((n) => `- ${n.title}: ${n.body}`).join('\n');
    prompt += `

Reference notes relevant to what the learner just asked (use these to answer accurately):
${notes}`;
  }

  if (memories.length > 0) {
    const lines = memories
      .slice(0, 20)
      .map((m) => `- (${formatCategory(m.category)}) ${m.content}`)
      .join('\n');
    prompt += `

What you already know about this learner from earlier chats:
${lines}

Use what you know to keep replies personal, but don't recite the list.`;
  }

  return prompt;
}

/**
 * An instant, template-built opening message — no model inference, so it
 * shows the moment the offline chat opens (the local model can take a while
 * to load). This is what keeps the offline experience feeling as immediate
 * as the online greeting.
 */
export function buildOfflineGreeting(
  learnerName: string | null,
  memories: readonly OfflinePersonaMemory[],
): string {
  const name = learnerName?.trim() || 'there';

  if (memories.length === 0) {
    return (
      `Hi ${name}! I'm **JOURNEY**. We're offline right now, so I'm running ` +
      `on this device — I can cheer you on and help you go over what you already know. ` +
      `What would you like to work on?`
    );
  }

  const goalRelated = memories.find((m) => m.category === 'goal_related');
  const recall = goalRelated ?? memories[0];

  return (
    `Welcome back, ${name}! We're offline, but I still remember what we've been up to — ` +
    `like **${trimForGreeting(recall.content)}**. Want to pick that back up, or work on something else?`
  );
}

function trimForGreeting(content: string): string {
  const trimmed = content.trim().replace(/[.!?]+$/, '');
  return trimmed.length > 90 ? `${trimmed.slice(0, 90)}…` : trimmed;
}

function formatCategory(category: JourneyMemoryCategory): string {
  return category === 'goal_related' ? 'goal-related' : category;
}
