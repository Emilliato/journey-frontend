import { OfflineJourneyService } from './offline-journey.service';
import { offlineDb } from './offline-db';
import type { WebLlmService } from './webllm.service';

function makeService(reply = 'ok'): OfflineJourneyService {
  const webLlm = {
    generateReply: vi.fn().mockResolvedValue(reply),
  } as unknown as WebLlmService;
  return new OfflineJourneyService(webLlm);
}

describe('OfflineJourneyService consent gate', () => {
  afterEach(async () => {
    await offlineDb.journeyMemories.clear();
    await offlineDb.goals.clear();
  });

  it('records an offline memory when consent is active', async () => {
    const learnerId = crypto.randomUUID();
    const result = await makeService().respond(learnerId, 'I love drawing comics', [], [], true);

    expect(result.memoryWritten).toBe(true);
    expect(result.consentBlockedWrite).toBe(false);
    expect(await offlineDb.journeyMemories.where('learnerId').equals(learnerId).count()).toBe(1);
  });

  it('blocks the write and records nothing when consent is not active', async () => {
    const learnerId = crypto.randomUUID();
    const result = await makeService().respond(learnerId, 'I love drawing comics', [], [], false);

    // Still replies (reading/encouragement is fine), but never persists.
    expect(result.reply).toBe('ok');
    expect(result.memoryWritten).toBe(false);
    expect(result.consentBlockedWrite).toBe(true);
    expect(await offlineDb.journeyMemories.where('learnerId').equals(learnerId).count()).toBe(0);
  });

  it('blocks an offline goal write without consent', async () => {
    const learnerId = crypto.randomUUID();
    const result = await makeService().respond(learnerId, 'I want to set a goal', [], [], false);

    expect(result.goalWritten).toBeNull();
    expect(result.consentBlockedWrite).toBe(true);
    expect(await offlineDb.goals.where('learnerId').equals(learnerId).count()).toBe(0);
  });

  it('builds an instant greeting that recalls a known memory', () => {
    const greeting = makeService().greeting('Emma', [
      { category: 'goal_related', content: 'Wants to master fractions' },
    ]);

    expect(greeting).toContain('Emma');
    expect(greeting).toContain('fractions');
  });
});
