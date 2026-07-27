import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TokenService, AccessClaims } from '../auth/tokens.js';

export interface AuthedRequest extends IncomingMessage {
  user?: AccessClaims;
  rawAccessToken?: string;
}

export function authenticate(tokens: TokenService) {
  return (req: AuthedRequest, res: ServerResponse): boolean => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthenticated' }));
      return false;
    }
    const raw = header.slice(7).trim();
    try {
      req.user = tokens.verifyAccess(raw);
      req.rawAccessToken = raw;
      return true;
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid_or_revoked_token' }));
      return false;
    }
  };
}
