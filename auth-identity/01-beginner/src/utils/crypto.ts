import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Cryptographically secure random ID (URL-safe). */
export function randomId(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex digest — for binding hashes, NOT for passwords. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Constant-time string compare (equal length required). */
export function safeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
