import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyAccessToken } from '../auth/jwt.js';

export interface JwtAuthedRequest extends IncomingMessage {
  user?: { id: string; email: string };
}

export function requireJwt() {
  return async (req: JwtAuthedRequest, res: ServerResponse): Promise<boolean> => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'ต้องระบุ Bearer token' }));
      return false;
    }

    const token = header.slice('Bearer '.length).trim();
    try {
      const claims = verifyAccessToken(token);
      req.user = { id: claims.sub, email: claims.email };
      return true;
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'token ไม่ถูกต้องหรือหมดอายุ' }));
      return false;
    }
  };
}
