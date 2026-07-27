import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { startAuthCodeFlow, assertSafeCallbackQuery } from './oauth/auth-code-flow.js';
import { generatePkce, verifyPkce } from './oauth/pkce.js';
import {
  generateTotpSecret,
  buildOtpAuthUri,
  verifyTotp,
  generateTotp,
  TotpReplayGuard,
} from './mfa/totp.js';
import { evaluateZeroTrust, JtiReplayStore, type GatewayJwt } from './gateway/zero-trust.js';
import { createCsrfToken, assertCsrf } from './hardening/csrf.js';
import { securityHeaders } from './hardening/security-headers.js';
import { verifyIdToken } from './oidc/id-token.js';

const PORT = Number(process.env.PORT ?? 3003);
const ISSUER = process.env.OIDC_ISSUER ?? 'http://localhost:8080/realms/nexbank';
const AUD = process.env.API_AUDIENCE ?? 'nexbank-api';
const JWT_SECRET =
  process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    ? process.env.JWT_SECRET
    : 'dev-only-secret-change-me-32chars!!';

interface DemoSession {
  state?: string;
  nonce?: string;
  verifier?: string;
  csrf?: string;
  userId?: string;
  mfaSecret?: string;
  mfaEnrolled?: boolean;
  mfaRecentUntil?: number;
}

const sessions = new Map<string, DemoSession>();
const replayGuard = new TotpReplayGuard();
const jtiStore = new JtiReplayStore();
const denyIps = new Set<string>(['203.0.113.66']); // TEST-NET documentation IP

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as T;
}

function applySecurityHeaders(res: ServerResponse): void {
  for (const [k, v] of Object.entries(securityHeaders())) res.setHeader(k, v);
}

