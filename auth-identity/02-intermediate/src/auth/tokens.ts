import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { JtiBlacklist } from './blacklist.js';
import { RefreshTokenStore, newFamilyId } from './refresh-store.js';

export interface AccessClaims {
  sub: string;
  email: string;
  roles: string[];
  jti: string;
  sid: string;
  iat?: number;
  exp?: number;
  mfa?: boolean;
  department?: string;
  refundLimit?: number;
}

const ACCESS_TTL_SEC = 10 * 60; // 10 minutes
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60;

function secret(): string {
  return process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32
    ? process.env.JWT_SECRET
    : 'dev-only-secret-change-me-32chars!!';
}

export class TokenService {
  constructor(
    private readonly refreshStore: RefreshTokenStore,
    private readonly blacklist: JtiBlacklist,
  ) {}

  issuePair(
    user: {
      id: string;
      email: string;
      roles: string[];
      mfa?: boolean;
      department?: string;
      refundLimit?: number;
    },
    familyId = newFamilyId(),
  ) {
    const jti = randomBytes(16).toString('base64url');
    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        roles: user.roles,
        jti,
        sid: familyId,
        mfa: user.mfa ?? false,
        department: user.department,
        refundLimit: user.refundLimit,
      } satisfies AccessClaims,
      secret(),
      { algorithm: 'HS256', expiresIn: ACCESS_TTL_SEC },
    );

    const refreshToken = this.refreshStore.issue(user.id, familyId, REFRESH_TTL_SEC);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: ACCESS_TTL_SEC,
      familyId,
    };
  }

  verifyAccess(token: string): AccessClaims {
    const payload = jwt.verify(token, secret(), { algorithms: ['HS256'] }) as AccessClaims;
    if (!payload.jti) {
      throw new Error('invalid_token');
    }
    if (this.blacklist.has(payload.jti)) {
      throw new Error('token_revoked');
    }
    return payload;
  }

  refresh(
    rawRefresh: string,
    loadUser: (userId: string) =>
      | {
          id: string;
          email: string;
          roles: string[];
          mfa?: boolean;
          department?: string;
          refundLimit?: number;
        }
      | undefined,
  ) {
    const record = this.refreshStore.get(rawRefresh);

    if (!record) {
      const err = new Error('invalid_grant');
      (err as Error & { status: number }).status = 401;
      throw err;
    }

    if (record.used || record.revoked) {
      this.refreshStore.revokeFamily(record.familyId);
      const err = new Error('refresh_reuse_detected');
      (err as Error & { status: number }).status = 401;
      throw err;
    }

    this.refreshStore.markUsed(rawRefresh);
    const user = loadUser(record.userId);
    if (!user) {
      const err = new Error('invalid_grant');
      (err as Error & { status: number }).status = 401;
      throw err;
    }

    return this.issuePair(user, record.familyId);
  }

  logout(accessToken: string, refreshToken?: string): void {
    try {
      const payload = jwt.verify(accessToken, secret(), {
        algorithms: ['HS256'],
        ignoreExpiration: true,
      }) as AccessClaims;

      if (payload.jti && payload.exp) {
        const ttl = payload.exp - Math.floor(Date.now() / 1000);
        if (ttl > 0) this.blacklist.put(payload.jti, ttl);
      }
      if (payload.sid) this.refreshStore.revokeFamily(payload.sid);
    } catch {
      // still try refresh-based revoke below
    }

    if (refreshToken) {
      const rec = this.refreshStore.get(refreshToken);
      if (rec) this.refreshStore.revokeFamily(rec.familyId);
    }
  }
}
