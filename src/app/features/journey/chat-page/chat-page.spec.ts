import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ChatPage } from './chat-page';
import { LearnerService } from '../../../core/services/learner.service';
import { JourneyService } from '../../../core/services/journey.service';
import { ConnectivityService } from '../../../core/services/connectivity.service';
import { OfflineCacheService } from '../../../core/offline/offline-cache.service';
import { WebLlmService } from '../../../core/offline/webllm.service';

const LEARNER_ID = 'learner-123';

function configure(options: {
  online: boolean;
  webGpuSupported: boolean;
  consentActive?: boolean;
  cachedChat?: { id: string; learnerId: string; role: 'learner' | 'journey'; text: string; createdAt: string }[];
}) {
  const learnerService = {
    getLearner: vi.fn().mockReturnValue(of({ id: LEARNER_ID, displayName: 'Kiddo', createdAt: '', consentActive: true })),
  };
  const journeyService = {
    startSession: vi.fn().mockReturnValue(of({ sessionId: 'session-1', startedAt: '', greeting: 'Hi, I am JOURNEY! What grade are you in?' })),
    listGoals: vi.fn().mockReturnValue(of([])),
    listMemories: vi.fn().mockReturnValue(of([])),
    sendMessage: vi.fn(),
    completeSession: vi.fn().mockReturnValue(of(undefined)),
  };
  const connectivityService = {
    checkOnline: vi.fn().mockReturnValue(of(options.online)),
    isOnline: () => options.online,
  };
  const offlineCache = {
    cacheLearnerProfile: vi.fn().mockResolvedValue(undefined),
    cacheGoals: vi.fn().mockResolvedValue(undefined),
    cacheMemories: vi.fn().mockResolvedValue(undefined),
    getCachedLearnerProfile: vi
      .fn()
      .mockResolvedValue({ id: LEARNER_ID, displayName: 'Cached Kiddo', consentActive: options.consentActive ?? true, cachedAt: '' }),
    getCachedGoals: vi.fn().mockResolvedValue([]),
    getCachedMemories: vi.fn().mockResolvedValue([]),
    getCachedChat: vi.fn().mockResolvedValue(options.cachedChat ?? []),
    appendChatMessage: vi.fn().mockResolvedValue(undefined),
  };
  const webLlmService = {
    isSupported: () => options.webGpuSupported,
    isLoading: () => false,
    loadProgressText: () => null,
    lastError: () => null,
    gpuStatus: () => (options.webGpuSupported ? 'f16' : 'unavailable'),
    preload: vi.fn(),
    generateReply: vi.fn().mockResolvedValue('offline reply'),
    checkReadiness: vi.fn().mockResolvedValue(options.webGpuSupported),
  };

  TestBed.configureTestingModule({
    imports: [ChatPage],
    providers: [
      { provide: LearnerService, useValue: learnerService },
      { provide: JourneyService, useValue: journeyService },
      { provide: ConnectivityService, useValue: connectivityService },
      { provide: OfflineCacheService, useValue: offlineCache },
      { provide: WebLlmService, useValue: webLlmService },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ learnerId: LEARNER_ID }) } },
      },
    ],
  });

  return { learnerService, journeyService, connectivityService, offlineCache, webLlmService };
}

