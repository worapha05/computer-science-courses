import jwt from 'jsonwebtoken';

export interface AccessTokenClaims {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

const DEFAULT_TTL = '15m';

function requireSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    // Demo fallback — NEVER use in production
    return 'dev-only-secret-change-me-32chars!!';
  }
  return secret;
}

export function issueAccessToken(
  claims: Omit<AccessTokenClaims, 'iat' | 'exp'>,
  expiresIn: string | number = DEFAULT_TTL,
): string {
  return jwt.sign(claims, requireSecret(), {
    algorithm: 'HS256',
    expiresIn,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const payload = jwt.verify(token, requireSecret(), {
    algorithms: ['HS256'],
  });

  if (typeof payload === 'string' || !payload.sub || typeof payload.email !== 'string') {
    throw new Error('Invalid token claims');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    iat: payload.iat,
    exp: payload.exp,
  };
}

/** Decode WITHOUT verification — for debugging only. */
export function decodeUnsafe(token: string): unknown {
  return jwt.decode(token, { complete: true });
}
