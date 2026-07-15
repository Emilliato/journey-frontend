/// <reference lib="webworker" />
import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

/**
 * Dedicated Web Worker that hosts the WebLLM engine. Running model load and
 * token generation here — off the main thread — is what keeps the UI
 * responsive on phones: WebGPU compilation and inference no longer block
 * painting, scrolling, typing, or the avatar animations. The main thread
 * talks to this via CreateWebWorkerMLCEngine (see WebLlmService).
 */
const handler = new WebWorkerMLCEngineHandler();

self.onmessage = (msg: MessageEvent): void => {
  handler.onmessage(msg);
};
