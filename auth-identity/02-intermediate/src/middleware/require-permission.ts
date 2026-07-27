import type { ServerResponse } from 'node:http';
import { hasPermission } from '../access-control/rbac.js';
import type { AuthedRequest } from './authenticate.js';

export function requirePermission(needed: string) {
  return (req: AuthedRequest, res: ServerResponse): boolean => {
    if (!req.user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthenticated' }));
      return false;
    }
    if (!hasPermission(req.user.roles, needed)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'forbidden', needed }));
      return false;
    }
    return true;
  };
}
