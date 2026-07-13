import { CONTENT_PACK, findRelevantNotes } from './content-pack';

describe('content pack retrieval', () => {
  it('finds the fractions note for a fractions question', () => {
    const notes = findRelevantNotes('can you help me add fractions?');

    expect(notes.length).toBeGreaterThan(0);
    expect(notes.map((n) => n.id)).toContain('math-adding-fractions');
  });

  it('finds the photosynthesis note when asked about how plants make food', () => {
    const notes = findRelevantNotes('how does photosynthesis work');

    expect(notes[0].id).toBe('sci-photosynthesis');
  });

  it('returns nothing for an off-topic message', () => {
    expect(findRelevantNotes('what should I have for lunch')).toEqual([]);
  });

  it('caps the number of returned notes', () => {
    // A message that could hit several math notes.
    const notes = findRelevantNotes('fractions decimals percentages ratios angles', 2);
    expect(notes.length).toBeLessThanOrEqual(2);
  });

  it('does not match a single-word keyword inside another word', () => {
    // The keyword "cell" is a substring of "excellent" — the word boundary
    // must stop the cells note from matching here.
    const notes = findRelevantNotes('that is excellent work');
    expect(notes.map((n) => n.id)).not.toContain('sci-cells');
  });

  it('has unique note ids', () => {
    const ids = CONTENT_PACK.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
