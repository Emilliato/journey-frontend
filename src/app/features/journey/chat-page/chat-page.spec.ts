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

function configure(options: { online: boolean; webGpuSupported: boolean }) {
  const learnerService = {
    getLearner: vi.fn().mockReturnValue(of({ id: LEARNER_ID, displayName: 'Kiddo', createdAt: '', consentActive: true })),
  };
  const journeyService = {
    startSession: vi.fn().mockReturnValue(of({ sessionId: 'session-1', startedAt: '' })),
    listGoals: vi.fn().mockReturnValue(of([])),
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
    getCachedLearnerProfile: vi.fn().mockResolvedValue({ id: LEARNER_ID, displayName: 'Cached Kiddo', cachedAt: '' }),
    getCachedGoals: vi.fn().mockResolvedValue([]),
  };
  const webLlmService = {
    isSupported: () => options.webGpuSupported,
    isLoading: () => false,
    loadProgressText: () => null,
    generateReply: vi.fn().mockResolvedValue('offline reply'),
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
  it('starts an online session and does not touch the offline cache reads when connectivity check succeeds', () => {
    const { journeyService, offlineCache } = configure({ online: true, webGpuSupported: false });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();

    expect(journeyService.startSession).toHaveBeenCalledWith(LEARNER_ID);
    expect(offlineCache.getCachedLearnerProfile).not.toHaveBeenCalled();
    expect(fixture.componentInstance.isOnlineMode()).toBe(true);
  });

  it('loads from the offline cache and never starts a backend session when connectivity check fails', () => {
    const { journeyService, offlineCache } = configure({ online: false, webGpuSupported: true });

    const fixture = TestBed.createComponent(ChatPage);
    fixture.detectChanges();

    expect(journeyService.startSession).not.toHaveBeenCalled();
    expect(offlineCache.getCachedLearnerProfile).toHaveBeenCalledWith(LEARNER_ID);
    expect(offlineCache.getCachedGoals).toHaveBeenCalledWith(LEARNER_ID);
    expect(fixture.componentInstance.isOnlineMode()).toBe(false);
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
});
