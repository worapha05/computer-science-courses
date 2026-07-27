import { randomBytes } from 'node:crypto';
import { sha256 } from '../utils/hash.js';

export interface RefreshRecord {
  userId: string;
  familyId: string;
  used: boolean;
  revoked: boolean;
  expiresAt: number;
}

export class RefreshTokenStore {
  private readonly byHash = new Map<string, RefreshRecord>();
  private readonly familyIndex = new Map<string, Set<string>>(); // familyId -> hashes

  issue(userId: string, familyId: string, ttlSeconds: number): string {
    const raw = randomBytes(48).toString('base64url');
    const hash = sha256(raw);
    const record: RefreshRecord = {
      userId,
      familyId,
      used: false,
      revoked: false,
      expiresAt: Date.now() + ttlSeconds * 1000,
    };
    this.byHash.set(hash, record);
    const set = this.familyIndex.get(familyId) ?? new Set<string>();
    set.add(hash);
    this.familyIndex.set(familyId, set);
    return raw;
  }

  get(raw: string): RefreshRecord | undefined {
    const record = this.byHash.get(sha256(raw));
    if (!record) return undefined;
    if (Date.now() > record.expiresAt) {
      this.byHash.delete(sha256(raw));
      return undefined;
    }
    return record;
  }

  markUsed(raw: string): void {
    const hash = sha256(raw);
    const record = this.byHash.get(hash);
    if (record) record.used = true;
  }

  revokeFamily(familyId: string): void {
    const hashes = this.familyIndex.get(familyId);
    if (!hashes) return;
    for (const hash of hashes) {
      const rec = this.byHash.get(hash);
      if (rec) rec.revoked = true;
    }
  }
}

export function newFamilyId(): string {
  return randomBytes(16).toString('base64url');
}
