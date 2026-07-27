import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const STEP_SECONDS = 30;
const DIGITS = 6;

function base32Encode(buf: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of cleaned) {
    const idx = alphabet.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function hotp(secret: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export function buildOtpAuthUri(params: {
  secret: string;
  accountName: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
  const q = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}

export function generateTotp(secretBase32: string, at = Date.now()): string {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  return hotp(base32Decode(secretBase32), counter);
}

export function verifyTotp(
  secretBase32: string,
  code: string,
  at = Date.now(),
  window = 1,
): boolean {
  const counter = Math.floor(at / 1000 / STEP_SECONDS);
  const expectedBuffers = [] as Buffer[];
  for (let w = -window; w <= window; w++) {
    expectedBuffers.push(Buffer.from(hotp(base32Decode(secretBase32), counter + w)));
  }
  const provided = Buffer.from(code.padStart(DIGITS, '0'));
  return expectedBuffers.some(
    (exp) => exp.length === provided.length && timingSafeEqual(exp, provided),
  );
}

/** In-memory anti-replay for used TOTP codes within a time window. */
export class TotpReplayGuard {
  private readonly used = new Map<string, number>();

  consume(userId: string, code: string, ttlMs = 90_000): boolean {
    const key = `${userId}:${code}`;
    const now = Date.now();
    for (const [k, exp] of this.used) {
      if (exp < now) this.used.delete(k);
    }
    if (this.used.has(key)) return false;
    this.used.set(key, now + ttlMs);
    return true;
  }
}
