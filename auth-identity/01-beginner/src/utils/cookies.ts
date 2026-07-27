export type SameSite = 'Strict' | 'Lax' | 'None';

export interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: SameSite;
  path?: string;
  maxAge?: number;
  domain?: string;
}

/** Serialize a Set-Cookie header value with security-focused defaults. */
export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(options.maxAge)}`);
  if (options.domain) parts.push(`Domain=${options.domain}`);
  parts.push(`Path=${options.path ?? '/'}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

/** Clear cookie by expiring immediately. */
export function clearCookie(name: string, path = '/'): string {
  return serializeCookie(name, '', { path, maxAge: 0, httpOnly: true, sameSite: 'Lax' });
}

/** Minimal Cookie header parser. */
export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const [rawKey, ...rest] = part.trim().split('=');
      return [rawKey, decodeURIComponent(rest.join('=') || '')];
    }),
  );
}
