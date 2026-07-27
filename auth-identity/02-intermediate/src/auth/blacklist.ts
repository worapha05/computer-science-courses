import { sha256 } from '../utils/hash.js';

/** In-memory stand-in for Redis TTL blacklist of access-token JTIs. */
export class JtiBlacklist {
  private readonly entries = new Map<string, number>(); // jti -> expireAt ms

  put(jti: string, ttlSeconds: number): void {
    this.entries.set(jti, Date.now() + ttlSeconds * 1000);
  }

  has(jti: string): boolean {
    const exp = this.entries.get(jti);
    if (exp === undefined) return false;
    if (Date.now() > exp) {
      this.entries.delete(jti);
      return false;
    }
    return true;
  }

  /** Hash helper if you prefer not to store raw jti. */
  putHashed(jti: string, ttlSeconds: number): void {
    this.put(sha256(jti), ttlSeconds);
  }

  hasHashed(jti: string): boolean {
    return this.has(sha256(jti));
  }
}
