import { Injectable, signal } from '@angular/core';
import type { MLCEngine } from '@mlc-ai/web-llm';
import { ContentNote } from './content-pack';
import { OfflinePersonaMemory, buildOfflineSystemPrompt } from './offline-persona';

/**
 * The local model. Chosen for mobile viability (see docs/ARCHITECTURE.md,
 * which names Phi-4-mini only as an "e.g."): Llama-3.2-1B needs ~879 MB of
 * GPU memory and is flagged low-resource-capable in the prebuilt config,
 * versus ~3438 MB for Phi-4-mini — the difference between "runs on a
 * mid-range phone" and "flagship-only / OOM". Model id confirmed against
 * the installed @mlc-ai/web-llm package's own model config, not guessed.
 */
export const OFFLINE_MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

/**
 * Runs JOURNEY's offline persona locally via WebLLM/WebGPU. Feature-detect
 * with `isSupported` before calling anything else — devices without WebGPU
 * (most headless/CI browsers included) fall back to cached-content-only
 * mode entirely client-side in ChatPage; this service never attempts to
 * load a model on an unsupported device.
 *
 * @mlc-ai/web-llm is dynamically imported so its (large) runtime never
 * ships in the main bundle for users who never go offline.
 */
@Injectable({ providedIn: 'root' })
export class WebLlmService {
  private engine: MLCEngine | null = null;
  private engineLoadPromise: Promise<MLCEngine> | null = null;

  readonly isSupported = signal(WebLlmService.detectWebGpuSupport());
  readonly isLoading = signal(false);
  readonly loadProgressText = signal<string | null>(null);

  private static detectWebGpuSupport(): boolean {
    return typeof navigator !== 'undefined' && 'gpu' in navigator;
  }

  /**
   * Starts loading the local model in the background without waiting for a
   * reply. Called when an offline session opens so the (large) model load
   * overlaps with the learner reading the instant greeting and typing —
   * the first real reply is then much faster. Safe to call when
   * unsupported (no-op) and idempotent (shares the single load promise).
   */
  preload(): void {
    if (!this.isSupported() || this.engine) {
      return;
    }

    // Swallow errors here — a failed preload just means the first
    // generateReply retries and surfaces the error then.
    void this.ensureEngine().catch(() => {});
  }

  async generateReply(
    learnerMessage: string,
    cachedGoalTitles: readonly string[],
    memories: readonly OfflinePersonaMemory[] = [],
    referenceNotes: readonly ContentNote[] = [],
  ): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('WebGPU is not supported on this device.');
    }

    const engine = await this.ensureEngine();

    const goalContext =
      cachedGoalTitles.length > 0
        ? `The learner's saved goals: ${cachedGoalTitles.join('; ')}.`
        : `The learner has no saved goals cached yet.`;

    const completion = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: `${buildOfflineSystemPrompt(memories, referenceNotes)}\n\n${goalContext}` },
        { role: 'user', content: learnerMessage },
      ],
    });

    return completion.choices[0]?.message?.content ?? "Sorry, I couldn't come up with a reply just now.";
  }

  private async ensureEngine(): Promise<MLCEngine> {
    if (this.engine) {
      return this.engine;
    }

    if (!this.engineLoadPromise) {
      this.isLoading.set(true);

      this.engineLoadPromise = import('@mlc-ai/web-llm')
        .then(({ CreateMLCEngine }) =>
          CreateMLCEngine(OFFLINE_MODEL_ID, {
            initProgressCallback: (report) => this.loadProgressText.set(report.text),
          }),
        )
        .then((engine) => {
          this.engine = engine;
          this.isLoading.set(false);
          return engine;
        })
        .catch((error) => {
          this.isLoading.set(false);
          this.engineLoadPromise = null;
          throw error;
        });
    }

    return this.engineLoadPromise;
  }
}
