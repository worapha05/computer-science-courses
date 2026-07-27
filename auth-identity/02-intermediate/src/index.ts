import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';

import { TokenService } from './auth/tokens.js';
import { RefreshTokenStore } from './auth/refresh-store.js';
import { JtiBlacklist } from './auth/blacklist.js';
import { authenticate, type AuthedRequest } from './middleware/authenticate.js';
import { requirePermission } from './middleware/require-permission.js';
import { requireInvoiceReadAccess, type Invoice } from './middleware/require-object-access.js';
import { evaluateRefundPolicy } from './access-control/abac.js';
import { expandRolesToPermissions } from './access-control/rbac.js';
import { PERMISSIONS } from './access-control/permissions.js';

interface DemoUser {
  id: string;
  email: string;
  password: string; // demo only — plaintext for simplicity of the sample DB
  roles: string[];
  department: string;
  refundLimit: number;
  mfa: boolean;
}

const users: DemoUser[] = [
  {
    id: 'u_alice',
    email: 'viewer@shop.test',
    password: 'password123',
    roles: ['viewer'],
    department: 'sales',
    refundLimit: 0,
    mfa: false,
  },
  {
    id: 'u_bob',
    email: 'editor@shop.test',
    password: 'password123',
    roles: ['accountant'],
    department: 'sales',
    refundLimit: 0,
    mfa: false,
  },
  {
    id: 'u_cara',
    email: 'finance@shop.test',
    password: 'password123',
    roles: ['finance_manager'],
    department: 'sales',
    refundLimit: 50_000,
    mfa: true,
  },
  {
    id: 'u_root',
    email: 'admin@shop.test',
    password: 'password123',
    roles: ['admin'],
    department: 'hq',
    refundLimit: 1_000_000,
    mfa: true,
  },
];

const invoices = new Map<string, Invoice>([
  [
    'inv_1',
    { id: 'inv_1', ownerId: 'u_alice', department: 'sales', amount: 1200, title: 'Alice laptop' },
  ],
  [
    'inv_2',
    { id: 'inv_2', ownerId: 'u_bob', department: 'sales', amount: 8000, title: 'Bob travel' },
  ],
  [
    'inv_3',
    { id: 'inv_3', ownerId: 'u_cara', department: 'finance', amount: 42000, title: 'Cara vendor' },
  ],
]);

