import { createGoogleAuth, DRIVE_FILE_SCOPE, type GoogleOAuth2 } from './googleAuth';

type Answer = { response?: Record<string, unknown>; error?: { type: string }; scopesGranted?: boolean };

/** A stand-in for Google's sign-in library that answers each popup as told. */
function fakeLib(answer: Answer) {
  const requested: { clientId: string; scope: string; prompt?: string }[] = [];
  const revoked: string[] = [];
  const lib: GoogleOAuth2 = {
    initTokenClient: (config) => ({
      requestAccessToken: (overrides) => {
        requested.push({ clientId: config.client_id, scope: config.scope, prompt: overrides?.prompt });
        if (answer.error) config.error_callback?.(answer.error);
        else config.callback(answer.response ?? {});
      },
    }),
    hasGrantedAllScopes: () => answer.scopesGranted ?? true,
    revoke: (token, done) => {
      revoked.push(token);
      done?.();
    },
  };
  return { lib, requested, revoked };
}

describe('Google sign-in', () => {
  it('asks only for drive.file and keeps the token in memory until it expires', async () => {
    let now = 1_000_000;
    const { lib, requested } = fakeLib({ response: { access_token: 'tok', expires_in: 3599 } });
    const auth = createGoogleAuth('client-123', async () => lib, () => now);
    expect(auth.isSignedIn()).toBe(false);
    await expect(auth.getToken()).rejects.toMatchObject({ status: 401 });

    await auth.signIn();
    expect(requested).toEqual([{ clientId: 'client-123', scope: DRIVE_FILE_SCOPE, prompt: '' }]);
    expect(DRIVE_FILE_SCOPE).toBe('https://www.googleapis.com/auth/drive.file');
    expect(auth.isSignedIn()).toBe(true);
    expect(await auth.getToken()).toBe('tok');

    now += 3540 * 1000; // a minute before Google's expiry: treated as expired
    expect(auth.isSignedIn()).toBe(false);
    await expect(auth.getToken()).rejects.toMatchObject({ status: 401 });
  });

  it('reports a declined or closed sign-in as cancelled, and a blocked popup as an error', async () => {
    const declined = createGoogleAuth('c', async () => fakeLib({ response: { error: 'access_denied' } }).lib);
    await expect(declined.signIn()).rejects.toMatchObject({ cancelled: true });

    const closed = createGoogleAuth('c', async () => fakeLib({ error: { type: 'popup_closed' } }).lib);
    await expect(closed.signIn()).rejects.toMatchObject({ cancelled: true });

    const blocked = createGoogleAuth('c', async () => fakeLib({ error: { type: 'popup_failed_to_open' } }).lib);
    await expect(blocked.signIn()).rejects.toMatchObject({ cancelled: false, message: expect.stringMatching(/pop-ups/) });
    expect(blocked.isSignedIn()).toBe(false);
  });

  it('refuses a sign-in where the Drive permission was unticked', async () => {
    const auth = createGoogleAuth('c', async () => fakeLib({ response: { access_token: 't' }, scopesGranted: false }).lib);
    await expect(auth.signIn()).rejects.toMatchObject({ message: expect.stringMatching(/allow access/) });
    expect(auth.isSignedIn()).toBe(false);
  });

  it('revokes access on sign-out', async () => {
    const { lib, revoked } = fakeLib({ response: { access_token: 'tok', expires_in: 3600 } });
    const auth = createGoogleAuth('c', async () => lib);
    await auth.signIn();
    await auth.signOut();
    expect(revoked).toEqual(['tok']);
    expect(auth.isSignedIn()).toBe(false);
  });
});
