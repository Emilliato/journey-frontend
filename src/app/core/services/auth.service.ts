import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.models';

const STORAGE_KEY = 'learnbridge.auth';

/**
 * Parent and learner auth. Register is parent-only; login resolves either
 * a parent's email or a learner's username, and the response's role drives
 * routing. Online logins also record a locally-verifiable credential so
 * the same account can sign back in offline on this device — see
 * OfflineAuthService and CLAUDE.md constraint 1 (amended 2026-07-15).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<AuthResponse | null>(this.readStoredSession());

  readonly currentSession = this.session.asReadonly();

  readonly isAuthenticated = computed(() => {
    const session = this.session();
    return session !== null && new Date(session.expiresAt).getTime() > Date.now();
  });

  readonly role = computed(() => this.session()?.role ?? null);

  constructor(private readonly http: HttpClient) {}

  /**
   * Adopts a session restored by an offline login (already verified by
   * OfflineAuthService) — same effect as a successful online login.
   */
  adoptSession(response: AuthResponse): void {
    this.setSession(response);
  }

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/auth/register`, request)
      .pipe(tap((response) => this.setSession(response)));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiUrl}/api/auth/login`, request)
      .pipe(tap((response) => this.setSession(response)));
  }

  logout(): void {
    this.session.set(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  private setSession(response: AuthResponse): void {
    this.session.set(response);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(response));
  }

  private readStoredSession(): AuthResponse | null {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as AuthResponse;
    } catch {
      return null;
    }
  }
}
