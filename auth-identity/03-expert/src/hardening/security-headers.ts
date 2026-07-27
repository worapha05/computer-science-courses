/** Baseline security headers for browser-facing auth apps. */
export function securityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy':
      "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'no-store',
  };
}
