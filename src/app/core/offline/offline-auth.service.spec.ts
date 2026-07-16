import { AuthResponse } from '../models/auth.models';
import { offlineDb } from './offline-db';
import { OfflineAuthService } from './offline-auth.service';

function futureSession(): AuthResponse {
  return {
    token: 'jwt-token',
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    parentId: 'parent-1',
    email: 'parent@family.com',
    displayName: 'Parent',
    role: 'Parent',
    learnerId: null,
  };
}

describe('OfflineAuthService', () => {
  let service: OfflineAuthService;

  beforeEach(async () => {
    await offlineDb.offlineLogins.clear();
    service = new OfflineAuthService();
  });

  it('records an online login and verifies the same credentials offline', async () => {
    await service.recordSuccessfulLogin('parent@family.com', 'secret123', futureSession());

    const restored = await service.tryOfflineLogin('parent@family.com', 'secret123');

    expect(restored).not.toBeNull();
    expect(restored!.token).toBe('jwt-token');
  });

  it('matches the identifier case-insensitively', async () => {
    await service.recordSuccessfulLogin('Parent@Family.com', 'secret123', futureSession());

    const restored = await service.tryOfflineLogin('  parent@family.com  ', 'secret123');

    expect(restored).not.toBeNull();
  });

  it('rejects a wrong password', async () => {
    await service.recordSuccessfulLogin('parent@family.com', 'secret123', futureSession());

    const restored = await service.tryOfflineLogin('parent@family.com', 'wrong-password');

    expect(restored).toBeNull();
  });

  it('returns null for an account this device has never signed in online', async () => {
    const restored = await service.tryOfflineLogin('stranger@family.com', 'secret123');

    expect(restored).toBeNull();
  });

  it('rejects a stored session whose token has already expired', async () => {
    const expired: AuthResponse = {
      ...futureSession(),
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    };
    await service.recordSuccessfulLogin('parent@family.com', 'secret123', expired);

    const restored = await service.tryOfflineLogin('parent@family.com', 'secret123');

    expect(restored).toBeNull();
  });

  it('still records and verifies when crypto.subtle is unavailable (insecure HTTP context)', async () => {
    // Simulate a plain-HTTP LAN origin, where crypto.subtle is undefined. The
    // service must fall back to the in-JS PBKDF2 and still work end to end.
    const realCrypto = globalThis.crypto;
    const shim = {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T =>
        realCrypto.getRandomValues(array as unknown as ArrayBufferView) as unknown as T,
      subtle: undefined,
    };
    Object.defineProperty(globalThis, 'crypto', { value: shim, configurable: true });

    try {
      await service.recordSuccessfulLogin('kid_user', 'KidPass123!', futureSession());
      const restored = await service.tryOfflineLogin('kid_user', 'KidPass123!');

      expect(restored).not.toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: realCrypto, configurable: true });
    }
  }, 30_000);
});
