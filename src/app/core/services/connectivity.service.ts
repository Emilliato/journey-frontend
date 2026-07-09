import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * A real reachability check against the backend, not just navigator.onLine
 * (which reports true on networks with no actual internet access — e.g. a
 * captive portal). Used at the moment of an online-only action (child
 * profile creation) rather than as a continuously-running monitor; the
 * always-on connectivity detector described in docs/ARCHITECTURE.md is
 * Phase 4 scope, once there's an offline mode for it to gate.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  constructor(private readonly http: HttpClient) {}

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
