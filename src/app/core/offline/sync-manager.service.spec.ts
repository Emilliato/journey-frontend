import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ConnectivityService } from '../services/connectivity.service';
import { SyncApiService } from '../services/sync-api.service';
import { SyncBatchResponse } from '../models/sync.models';
import { offlineDb } from './offline-db';
import { SyncManagerService } from './sync-manager.service';

const LEARNER_ID = 'learner-sync-1';

function configure(options: { initiallyOnline: boolean; syncBatch?: ReturnType<typeof vi.fn> }) {
  // A real signal, not a plain closure getter — effect() only re-runs when
  // an actual reactive dependency changes, which is exactly the behaviour
  // this test needs to exercise (the service's own reconnect-detection).
  const onlineSignal = signal(options.initiallyOnline);

  const connectivityService = {
    isOnline: onlineSignal,
    checkOnline: () => of(onlineSignal()),
  };

  const syncApiService = {
    syncBatch: options.syncBatch ?? vi.fn(),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: ConnectivityService, useValue: connectivityService },
      { provide: SyncApiService, useValue: syncApiService },
    ],
  });

  return {
    syncApiService,
    setOnline: (value: boolean) => onlineSignal.set(value),
  };
}

async function flush(): Promise<void> {
  // Angular's effect() scheduler and our own async runSync() chain both
  // resolve over several microtask/macrotask turns — a couple of
  // setTimeout(0) round trips is enough to drain them in a plain TestBed
  // unit test with no component fixture driving change detection.
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SyncManagerService', () => {
  beforeEach(async () => {
    await offlineDb.goals.clear();
    await offlineDb.journeyMemories.clear();
  });

  it('reports offline status and does not call the sync API while offline', async () => {
    const { syncApiService } = configure({ initiallyOnline: false });

    const service = TestBed.inject(SyncManagerService);
    await flush();

    expect(service.status()).toBe('offline');
    expect(syncApiService.syncBatch).not.toHaveBeenCalled();
  });

  it('pushes pending goals and memories on reconnect, and clears pendingSync from the resolved server state', async () => {
    await offlineDb.goals.put({
      id: 'goal-1',
      learnerId: LEARNER_ID,
      title: 'Read every day',
      description: null,
      status: 'Active',
      updatedAt: '2026-01-01T00:00:00.000Z',
      pendingSync: true,
    });
    await offlineDb.journeyMemories.put({
      id: 'memory-1',
      learnerId: LEARNER_ID,
      conversationSessionId: null,
      category: 'preference',
      content: 'Loves dinosaurs',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      pendingSync: true,
    });

    const response: SyncBatchResponse = {
      goals: [
        {
          id: 'goal-1',
          title: 'Read every day',
          description: null,
          status: 'Active',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      journeyMemories: [
        {
          id: 'memory-1',
          conversationSessionId: null,
          category: 'preference',
          content: 'Loves dinosaurs',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const syncBatch = vi.fn().mockReturnValue(of(response));
    const { setOnline } = configure({ initiallyOnline: false, syncBatch });

    TestBed.inject(SyncManagerService);
    await flush();

    setOnline(true);
    await flush();
    await flush();

    expect(syncBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        learnerId: LEARNER_ID,
        goals: [expect.objectContaining({ id: 'goal-1' })],
        journeyMemories: [expect.objectContaining({ id: 'memory-1' })],
      }),
    );

    const goalAfter = await offlineDb.goals.get('goal-1');
    const memoryAfter = await offlineDb.journeyMemories.get('memory-1');
    expect(goalAfter?.pendingSync).toBe(false);
    expect(memoryAfter?.pendingSync).toBe(false);
  });

  it('leaves pendingSync set and reports an error status when the sync call fails', async () => {
    await offlineDb.goals.put({
      id: 'goal-2',
      learnerId: LEARNER_ID,
      title: 'Practice piano',
      description: null,
      status: 'Active',
      updatedAt: '2026-01-01T00:00:00.000Z',
      pendingSync: true,
    });

    const syncBatch = vi.fn().mockReturnValue(throwError(() => new Error('network down')));
    const { setOnline } = configure({ initiallyOnline: false, syncBatch });

    const service = TestBed.inject(SyncManagerService);
    await flush();

    setOnline(true);
    await flush();
    await flush();

    expect(service.status()).toBe('error');
    const goalAfter = await offlineDb.goals.get('goal-2');
    expect(goalAfter?.pendingSync).toBe(true);
  });
});