const auditLog: Array<Record<string, unknown>> = [];
const tokens = new TokenService(new RefreshTokenStore(), new JtiBlacklist());
const checkAuth = authenticate(tokens);
const needRead = requirePermission(PERMISSIONS.INVOICES_READ);
const needWrite = requirePermission(PERMISSIONS.INVOICES_WRITE);
const loadInvoiceSecure = requireInvoiceReadAccess((id) => invoices.get(id));
const PORT = Number(process.env.PORT ?? 3002);

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function findUser(email: string): DemoUser | undefined {
  return users.find((u) => u.email === email);
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const { method } = req;

    if (method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { status: 'ok', level: 'intermediate' });
    }

    if (method === 'POST' && url.pathname === '/auth/login') {
      const body = await readJson<{ email?: string; password?: string }>(req);
      const user = findUser(body.email ?? '');
      if (!user || user.password !== body.password) {
        return send(res, 401, { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      }
      const pair = tokens.issuePair(user);
      return send(res, 200, pair);
    }

    if (method === 'POST' && url.pathname === '/auth/refresh') {
      const body = await readJson<{ refreshToken?: string }>(req);
      try {
        const pair = tokens.refresh(body.refreshToken ?? '', (id) =>
          users.find((u) => u.id === id),
        );
        return send(res, 200, pair);
      } catch (e) {
        const err = e as Error & { status?: number };
        return send(res, err.status ?? 401, { error: err.message });
      }
    }

    if (method === 'POST' && url.pathname === '/auth/logout') {
      const authed = req as AuthedRequest;
      if (!checkAuth(authed, res)) return;
      const body = await readJson<{ refreshToken?: string }>(req).catch(
        () => ({}) as { refreshToken?: string },
      );
      tokens.logout(authed.rawAccessToken!, body.refreshToken);
      return send(res, 200, { ok: true });
    }

    if (method === 'GET' && url.pathname === '/invoices') {
      const authed = req as AuthedRequest;
      if (!checkAuth(authed, res) || !needRead(authed, res)) return;
      const list = [...invoices.values()].filter((inv) => canList(authed.user!, inv));
      return send(res, 200, { items: list });
    }

    if (method === 'POST' && url.pathname === '/invoices') {
      const authed = req as AuthedRequest;
      if (!checkAuth(authed, res) || !needWrite(authed, res)) return;
      const body = await readJson<{ title?: string; amount?: number }>(req);
      const id = `inv_${randomBytes(4).toString('hex')}`;
      const invoice: Invoice = {
        id,
        ownerId: authed.user!.sub,
        department: authed.user!.department ?? 'sales',
        amount: body.amount ?? 0,
        title: body.title ?? 'untitled',
      };
      invoices.set(id, invoice);
      return send(res, 201, invoice);
    }

    const invoiceMatch = url.pathname.match(/^\/invoices\/([^/]+)$/);
    if (method === 'GET' && invoiceMatch) {
      const authed = req as AuthedRequest;
      if (!checkAuth(authed, res) || !needRead(authed, res)) return;
      const invoice = loadInvoiceSecure(authed, res, invoiceMatch[1]);
      if (!invoice) return;
      if (authed.user!.roles.includes('admin')) {
        auditLog.push({
          actor: authed.user!.sub,
          action: 'invoice.read',
          id: invoice.id,
          at: new Date().toISOString(),
        });
      }
      return send(res, 200, invoice);
    }

    const refundMatch = url.pathname.match(/^\/invoices\/([^/]+)\/refund$/);
    if (method === 'POST' && refundMatch) {
      const authed = req as AuthedRequest;
      if (!checkAuth(authed, res)) return;
      const invoice = invoices.get(refundMatch[1]);
      if (!invoice) return send(res, 404, { error: 'not_found' });

      const decision = evaluateRefundPolicy(
        {
          id: authed.user!.sub,
          roles: authed.user!.roles,
          permissions: [...expandRolesToPermissions(authed.user!.roles)],
          department: authed.user!.department ?? '',
          refundLimit: authed.user!.refundLimit ?? 0,
          mfa: authed.user!.mfa ?? false,
        },
        { type: 'invoice', ...invoice },
        { now: new Date() },
      );

      if (!decision.allow) return send(res, 403, { error: 'forbidden', reason: decision.reason });
      auditLog.push({ actor: authed.user!.sub, action: 'invoice.refund', id: invoice.id });
      return send(res, 200, { ok: true, refunded: invoice.id, amount: invoice.amount });
    }

    if (method === 'GET' && url.pathname === '/audit') {
      const authed = req as AuthedRequest;
      if (!checkAuth(authed, res)) return;
      if (!authed.user!.roles.includes('admin')) return send(res, 403, { error: 'forbidden' });
      return send(res, 200, { items: auditLog });
    }

    send(res, 404, { error: 'ไม่พบเส้นทาง' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'ข้อผิดพลาดภายใน server' });
  }
});

function canList(
  user: { sub: string; roles: string[]; department?: string },
  inv: Invoice,
): boolean {
  if (user.roles.includes('admin')) return true;
  if (inv.ownerId === user.sub) return true;
  if (
    (user.roles.includes('accountant') || user.roles.includes('finance_manager')) &&
    user.department === inv.department
  ) {
    return true;
  }
  return false;
}

server.listen(PORT, () => {
  console.log(`Intermediate Auth demo on http://localhost:${PORT}`);
  console.log('Users: viewer@ / editor@ / finance@ / admin@ shop.test password: password123');
});
