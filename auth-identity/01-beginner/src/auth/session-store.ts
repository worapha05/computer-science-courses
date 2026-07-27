import { randomId, sha256Hex } from '../utils/crypto.js';

export interface SessionRecord {
  userId: string;
  email: string;
  uaHash: string;
  createdAt: number;
  lastSeenAt: number;
}

export interface SessionStore {
  create(sid: string, record: SessionRecord): Promise<void>;
  get(sid: string): Promise<SessionRecord | undefined>;
  touch(sid: string): Promise<void>;
  destroy(sid: string): Promise<void>;
}

/** In-memory store for demos. Swap with Redis in Intermediate+. */
export class MemorySessionStore implements SessionStore {
  private readonly store = new Map<string, SessionRecord>();

  async create(sid: string, record: SessionRecord): Promise<void> {
    this.store.set(sid, record);
  }

  async get(sid: string): Promise<SessionRecord | undefined> {
    return this.store.get(sid);
  }

  async touch(sid: string): Promise<void> {
    const record = this.store.get(sid);
    if (record) {
      record.lastSeenAt = Date.now();
      this.store.set(sid, record);
    }
  }

  async destroy(sid: string): Promise<void> {
    this.store.delete(sid);
  }
}

export const ABSOLUTE_TTL_MS = 60 * 60 * 1000; // 1 hour
export const IDLE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function createSessionId(): string {
  return randomId(32);
}

export function hashUserAgent(ua: string | undefined): string {
  return sha256Hex(ua ?? 'unknown');
}

export function isSessionExpired(record: SessionRecord, now = Date.now()): boolean {
  if (now - record.createdAt > ABSOLUTE_TTL_MS) return true;
  if (now - record.lastSeenAt > IDLE_TTL_MS) return true;
  return false;
}
