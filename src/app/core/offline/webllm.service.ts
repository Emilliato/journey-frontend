import { Injectable, signal } from '@angular/core';
import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { ContentNote } from './content-pack';
import { OfflinePersonaMemory, buildOfflineSystemPrompt } from './offline-persona';

/**
 * The local model. Qwen2.5-0.5B-Instruct, chosen for speed on low-end phones:
 * at ~0.5B params (vs ~1.24B for Llama-3.2-1B) it decodes tokens markedly
 * faster, which is the offline pain point on mobile. GPU memory is about the
 * same (~945 MB vs ~879 MB — Qwen's large vocab offsets its smaller body), so
 * this trades a little model quality for latency, which suits JOURNEY's
 * deliberately narrow offline persona (short encouragement, goal recall,
 * simple cached-content Q&A — see offline-persona.ts). It's also strongly
 * multilingual. Model id confirmed against the installed @mlc-ai/web-llm
 * package's own model config, not guessed.
 */
export const OFFLINE_MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

/**
 * Fallback for GPUs without the `shader-f16` WebGPU feature (common on
 * older/budget Android GPUs): same model with f32 weights (~1060 MB GPU
 * memory vs ~945 MB). `'gpu' in navigator` passes on those devices, so
 * without this fallback engine creation throws and offline replies fail.
 */
export const OFFLINE_MODEL_ID_F32 = 'Qwen2.5-0.5B-Instruct-q4f32_1-MLC';

/**
 * Minimal structural view of `navigator.gpu` — the project doesn't pull in
 * @webgpu/types (tsconfig `types: []`), and this is all we touch.
 */
interface WebGpuLike {
  requestAdapter(): Promise<{ features: { has(feature: string): boolean } } | null>;
}

/**
 * One prior conversation turn, in the local model's own chat format —
 * lets a chat that started online (with Claude) continue offline with
 * full context when connectivity drops mid-conversation.
 */
export interface OfflineChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * The small local model gets a bounded window of prior turns: enough for
 * continuity, small enough to keep prompts fast on a phone GPU. Kept short
 * on purpose — every extra turn lengthens prefill, the slowest part of a
 * reply on mobile.
 */
const MAX_HISTORY_TURNS = 6;

/**
 * Cap on generated tokens. JOURNEY's offline replies to a child are meant to
 * be short and encouraging, and a cap bounds the worst-case wait on a slow
 * phone GPU (decode time scales with tokens produced).
 */
