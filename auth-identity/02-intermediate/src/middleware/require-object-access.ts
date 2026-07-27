import type { ServerResponse } from 'node:http';
import { canReadInvoice } from '../access-control/abac.js';
import type { AuthedRequest } from './authenticate.js';

export interface Invoice {
  id: string;
  ownerId: string;
  department: string;
  amount: number;
  title: string;
}

/**
 * Object-level authorization middleware factory.
 * Returns 404 on deny to reduce resource enumeration (policy choice).
 */
export function requireInvoiceReadAccess(load: (id: string) => Invoice | undefined) {
  return (req: AuthedRequest, res: ServerResponse, invoiceId: string): Invoice | null => {
    if (!req.user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthenticated' }));
      return null;
    }

    const invoice = load(invoiceId);
    if (!invoice) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return null;
    }

    const allowed = canReadInvoice(
      {
        id: req.user.sub,
        roles: req.user.roles,
        department: req.user.department,
      },
      invoice,
    );

    if (!allowed) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'not_found' }));
      return null;
    }

    return invoice;
  };
}
