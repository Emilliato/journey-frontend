import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, catchError, map, merge, of, switchMap, timeout, timer } from 'rxjs';
import { fromEvent } from 'rxjs';
import { environment } from '../../../environments/environment';

const POLL_INTERVAL_MS = 20_000;

/**
 * A real reachability check against the backend, not just navigator.onLine
 * (which reports true on networks with no actual internet access — e.g. a
 * captive portal). `checkOnline()` is a one-shot check for the moment of an
 * online-only action (child profile creation); `isOnline` is the always-on
 * signal Phase 4's offline routing (ChatPage) reads to decide whether to
 * use the Claude Proxy or WebLLM — re-verified on a poll and on browser
 * online/offline events, never trusting either signal alone.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly isOnline = signal(navigator.onLine);

  constructor(private readonly http: HttpClient) {
    merge(timer(0, POLL_INTERVAL_MS), fromEvent(window, 'online'), fromEvent(window, 'offline'))
      .pipe(switchMap(() => this.checkOnline()))
      .subscribe((online) => this.isOnline.set(online));
  }

  checkOnline(): Observable<boolean> {
    if (!navigator.onLine) {
      return of(false);
    }

    return this.http.get(`${environment.apiUrl}/api/health`).pipe(
      timeout(4000),
      map(() => true),
      catchError(() => of(false)),
    );
  }
}