const MAX_REPLY_TOKENS = 200;

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
  private engine: MLCEngineInterface | null = null;
  private engineLoadPromise: Promise<MLCEngineInterface> | null = null;

  readonly isSupported = signal(WebLlmService.detectWebGpuSupport());
  readonly isLoading = signal(false);
  readonly loadProgressText = signal<string | null>(null);

  /** 0..100 model-download/init progress, for the offline "getting ready" affordance. */
  readonly loadProgressPercent = signal(0);

  /**
   * Human-readable reason the last engine load or generation failed —
   * surfaced in the chat UI so failures are diagnosable on a phone,
   * where there's no DevTools console to inspect.
   */
  readonly lastError = signal<string | null>(null);

  /**
   * What the GPU adapter probe found. 'f16' runs the smaller q4f16_1
   * model; 'no-f16' runs the q4f32_1 fallback; 'unavailable' means no
   * usable adapter. 'unknown' until a load or readiness check has probed.
   */
  readonly gpuStatus = signal<'unknown' | 'unavailable' | 'f16' | 'no-f16'>('unknown');

  /** True once the engine is loaded — offline replies will work. */
  readonly isReady = signal(false);

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

  /**
   * Explicit readiness check for the "is offline mode going to work?"
   * button: probes the GPU and loads the model (from cache when already
   * downloaded). Resolves true when offline replies will work; on false,
   * `gpuStatus` and `lastError` say why.
   */
  async checkReadiness(): Promise<boolean> {
    if (!this.isSupported()) {
      this.gpuStatus.set('unavailable');
      this.lastError.set('This browser does not expose WebGPU.');
      return false;
    }

    try {
      await this.ensureEngine();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generates JOURNEY's offline reply. When `onToken` is supplied the reply
   * is streamed — each token is delivered as it's produced so text appears
   * in the chat almost immediately instead of after the whole (slow on
   * mobile) generation completes. The full reply is always returned too.
   */
  async generateReply(
    learnerMessage: string,
    cachedGoalTitles: readonly string[],
    memories: readonly OfflinePersonaMemory[] = [],
    referenceNotes: readonly ContentNote[] = [],
    history: readonly OfflineChatTurn[] = [],
    onToken?: (delta: string) => void,
  ): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('WebGPU is not supported on this device.');
    }

    const engine = await this.ensureEngine();

    const goalContext =
      cachedGoalTitles.length > 0
        ? `The learner's saved goals: ${cachedGoalTitles.join('; ')}.`
        : `The learner has no saved goals cached yet.`;

    const messages = [
      { role: 'system' as const, content: `${buildOfflineSystemPrompt(memories, referenceNotes)}\n\n${goalContext}` },
      // Prior turns (including ones Claude answered before the connection
      // dropped) so the local model continues the same conversation.
      ...history.slice(-MAX_HISTORY_TURNS).map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: learnerMessage },
    ];

    const chunks = await engine.chat.completions.create({
      messages,
      stream: true,
      max_tokens: MAX_REPLY_TOKENS,
    });

    let full = '';
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onToken?.(delta);
      }
    }

    return full || "Sorry, I couldn't come up with a reply just now.";
  }

  private async ensureEngine(): Promise<MLCEngineInterface> {
    if (this.engine) {
      return this.engine;
    }

    if (!this.engineLoadPromise) {
      this.isLoading.set(true);
      this.lastError.set(null);

      this.engineLoadPromise = this.loadEngine()
        .then(async (engine) => {
          this.engine = engine;
          this.isLoading.set(false);
          this.isReady.set(true);
          // Warm up in the background: a 1-token generation forces WebGPU
          // shader compilation now, so the learner's *first* real reply
          // isn't paying that one-time cost on top of generation.
          void this.warmUp(engine);
          return engine;
        })
        .catch((error: unknown) => {
          this.isLoading.set(false);
          this.engineLoadPromise = null;
          this.lastError.set(error instanceof Error ? error.message : String(error));
          throw error;
        });
    }

    return this.engineLoadPromise;
  }

  private async loadEngine(): Promise<MLCEngineInterface> {
    // `'gpu' in navigator` (isSupported) only proves the API exists. The
    // adapter can still be unavailable, and the f16 model additionally
    // needs the shader-f16 feature — probe before committing to a model.
    const gpu = (navigator as Navigator & { gpu?: WebGpuLike }).gpu;
    const adapter = gpu ? await gpu.requestAdapter() : null;

    if (!adapter) {
      this.gpuStatus.set('unavailable');
      throw new Error('WebGPU reports no usable GPU adapter on this device.');
    }

    const hasF16 = adapter.features.has('shader-f16');
    this.gpuStatus.set(hasF16 ? 'f16' : 'no-f16');

    const modelId = hasF16 ? OFFLINE_MODEL_ID : OFFLINE_MODEL_ID_F32;

    const webllm = await import('@mlc-ai/web-llm');
    const initProgressCallback = (report: { text: string; progress?: number }): void => {
      this.loadProgressText.set(report.text);
      this.loadProgressPercent.set(Math.round((report.progress ?? 0) * 100));
    };

    // Run the model in a dedicated Web Worker so load + inference never
    // block the UI thread — the key to staying responsive on phones. Fall
    // back to a main-thread engine only if the worker can't be created
    // (e.g. a browser without module-worker support).
    try {
      const worker = new Worker(new URL('./webllm.worker', import.meta.url), { type: 'module' });
      return await webllm.CreateWebWorkerMLCEngine(worker, modelId, { initProgressCallback });
    } catch (workerError) {
      console.warn('WebLLM worker unavailable, falling back to main-thread engine.', workerError);
      return await webllm.CreateMLCEngine(modelId, { initProgressCallback });
    }
  }

  /** One tiny generation to trigger shader compilation ahead of first use. */
  private async warmUp(engine: MLCEngineInterface): Promise<void> {
    try {
      await engine.chat.completions.create({
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      });
    } catch {
      // Warm-up is best-effort — a failure here just means the first real
      // reply pays the compile cost, which is the pre-warm behaviour anyway.
    }
  }
}
