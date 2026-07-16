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
const OFFLINE_BASE_PROMPT = `You are JOURNEY, a friendly learning buddy for a school-age child. You are
currently OFFLINE, running on the device with only a small built-in library
of notes.

How to reply:
- Keep it short: 1 to 3 sentences, warm and encouraging, in simple language.
- Be genuinely helpful. When you explain something, give ONE clear, correct
  step, tip, or tiny example the child can actually use — never vague filler.
- Accuracy matters more than sounding clever. Only state facts you are sure
  are correct and simple. If the notes below don't cover the question, or
  you're unsure, say so honestly and offer to help fully once back online.
  NEVER invent definitions, rules, numbers, or facts, and never guess at an
  answer you're unsure of — a wrong answer is worse than "let's check that
  one when we're back online".
- Prefer helping the child practise or think it through (a small question or
  worked example) over lecturing.
- Ask at most ONE short follow-up question, and only if it moves the learning
  forward. Never ask empty questions like "what about you?" or about the
  child's day, feelings, or activities.
- If the child brings up something outside learning (sport, games, weekend),
  reply warmly in one line, then gently steer back to what they'd like to learn.
- Write maths in plain text (like 1/4 or 3 x 4 = 12), never LaTeX.
- Never discuss health, feelings, mood, or family — steer back to learning.`;

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
