import { CONTENT_PACK, findRelevantNotes } from './content-pack';
import { buildOfflineGreeting, buildOfflineSystemPrompt } from './offline-persona';

describe('offline persona prompt', () => {
  it('injects retrieved reference notes so the model can answer from real content', () => {
    const notes = findRelevantNotes('help me add fractions');
    const prompt = buildOfflineSystemPrompt([], notes);

    expect(prompt).toContain('Reference notes relevant');
    // The actual note body, not just the title, must reach the model.
    const addingFractions = CONTENT_PACK.find((n) => n.id === 'math-adding-fractions')!;
    expect(prompt).toContain(addingFractions.body.slice(0, 40));
  });

  it('injects the learner memory repository', () => {
    const prompt = buildOfflineSystemPrompt(
      [{ category: 'goal_related', content: 'Wants to master fractions' }],
      [],
    );

    expect(prompt).toContain('What you already know about this learner');
    expect(prompt).toContain('Wants to master fractions');
  });

  it('is the bare persona when there is no context', () => {
    const prompt = buildOfflineSystemPrompt([], []);

    expect(prompt).not.toContain('Reference notes relevant');
    expect(prompt).not.toContain('What you already know');
  });

  it('builds a personalised greeting from a known memory', () => {
    const greeting = buildOfflineGreeting('Emma', [
      { category: 'goal_related', content: 'Wants to master fractions' },
    ]);

    expect(greeting).toContain('Emma');
    expect(greeting).toContain('fractions');
  });
});
