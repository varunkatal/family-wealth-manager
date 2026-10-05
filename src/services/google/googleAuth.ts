/**
 * Google sign-in in the browser (Google Identity Services, token flow).
 * Asks only for `drive.file`: access to files this app creates, nothing else in the user's Drive.
 * There is no client secret and no server; the access token lives in memory only (never stored),
 * and expires after about an hour.
 */
import { GoogleApiError, type TokenProvider } from './sheetsClient';

export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const GIS_SRC = 'https://accounts.google.com/gsi/client';

/** The public OAuth Client ID from the build environment, or null if Google is not set up. */
export function googleClientId(): string | null {
  const id = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  return id ? id : null;
}

type TokenResponse = { access_token?: string; expires_in?: number | string; scope?: string; error?: string; error_description?: string };
type TokenClient = { requestAccessToken: (overrides?: { prompt?: string }) => void };
/** The small part of the Google Identity Services library this app uses. */
export type GoogleOAuth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => TokenClient;
  hasGrantedAllScopes: (response: TokenResponse, scope: string) => boolean;
  revoke: (token: string, done?: () => void) => void;
};

let gisPromise: Promise<GoogleOAuth2> | null = null;

/** Loads Google's sign-in library once, from Google. */
export function loadGoogleIdentity(): Promise<GoogleOAuth2> {
  const existing = (window as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }).google?.accounts?.oauth2;
  if (existing) return Promise.resolve(existing);
  gisPromise ??= new Promise<GoogleOAuth2>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => {
      const lib = (window as { google?: { accounts?: { oauth2?: GoogleOAuth2 } } }).google?.accounts?.oauth2;
      if (lib) resolve(lib);
      else reject(new Error('Google sign-in did not load.'));
    };
    script.onerror = () => {
      gisPromise = null;
      reject(new Error('Could not reach Google. Check your internet connection.'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

export class SignInError extends Error {
  constructor(
    message: string,
    /** The user closed the popup or declined; not worth an error banner. */
    readonly cancelled = false,
  ) {
    super(message);
    this.name = 'SignInError';
  }
}

export type GoogleAuth = ReturnType<typeof createGoogleAuth>;

export function createGoogleAuth(clientId: string, loadLib: () => Promise<GoogleOAuth2> = loadGoogleIdentity, now: () => number = Date.now) {
  let token: { value: string; expiresAt: number } | null = null;

  return {
    /** Starts loading Google's library early, so the sign-in popup opens straight from the click. */
    preload() {
      void loadLib().catch(() => undefined);
    },

    /**
     * Opens Google's sign-in / consent popup. Call from a click handler (browsers block popups otherwise).
     * `prompt: 'consent'` forces the account and permission screen; '' reuses an earlier grant.
     */
    async signIn(prompt: '' | 'consent' = ''): Promise<void> {
      const lib = await loadLib();
      await new Promise<void>((resolve, reject) => {
        const client = lib.initTokenClient({
          client_id: clientId,
          scope: DRIVE_FILE_SCOPE,
          callback: (response) => {
            if (response.error || !response.access_token) {
              const declined = response.error === 'access_denied';
              reject(new SignInError(declined ? 'Google access was not granted.' : 'Google sign-in failed.', declined));
              return;
            }
            if (!lib.hasGrantedAllScopes(response, DRIVE_FILE_SCOPE)) {
              reject(new SignInError('Please allow access to the files this app creates in your Google Drive.'));
              return;
            }
            const seconds = Number(response.expires_in) || 3600;
            // Treat the token as expired a minute early, so a request never starts with a dying token.
            token = { value: response.access_token, expiresAt: now() + (seconds - 60) * 1000 };
            resolve();
          },
          error_callback: (error) => {
            reject(
              error.type === 'popup_failed_to_open'
                ? new SignInError('The Google sign-in window was blocked. Allow pop-ups for this site and try again.')
                : new SignInError('Google sign-in was cancelled.', true),
            );
          },
        });
        client.requestAccessToken({ prompt });
      });
    },

    isSignedIn(): boolean {
      return token !== null && token.expiresAt > now();
    },

    /** For API calls. Fails like an expired Google sign-in (401) when there is no valid token. */
    getToken: (async () => {
      if (!token || token.expiresAt <= now()) throw new GoogleApiError(401, 'Your Google sign-in has expired. Sign in again.');
      return token.value;
    }) as TokenProvider,

    /** Revokes the app's access and forgets the token. */
    async signOut(): Promise<void> {
      const current = token;
      token = null;
      if (!current) return;
      try {
        const lib = await loadLib();
        await new Promise<void>((resolve) => lib.revoke(current.value, () => resolve()));
      } catch {
        // Offline: the token still expires on its own within the hour.
      }
    },
  };
}
