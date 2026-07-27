export interface ClientCredentialsConfig {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
}

export async function fetchClientCredentialsToken(
  config: ClientCredentialsConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<{ access_token: string; expires_in: number; token_type: string }> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  if (config.scope) body.set('scope', config.scope);

  const res = await fetchImpl(config.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    throw new Error(`client_credentials_failed: ${res.status}`);
  }
  return res.json() as Promise<{ access_token: string; expires_in: number; token_type: string }>;
}
