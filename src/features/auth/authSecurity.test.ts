import { describe, expect, it, vi } from 'vitest';
import {
  DRIVE_FILE_SCOPE,
  finalizeSignOut,
  generateOAuthState,
  matchesOAuthState,
  parseOAuthRedirect,
  verifyGoogleAccessToken,
} from './authSecurity';

describe('OAuth security helpers', () => {
  it('generates a 128-bit state value', () => {
    expect(generateOAuthState()).toMatch(/^[a-f0-9]{32}$/);
  });

  it('accepts only a present redirect state that exactly matches the expected state', () => {
    expect(matchesOAuthState('random-state', 'random-state')).toBe(true);
    expect(matchesOAuthState('attacker-state', 'random-state')).toBe(false);
    expect(matchesOAuthState(null, 'random-state')).toBe(false);
    expect(matchesOAuthState('random-state', null)).toBe(false);
  });

  it('only accepts redirect tokens when the returned state matches', () => {
    expect(parseOAuthRedirect('#state=right&access_token=token', 'right')).toMatchObject({
      accepted: true,
      accessToken: 'token',
    });
    expect(parseOAuthRedirect('#state=wrong&access_token=attacker', 'right')).toMatchObject({
      accepted: false,
      accessToken: null,
    });
    expect(parseOAuthRedirect('#access_token=attacker', 'right')).toMatchObject({
      accepted: false,
      accessToken: null,
    });
  });

  it('accepts a token only for this client and the Drive file scope', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      aud: 'client-id',
      scope: `openid ${DRIVE_FILE_SCOPE}`,
    }), { status: 200 }));

    await expect(verifyGoogleAccessToken('token', 'client-id', fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({
      href: 'https://oauth2.googleapis.com/tokeninfo?access_token=token',
    }));
  });

  it('rejects a token with a mismatched audience or missing Drive scope', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      aud: 'another-client',
      scope: 'openid',
    }), { status: 200 }));

    await expect(verifyGoogleAccessToken('token', 'client-id', fetcher))
      .rejects.toThrow('required app audience and Drive access');
  });
});

describe('sign-out cleanup', () => {
  function memoryStorage(initial: Record<string, string>) {
    const values = new Map(Object.entries(initial));
    return {
      get length() { return values.size; },
      key(index: number) { return [...values.keys()][index] ?? null; },
      removeItem(key: string) { values.delete(key); },
      values,
    };
  }

  it('clears every fl_* key and optionally resets the database', async () => {
    const storage = memoryStorage({
      fl_user: 'user',
      fl_token: 'legacy-token',
      fl_pwa_dismissed: 'dismissed',
      unrelated: 'keep',
    });
    const resetDatabase = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    await finalizeSignOut(false, storage, resetDatabase);
    expect([...storage.values.keys()]).toEqual(['unrelated']);
    expect(resetDatabase).not.toHaveBeenCalled();

    storage.values.set('fl_user', 'user');
    await finalizeSignOut(true, storage, resetDatabase);
    expect([...storage.values.keys()]).toEqual(['unrelated']);
    expect(resetDatabase).toHaveBeenCalledOnce();
  });
});
