import sql from '@/app/api/utils/sql';

/**
 * Get MVSOUL API credentials from the settings table.
 */
export async function getMvsoulCredentials() {
  const rows = await sql`
    SELECT setting_key, setting_value FROM settings
    WHERE setting_key IN ('mvsoul_api_user', 'mvsoul_api_password', 'mvsoul_api_url')
  `;

  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.setting_key as string] = row.setting_value as string;
  }

  return {
    apiUser: map.mvsoul_api_user || '',
    apiPassword: map.mvsoul_api_password || '',
    apiUrl: map.mvsoul_api_url || 'https://rede.hospitalprontocardio.com.br:9058/',
  };
}

/**
 * Authenticate with the MVSOUL API and return an access token.
 */
export async function getMvsoulToken(
  apiUrl: string,
  apiUser: string,
  apiPassword: string
): Promise<string> {
  const authResponse = await fetch(`${apiUrl}api/auth/token/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      username: apiUser,
      password: apiPassword,
    }),
  });

  if (!authResponse.ok) {
    const errorText = await authResponse.text();
    throw new Error(`MVSOUL auth failed (${authResponse.status}): ${errorText.substring(0, 200)}`);
  }

  const authData = (await authResponse.json()) as { access?: string };
  if (!authData.access) {
    throw new Error('MVSOUL auth did not return an access token');
  }

  return authData.access;
}
