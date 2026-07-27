import jwt from 'jsonwebtoken';

export interface IdTokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  nonce?: string;
  email?: string;
  acr?: string;
  amr?: string[];
}

/**
 * Educational ID Token verifier.
 * Production systems should fetch JWKS and verify RS256/ES256.
 * This demo supports a shared HS256 secret for local labs without Keycloak.
 */
export function verifyIdToken(
  token: string,
  options: {
    secretOrPublicKey: string;
    expectedIss: string;
    expectedAud: string;
    expectedNonce?: string;
    algorithms?: jwt.Algorithm[];
  },
): IdTokenClaims {
  const payload = jwt.verify(token, options.secretOrPublicKey, {
    algorithms: options.algorithms ?? ['HS256'],
    issuer: options.expectedIss,
    audience: options.expectedAud,
  }) as IdTokenClaims;

  if (options.expectedNonce) {
    if (!payload.nonce || payload.nonce !== options.expectedNonce) {
      throw new Error('nonce_mismatch');
    }
  }

  return payload;
}

/**
 * Reminder helper used in labs — ID tokens are for the client, not the API.
 */
export function assertNotUsedAsApiCredential(headerName: string | undefined): void {
  if (headerName?.toLowerCase() === 'x-id-token') {
    throw new Error('anti-pattern: do not send id_token to resource servers');
  }
}
