import { DRIVE_SCOPE } from '../../config';

export const REDIRECT_STATE_SESSION_KEY = 'feeledger_auth';
export const DRIVE_FILE_SCOPE = DRIVE_SCOPE;

export function generateOAuthState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function matchesOAuthState(returnedState: string | null, expectedState: string | null): boolean {
  return !!returnedState && !!expectedState && returnedState === expectedState;
}

export function parseOAuthRedirect(
  hash: string,
  expectedState: string | null,
): { accepted: boolean; accessToken: string | null; expiresIn: number | null; error: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const returnedStates = params.getAll('state');
  const accepted = returnedStates.length === 1
    && matchesOAuthState(returnedStates[0], expectedState);

  return {
    accepted,
    accessToken: accepted ? params.get('access_token') : null,
    expiresIn: accepted ? Number(params.get('expires_in')) || null : null,
    error: accepted ? params.get('error') : null,
  };
}

export async function verifyGoogleAccessToken(
  token: string,
  clientId: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = new URL('https://oauth2.googleapis.com/tokeninfo');
  url.searchParams.set('access_token', token);

  const response = await fetcher(url);
  if (!response.ok) throw new Error('Google token verification failed.');

  const info = await response.json() as { aud?: string; scope?: string };
  const scopes = info.scope?.split(/\s+/) ?? [];
  if (info.aud !== clientId || !scopes.includes(DRIVE_FILE_SCOPE)) {
    throw new Error('Google token does not have the required app audience and Drive access.');
  }
}

export async function finalizeSignOut(
  removeLocalData: boolean,
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'> = localStorage,
  resetDatabase: () => Promise<void> = async () => {
    const { deleteAndRecreateDB } = await import('../../db/indexeddb/database');
    await deleteAndRecreateDB();
  },
): Promise<void> {
  const keysToRemove: string[] = [];
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (key?.startsWith('fl_')) keysToRemove.push(key);
  }
  keysToRemove.forEach(key => storage.removeItem(key));

  if (removeLocalData) await resetDatabase();
}
