import { randomBytes, timingSafeEqual } from 'node:crypto';

/** Double-submit / synchronizer CSRF token helpers for cookie-based sessions. */
export function createCsrfToken(): string {
  return randomBytes(24).toString('base64url');
}

export function assertCsrf(
  sessionToken: string | undefined,
  headerToken: string | undefined,
): void {
  if (!sessionToken || !headerToken)
    throw Object.assign(new Error('csrf_missing'), { status: 403 });
  const a = Buffer.from(sessionToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw Object.assign(new Error('csrf_mismatch'), { status: 403 });
  }
}