describe('ChatPage', () => {
  it('starts an online session and does not touch the offline cache reads when connectivity check succeeds', async () => {
    const { journeyService, offlineCache } = configure({ online: true, webGpuSupported: false });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(journeyService.startSession).toHaveBeenCalledWith(LEARNER_ID);
    expect(offlineCache.getCachedLearnerProfile).not.toHaveBeenCalled();
    expect(fixture.componentInstance.isOnlineMode()).toBe(true);
  });

  it("shows JOURNEY's greeting as the first chat message when a session starts", async () => {
    configure({ online: true, webGpuSupported: false });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const messages = fixture.componentInstance.messages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('journey');
    expect(messages[0].text).toContain('What grade are you in?');
  });

  it('restores the persisted transcript and suppresses the greeting so the child continues where they left off', async () => {
    const { offlineCache } = configure({
      online: true,
      webGpuSupported: false,
      cachedChat: [
        { id: 'm1', learnerId: LEARNER_ID, role: 'journey', text: 'Hi again!', createdAt: '2026-07-14T10:00:00Z' },
        { id: 'm2', learnerId: LEARNER_ID, role: 'learner', text: 'Fractions please', createdAt: '2026-07-14T10:01:00Z' },
      ],
    });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const messages = fixture.componentInstance.messages();
    expect(offlineCache.getCachedChat).toHaveBeenCalledWith(LEARNER_ID);
    expect(messages).toHaveLength(2);
    expect(messages[1].text).toBe('Fractions please');
  });

  it('loads from the offline cache and never starts a backend session when connectivity check fails', async () => {
    const { journeyService, offlineCache } = configure({ online: false, webGpuSupported: true });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(journeyService.startSession).not.toHaveBeenCalled();
    expect(offlineCache.getCachedLearnerProfile).toHaveBeenCalledWith(LEARNER_ID);
    expect(offlineCache.getCachedGoals).toHaveBeenCalledWith(LEARNER_ID);
    expect(fixture.componentInstance.isOnlineMode()).toBe(false);
  });

  it('passes prior turns as history when replying offline', async () => {
    const { webLlmService } = configure({
      online: false,
      webGpuSupported: true,
      cachedChat: [
        { id: 'm1', learnerId: LEARNER_ID, role: 'journey', text: 'Hi again!', createdAt: '2026-07-14T10:00:00Z' },
      ],
    });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    fixture.componentInstance.form.setValue({ message: 'What is a fraction?' });
    fixture.componentInstance.send();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const history = webLlmService.generateReply.mock.calls[0][4];
    expect(history).toEqual([{ role: 'assistant', content: 'Hi again!' }]);
  });

  it('routes send() to the local WebLLM model when offline and the device supports it', async () => {
    const { journeyService, webLlmService } = configure({ online: false, webGpuSupported: true });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    fixture.componentInstance.form.setValue({ message: 'I love drawing' });
    fixture.componentInstance.send();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(webLlmService.generateReply).toHaveBeenCalled();
    expect(journeyService.sendMessage).not.toHaveBeenCalled();
  });

  it('refuses to chat offline and surfaces the consent message when cached consent is not active', async () => {
    const { journeyService, webLlmService } = configure({
      online: false,
      webGpuSupported: true,
      consentActive: false,
    });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(fixture.componentInstance.offlineConsentActive()).toBe(false);
    expect(fixture.componentInstance.errorMessage()).toContain('consent');

    fixture.componentInstance.form.setValue({ message: 'I love drawing' });
    fixture.componentInstance.send();
    await new Promise((resolve) => setTimeout(resolve, 0));

    // No reply generated and nothing queued — the offline consent gate held.
    expect(webLlmService.generateReply).not.toHaveBeenCalled();
    expect(journeyService.sendMessage).not.toHaveBeenCalled();
  });

  it('greets the learner offline with an instant, cache-built message when consent is active', async () => {
    configure({ online: false, webGpuSupported: true, consentActive: true });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    const messages = fixture.componentInstance.messages();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('journey');
    expect(messages[0].text).toContain('JOURNEY');
  });

  it('refuses to send and surfaces an error when offline and the device does not support WebGPU', async () => {
    const { journeyService, webLlmService } = configure({ online: false, webGpuSupported: false });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    fixture.componentInstance.form.setValue({ message: 'hello' });
    fixture.componentInstance.send();

    expect(webLlmService.generateReply).not.toHaveBeenCalled();
    expect(journeyService.sendMessage).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorMessage()).toContain("can't generate replies offline");
  });

  it('confirms GPU and offline model readiness via the check button', async () => {
    const { webLlmService } = configure({ online: true, webGpuSupported: true });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await fixture.componentInstance.checkOfflineReadiness();

    expect(webLlmService.checkReadiness).toHaveBeenCalled();
    expect(fixture.componentInstance.offlineReady()).toBe(true);
    expect(fixture.componentInstance.readinessMessage()).toContain('GPU ready');
    expect(fixture.componentInstance.readinessMessage()).toContain('Offline model loaded');
  });

  it('reports why offline mode is not ready when the readiness check fails', async () => {
    configure({ online: true, webGpuSupported: false });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));

    await fixture.componentInstance.checkOfflineReadiness();

    expect(fixture.componentInstance.offlineReady()).toBe(false);
    expect(fixture.componentInstance.readinessMessage()).toContain('Offline mode is not ready');
  });
});
