export interface OidcDiscovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}

const cache = new Map<string, { at: number; doc: OidcDiscovery }>();
const TTL_MS = 10 * 60 * 1000;

export async function discoverOidc(
  issuer: string,
  fetchImpl: typeof fetch = fetch,
): Promise<OidcDiscovery> {
  const base = issuer.replace(/\/$/, '');
  const cached = cache.get(base);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.doc;

  const res = await fetchImpl(`${base}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`discovery_failed: ${res.status}`);
  const doc = (await res.json()) as OidcDiscovery;
  cache.set(base, { at: Date.now(), doc });
  return doc;
}
