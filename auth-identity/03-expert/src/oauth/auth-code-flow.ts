import { randomBytes } from 'node:crypto';
import { generatePkce, type PkcePair } from './pkce.js';

export interface AuthCodeStart {
  authorizeUrl: string;
  state: string;
  nonce: string;
  pkce: PkcePair;
}

export interface AuthCodeConfig {
  issuer: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
}

/** Build Authorization Code + PKCE authorize URL (OIDC-compatible). */
export function startAuthCodeFlow(config: AuthCodeConfig): AuthCodeStart {
  const state = randomBytes(16).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');
  const pkce = generatePkce();

  const authorizeUrl = new URL(`${config.issuer}/protocol/openid-connect/auth`);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizeUrl.searchParams.set(
    'scope',
    (config.scopes ?? ['openid', 'profile', 'transfer:write']).join(' '),
  );
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('nonce', nonce);
  authorizeUrl.searchParams.set('code_challenge', pkce.challenge);
  authorizeUrl.searchParams.set('code_challenge_method', pkce.method);

  return { authorizeUrl: authorizeUrl.toString(), state, nonce, pkce };
}

export interface TokenResponse {
  access_token: string;
  id_token?: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

/**
 * Exchange authorization code at the token endpoint.
 * In demos without a real IdP, callers may mock fetch.
 */
export async function exchangeAuthorizationCode(params: {
  issuer: string;
  clientId: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
  clientSecret?: string;
  fetchImpl?: typeof fetch;
}): Promise<TokenResponse> {
  const fetchFn = params.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code: params.code,
    code_verifier: params.codeVerifier,
  });
  if (params.clientSecret) body.set('client_secret', params.clientSecret);

  const res = await fetchFn(`${params.issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token_exchange_failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<TokenResponse>;
}

/** Ensure callback query contains code+state only — never tokens. */
export function assertSafeCallbackQuery(query: URLSearchParams): void {
  for (const forbidden of ['access_token', 'id_token', 'refresh_token', 'token']) {
    if (query.has(forbidden)) {
      throw new Error(`token_leakage_vector: ${forbidden} in query string`);
    }
  }
  if (!query.get('code') || !query.get('state')) {
    throw new Error('invalid_callback');
  }
}
