import type { IncomingMessage, ServerResponse } from 'node:http';
import { type SessionStore, hashUserAgent, isSessionExpired } from '../auth/session-store.js';
import { parseCookies } from '../utils/cookies.js';

export interface AuthedRequest extends IncomingMessage {
  sessionId?: string;
  user?: { id: string; email: string };
}

export function requireSession(store: SessionStore) {
  return async (req: AuthedRequest, res: ServerResponse): Promise<boolean> => {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies.sid;

    if (!sid) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ไม่ได้เข้าสู่ระบบ' }));
      return false;
    }

    const session = await store.get(sid);
    if (!session || isSessionExpired(session)) {
      if (session) await store.destroy(sid);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'session หมดอายุหรือไม่พบ' }));
      return false;
    }

    // Soft binding: reject on User-Agent mismatch (session hijacking signal)
    const uaHash = hashUserAgent(req.headers['user-agent']);
    if (session.uaHash !== uaHash) {
      await store.destroy(sid);
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'session ไม่ตรงกับอุปกรณ์ (binding mismatch)' }));
      return false;
    }

    await store.touch(sid);
    req.sessionId = sid;
    req.user = { id: session.userId, email: session.email };
    return true;
  };
}
