import { Injectable } from '@angular/core';
import { AuthResponse } from '../models/auth.models';
import { offlineDb } from './offline-db';

const PBKDF2_ITERATIONS = 100_000;

/**
 * Offline sign-in continuation — CLAUDE.md constraint 1 as amended
 * 2026-07-15. After every successful *online* login we store a PBKDF2
 * hash of the credentials (never the password itself) together with the
 * issued session. When the device is offline, entering the same
 * credentials verifies locally and restores that session — so a child can
 * sign in to their own profile with no connection, on any device that has
 * signed them in online at least once. A device that has never seen this
 * account online has nothing stored and still requires connectivity.
 */
@Injectable({ providedIn: 'root' })
export class OfflineAuthService {
  /** Called after a successful online login; failures are non-fatal by design. */
  async recordSuccessfulLogin(identifier: string, password: string, session: AuthResponse): Promise<void> {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await this.deriveHash(password, salt);

      await offlineDb.offlineLogins.put({
        identifier: this.normalize(identifier),
        saltB64: this.toBase64(salt),
        hashB64: this.toBase64(hash),
        sessionJson: JSON.stringify(session),
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // Losing the offline-login record only means this device needs
      // connectivity next time — never fail the online login over it.
    }
  }

  /**
   * Verifies credentials against the local store and returns the cached
   * session, or null when the account is unknown here, the password is
   * wrong, or the cached token has expired (an expired token can't call
   * the API after reconnect, so offline entry with it would dead-end).
   */
  async tryOfflineLogin(identifier: string, password: string): Promise<AuthResponse | null> {
    const record = await offlineDb.offlineLogins.get(this.normalize(identifier));

    if (!record) {
      return null;
    }

    const salt = this.fromBase64(record.saltB64);
    const hash = await this.deriveHash(password, salt);

    if (this.toBase64(hash) !== record.hashB64) {
      return null;
    }

    const session = JSON.parse(record.sessionJson) as AuthResponse;

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return session;
  }

  private normalize(identifier: string): string {
    return identifier.trim().toLowerCase();
  }

  private async deriveHash(password: string, salt: Uint8Array): Promise<Uint8Array> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );

    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      256,
    );

    return new Uint8Array(bits);
  }

  private toBase64(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
  }

  private fromBase64(value: string): Uint8Array {
    return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
  }
}
