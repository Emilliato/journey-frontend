import { TestBed } from '@angular/core/testing';
import { WebLlmService } from './webllm.service';

describe('WebLlmService', () => {
  let originalGpuDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    originalGpuDescriptor = Object.getOwnPropertyDescriptor(Navigator.prototype, 'gpu');
  });

  afterEach(() => {
    if (originalGpuDescriptor) {
      Object.defineProperty(Navigator.prototype, 'gpu', originalGpuDescriptor);
    } else {
      delete (Navigator.prototype as unknown as Record<string, unknown>)['gpu'];
    }
  });

  it('reports supported when navigator.gpu is present', () => {
    Object.defineProperty(Navigator.prototype, 'gpu', { value: {}, configurable: true });

    const service = TestBed.inject(WebLlmService);

    expect(service.isSupported()).toBe(true);
  });

  it('reports unsupported when navigator.gpu is absent (the cached-content-only fallback path)', () => {
    delete (Navigator.prototype as unknown as Record<string, unknown>)['gpu'];

    const service = TestBed.inject(WebLlmService);

    expect(service.isSupported()).toBe(false);
  });

  it('rejects generateReply when unsupported, without attempting to load a model', async () => {
    delete (Navigator.prototype as unknown as Record<string, unknown>)['gpu'];

    const service = TestBed.inject(WebLlmService);

    await expect(service.generateReply('hi', [])).rejects.toThrow(
      'WebGPU is not supported on this device.',
    );
    expect(service.isLoading()).toBe(false);
  });
});
