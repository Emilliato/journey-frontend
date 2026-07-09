import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ConnectivityService } from './connectivity.service';

function setOnLine(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}

// The service also self-polls on a timer(0, ...) from its constructor, so
// more than one request to /api/health can be in flight — flush whatever's
// pending rather than asserting on request count, since these tests only
// care about what checkOnline() itself resolves to.
function flushAllHealthChecks(
  httpMock: HttpTestingController,
  response: { status?: number; statusText?: string } = {},
): void {
  const pending = httpMock.match(`${environment.apiUrl}/api/health`);

  for (const req of pending) {
    if (response.status && response.status >= 400) {
      req.flush('error', { status: response.status, statusText: response.statusText ?? 'Error' });
    } else {
      req.flush({});
    }
  }
}

describe('ConnectivityService', () => {
  let service: ConnectivityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    setOnLine(true);

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ConnectivityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    flushAllHealthChecks(httpMock);
    setOnLine(true);
  });

  it('resolves true when the health check succeeds', async () => {
    const resultPromise = firstValueFrom(service.checkOnline());
    flushAllHealthChecks(httpMock);

    expect(await resultPromise).toBe(true);
  });

  it('resolves false when the health check returns an HTTP error (e.g. 504 from a proxying service worker)', async () => {
    const resultPromise = firstValueFrom(service.checkOnline());
    flushAllHealthChecks(httpMock, { status: 504, statusText: 'Gateway Timeout' });

    expect(await resultPromise).toBe(false);
  });

  it('resolves false immediately without a network call when navigator.onLine is false', async () => {
    setOnLine(false);

    const result = await firstValueFrom(service.checkOnline());

    expect(result).toBe(false);
  });
});
