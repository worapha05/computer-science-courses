import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { hashPassword, verifyPassword } from './auth/password.js';
import { issueAccessToken, decodeUnsafe } from './auth/jwt.js';
import { MemorySessionStore, createSessionId, hashUserAgent } from './auth/session-store.js';
import { requireSession, type AuthedRequest } from './middleware/require-session.js';
import { requireJwt, type JwtAuthedRequest } from './middleware/require-jwt.js';
import { serializeCookie, clearCookie, parseCookies } from './utils/cookies.js';
import { randomId } from './utils/crypto.js';

interface User {
  id: string;
  email: string;
  passwordHash: string;
}

const users = new Map<string, User>(); // key = email lowercase
const sessions = new MemorySessionStore();
const checkSession = requireSession(sessions);
const checkJwt = requireJwt();
const PORT = Number(process.env.PORT ?? 3001);

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T;
}

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function genericAuthError(res: ServerResponse): void {
  send(res, 401, { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
}

async function handleRegister(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = body.email?.trim().toLowerCase();
  const password = body.password ?? '';

  if (!email || password.length < 8) {
    send(res, 400, { error: 'อีเมลหรือรหัสผ่านไม่ถูกต้องตามเงื่อนไข' });
    return;
  }
  if (users.has(email)) {
    // Anti-enumeration: same wording as login failure path when possible
    send(res, 409, { error: 'ไม่สามารถสร้างบัญชีได้' });
    return;
  }

  const user: User = {
    id: randomId(16),
    email,
    passwordHash: await hashPassword(password, 'bcrypt'),
  };
  users.set(email, user);
  send(res, 201, { id: user.id, email: user.email });
}

async function handleSessionLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = body.email?.trim().toLowerCase() ?? '';
  const user = users.get(email);

  if (!user || !(await verifyPassword(body.password ?? '', user.passwordHash))) {
    genericAuthError(res);
    return;
  }

  // Anti-fixation: destroy any pre-existing sid before issuing a new one
  const existingSid = parseCookies(req.headers.cookie).sid;
  if (existingSid) await sessions.destroy(existingSid);

  const sid = createSessionId();
  const now = Date.now();
  await sessions.create(sid, {
    userId: user.id,
    email: user.email,
    uaHash: hashUserAgent(req.headers['user-agent']),
    createdAt: now,
    lastSeenAt: now,
  });

  const cookie = serializeCookie('sid', sid, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax',
    path: '/',
    maxAge: 60 * 60,
  });

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': cookie,
  });
  res.end(JSON.stringify({ ok: true, mode: 'session' }));
}

async function handleJwtLogin(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readJson<{ email?: string; password?: string }>(req);
  const email = body.email?.trim().toLowerCase() ?? '';
  const user = users.get(email);

  if (!user || !(await verifyPassword(body.password ?? '', user.passwordHash))) {
    genericAuthError(res);
    return;
  }

  const accessToken = issueAccessToken({ sub: user.id, email: user.email });
  send(res, 200, {
    accessToken,
    tokenType: 'Bearer',
    expiresIn: 900,
    // decodeUnsafe is for teaching — do not trust this in auth decisions
    debugHeader: decodeUnsafe(accessToken),
  });
}

async function handleLogout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const sid = parseCookies(req.headers.cookie).sid;
  if (sid) await sessions.destroy(sid);
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Set-Cookie': clearCookie('sid'),
  });
  res.end(JSON.stringify({ ok: true }));
}

const server = createServer(async (req, res) => {
  try {
    const { method, url } = req;

    if (method === 'POST' && url === '/register') return handleRegister(req, res);
    if (method === 'POST' && url === '/login/session') return handleSessionLogin(req, res);
    if (method === 'POST' && url === '/login/jwt') return handleJwtLogin(req, res);
    if (method === 'POST' && url === '/logout/session') return handleLogout(req, res);

    if (method === 'GET' && url === '/me/session') {
      const ok = await checkSession(req as AuthedRequest, res);
      if (!ok) return;
      const user = (req as AuthedRequest).user!;
      return send(res, 200, { mode: 'session', user });
    }

    if (method === 'GET' && url === '/me/jwt') {
      const ok = await checkJwt(req as JwtAuthedRequest, res);
      if (!ok) return;
      const user = (req as JwtAuthedRequest).user!;
      return send(res, 200, { mode: 'jwt', user });
    }

    if (method === 'GET' && url === '/health') {
      return send(res, 200, { status: 'ok', level: 'beginner' });
    }

    send(res, 404, { error: 'ไม่พบเส้นทาง' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'ข้อผิดพลาดภายใน server' });
  }
});

server.listen(PORT, () => {
  console.log(`Beginner Auth demo listening on http://localhost:${PORT}`);
  console.log('Routes: POST /register | /login/session | /login/jwt | /logout/session');
  console.log('  GET /me/session | /me/jwt | /health');
});