function send(res: ServerResponse, status: number, body: unknown): void {
  applySecurityHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function getSessionId(req: IncomingMessage): string {
  const cookie = req.headers.cookie ?? '';
  const match = cookie.match(/(?:^|;\s*)sid=([^;]+)/);
  return match?.[1] ?? '';
}

function ensureSession(
  req: IncomingMessage,
  res: ServerResponse,
): { sid: string; session: DemoSession } {
  let sid = getSessionId(req);
  if (!sid || !sessions.has(sid)) {
    sid = randomBytes(16).toString('base64url');
    sessions.set(sid, { csrf: createCsrfToken() });
    res.setHeader(
      'Set-Cookie',
      `sid=${sid}; HttpOnly; Path=/; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
    );
  }
  return { sid, session: sessions.get(sid)! };
}

function issueDemoAccessToken(session: DemoSession): string {
  return jwt.sign(
    {
      sub: session.userId ?? 'demo-user',
      iss: ISSUER,
      aud: AUD,
      scope: 'openid profile transfer:write',
      jti: randomBytes(12).toString('base64url'),
      acr: session.mfaRecentUntil && Date.now() < session.mfaRecentUntil ? '2' : '1',
      mfa_recent: !!(session.mfaRecentUntil && Date.now() < session.mfaRecentUntil),
    },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '10m' },
  );
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const { method } = req;

    if (method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { status: 'ok', level: 'expert' });
    }

    // --- PKCE login start (works with or without live Keycloak) ---
    if (method === 'GET' && url.pathname === '/oauth/start') {
      const { session } = ensureSession(req, res);
      const start = startAuthCodeFlow({
        issuer: ISSUER,
        clientId: 'nexbank-spa',
        redirectUri: `http://localhost:${PORT}/callback`,
        scopes: ['openid', 'profile', 'transfer:write'],
      });
      session.state = start.state;
      session.nonce = start.nonce;
      session.verifier = start.pkce.verifier;
      return send(res, 200, {
        authorizeUrl: start.authorizeUrl,
        note: 'เปิด authorizeUrl ใน browser เมื่อ Keycloak พร้อม หรือใช้ /oauth/mock-login สำหรับ demo offline',
        pkceMethod: start.pkce.method,
        state: start.state,
      });
    }

    // Offline mock login for classrooms without Keycloak
    if (method === 'POST' && url.pathname === '/oauth/mock-login') {
      const { session } = ensureSession(req, res);
      const body = await readJson<{ userId?: string }>(req);
      const pkce = generatePkce();
      session.verifier = pkce.verifier;
      session.state = randomBytes(8).toString('hex');
      session.nonce = randomBytes(8).toString('hex');
      session.userId = body.userId ?? 'alice';
      // Simulate successful code redemption locally
      const idToken = jwt.sign(
        {
          sub: session.userId,
          iss: ISSUER,
          aud: 'nexbank-spa',
          nonce: session.nonce,
          email: `${session.userId}@nexbank.test`,
        },
        JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '1h' },
      );
      verifyIdToken(idToken, {
        secretOrPublicKey: JWT_SECRET,
        expectedIss: ISSUER,
        expectedAud: 'nexbank-spa',
        expectedNonce: session.nonce,
      });
      const accessToken = issueDemoAccessToken(session);
      return send(res, 200, {
        accessToken,
        idToken,
        pkceSelfCheck: verifyPkce(pkce.verifier, pkce.challenge),
      });
    }

    if (method === 'GET' && url.pathname === '/callback') {
      try {
        assertSafeCallbackQuery(url.searchParams);
      } catch (e) {
        return send(res, 400, { error: (e as Error).message });
      }
      const { session } = ensureSession(req, res);
      const state = url.searchParams.get('state');
      if (!state || state !== session.state) return send(res, 400, { error: 'state_mismatch' });
      return send(res, 200, {
        ok: true,
        code: url.searchParams.get('code'),
        next: 'แลก code ที่ token endpoint ด้วย code_verifier (ดู exchangeAuthorizationCode)',
      });
    }

    // --- MFA enroll / verify ---
    if (method === 'POST' && url.pathname === '/mfa/enroll') {
      const { session } = ensureSession(req, res);
      session.userId ??= 'alice';
      const secret = generateTotpSecret();
      session.mfaSecret = secret;
      session.mfaEnrolled = false;
      return send(res, 200, {
        secret,
        otpauthUri: buildOtpAuthUri({
          secret,
          accountName: session.userId,
          issuer: 'NexBank',
        }),
        demoCurrentCode: generateTotp(secret),
      });
    }

    if (method === 'POST' && url.pathname === '/mfa/verify') {
      const { session } = ensureSession(req, res);
      const body = await readJson<{ code?: string }>(req);
      if (!session.mfaSecret) return send(res, 400, { error: 'not_enrolled' });
      if (!verifyTotp(session.mfaSecret, body.code ?? '')) {
        return send(res, 401, { error: 'invalid_totp' });
      }
      if (!replayGuard.consume(session.userId ?? 'anon', body.code ?? '')) {
        return send(res, 401, { error: 'totp_replay' });
      }
      session.mfaEnrolled = true;
      session.mfaRecentUntil = Date.now() + 5 * 60 * 1000;
      return send(res, 200, { ok: true, stepUpMs: 5 * 60 * 1000 });
    }

    // --- CSRF demo for cookie session forms ---
    if (method === 'GET' && url.pathname === '/csrf') {
      const { session } = ensureSession(req, res);
      session.csrf ??= createCsrfToken();
      return send(res, 200, { csrfToken: session.csrf });
    }

    // --- Zero-Trust transfer API ---
    if (method === 'POST' && url.pathname === '/transfers') {
      const { session } = ensureSession(req, res);
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) return send(res, 401, { error: 'unauthenticated' });

      let payload: GatewayJwt;
      try {
        payload = jwt.verify(header.slice(7), JWT_SECRET, {
          algorithms: ['HS256'],
        }) as GatewayJwt;
      } catch {
        return send(res, 401, { error: 'invalid_token' });
      }

      // Prefer gateway-evaluated mfa_recent from token; also accept live session step-up
      if (session.mfaRecentUntil && Date.now() < session.mfaRecentUntil) {
        payload = { ...payload, mfa_recent: true, acr: '2' };
      }

      const decision = evaluateZeroTrust({
        payload,
        policy: {
          path: '/transfers',
          method: 'POST',
          requiredScope: 'transfer:write',
          requiresMfa: true,
          minAcr: '2',
        },
        expectedIss: ISSUER,
        expectedAud: AUD,
        clientIp: req.socket.remoteAddress ?? '',
        denyIps,
        jtiStore,
      });

      if (!decision.allow) return send(res, 403, { error: 'forbidden', reason: decision.reason });

      // Optional CSRF check when using cookie session alongside bearer
      try {
        assertCsrf(session.csrf, String(req.headers['x-csrf-token'] ?? ''));
      } catch (e) {
        const err = e as Error & { status?: number };
        return send(res, err.status ?? 403, { error: err.message });
      }

      const body = await readJson<{ amount?: number; to?: string }>(req);
      return send(res, 200, {
        ok: true,
        transferId: randomBytes(8).toString('hex'),
        amount: body.amount ?? 0,
        to: body.to ?? 'unknown',
      });
    }

    send(res, 404, { error: 'ไม่พบเส้นทาง' });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: 'ข้อผิดพลาดภายใน server' });
  }
});

server.listen(PORT, () => {
  console.log(`Expert Auth demo on http://localhost:${PORT}`);
  console.log(
    'Try: GET /oauth/start | POST /oauth/mock-login | POST /mfa/enroll | POST /transfers',
  );
});
