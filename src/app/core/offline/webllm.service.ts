import { Injectable, signal } from '@angular/core';
import type { MLCEngine } from '@mlc-ai/web-llm';
import { OFFLINE_SYSTEM_PROMPT } from './offline-persona';

/**
 * The real WebLLM prebuilt model id closest to docs/ARCHITECTURE.md's
 * "e.g. Phi-4-mini" suggestion — confirmed against the installed
 * @mlc-ai/web-llm package's own model config rather than guessed.
 */
export const OFFLINE_MODEL_ID = 'Phi-4-mini-instruct-q4f16_1-MLC';

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

  async generateReply(learnerMessage: string, cachedGoalTitles: readonly string[]): Promise<string> {
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
        { role: 'system', content: `${OFFLINE_SYSTEM_PROMPT}\n\n${goalContext}` },
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
