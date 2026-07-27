export interface GatewayJwt {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  scope?: string;
  scp?: string[] | string;
  jti?: string;
  acr?: string;
  mfa_recent?: boolean;
}

export interface RoutePolicy {
  path: string;
  method: string;
  requiredScope?: string;
  requiresMfa?: boolean;
  minAcr?: string;
}

export type GatewayDecision = { allow: true } | { allow: false; reason: string };

export class JtiReplayStore {
  private readonly seen = new Map<string, number>();

  mark(jti: string, ttlSeconds: number): void {
    this.seen.set(jti, Date.now() + ttlSeconds * 1000);
  }

  has(jti: string): boolean {
    const exp = this.seen.get(jti);
    if (!exp) return false;
    if (Date.now() > exp) {
      this.seen.delete(jti);
      return false;
    }
    return true;
  }
}

function audienceIncludes(aud: string | string[], expected: string): boolean {
  return Array.isArray(aud) ? aud.includes(expected) : aud === expected;
}

function tokenScopes(payload: GatewayJwt): Set<string> {
  const set = new Set<string>();
  if (typeof payload.scope === 'string') {
    for (const s of payload.scope.split(/\s+/)) if (s) set.add(s);
  }
  if (Array.isArray(payload.scp)) for (const s of payload.scp) set.add(s);
  if (typeof payload.scp === 'string') set.add(payload.scp);
  return set;
}

export function evaluateZeroTrust(params: {
  payload: GatewayJwt;
  policy: RoutePolicy;
  expectedIss: string;
  expectedAud: string;
  clientIp: string;
  denyIps: Set<string>;
  jtiStore: JtiReplayStore;
  nowSeconds?: number;
}): GatewayDecision {
  const now = params.nowSeconds ?? Math.floor(Date.now() / 1000);
  const { payload, policy } = params;

  if (params.denyIps.has(params.clientIp)) return { allow: false, reason: 'risk_ip' };
  if (payload.iss !== params.expectedIss) return { allow: false, reason: 'bad_iss' };
  if (!audienceIncludes(payload.aud, params.expectedAud))
    return { allow: false, reason: 'bad_aud' };
  if (payload.exp <= now) return { allow: false, reason: 'expired' };

  if (policy.requiredScope) {
    const scopes = tokenScopes(payload);
    if (!scopes.has(policy.requiredScope)) return { allow: false, reason: 'scope' };
  }

  if (policy.requiresMfa) {
    const acrOk = policy.minAcr ? Number(payload.acr ?? 0) >= Number(policy.minAcr) : false;
    if (!payload.mfa_recent && !acrOk) return { allow: false, reason: 'step_up' };
  }

  if (payload.jti) {
    if (params.jtiStore.has(payload.jti)) return { allow: false, reason: 'replay' };
    params.jtiStore.mark(payload.jti, Math.max(1, payload.exp - now));
  }

  return { allow: true };
}
