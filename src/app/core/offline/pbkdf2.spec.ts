import { pbkdf2Sha256 } from './pbkdf2';

/** Reference PBKDF2 via Web Crypto (available in the Node test runtime). */
async function subtlePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number,
  bytes: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    bytes * 8,
  );
  return new Uint8Array(bits);
}

describe('pbkdf2Sha256 (insecure-context fallback)', () => {
  // The whole point of the fallback: it must produce byte-identical output to
  // crypto.subtle, so a credential recorded in a secure context verifies in an
  // insecure one and vice versa.
  it('matches crypto.subtle PBKDF2-HMAC-SHA256 byte for byte', async () => {
    const cases = [
      { pw: 'password', salt: 'salt', iters: 1 },
      { pw: 'KidPass123!', salt: 'sixteen-byte-slt', iters: 2048 },
      { pw: 'parent@family.com', salt: 'another-salt-val', iters: 1000 },
      { pw: '', salt: 'x', iters: 500 },
    ];

    for (const c of cases) {
      const salt = new TextEncoder().encode(c.salt);
      const mine = pbkdf2Sha256(new TextEncoder().encode(c.pw), salt, c.iters, 32);
      const reference = await subtlePbkdf2(c.pw, salt, c.iters, 32);

      expect(Array.from(mine)).toEqual(Array.from(reference));
    }
  });
});
