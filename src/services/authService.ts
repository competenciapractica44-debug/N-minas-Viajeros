import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const GOOGLE_OAUTH_CLIENT_ID =
  '800114728046-s7euqtcssfkc1bojqm504rm5f8qq7892.apps.googleusercontent.com';
export const MOBILE_REDIRECT_URI = 'https://n-minas-viajeros.vercel.app/';

const GIS_SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const OAUTH_STATE_SESSION_KEY = 'rutanomina_oauth_redirect_state_v1';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Workspace Drive scope: create, read, and manage files created by this app in user's Drive
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory cache for the access token & GIS user (Never stored in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedRedirectUser: User | null = null;
let redirectResolutionPromise: Promise<{ user: User; accessToken: string } | null> | null = null;

export interface AppAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

export const isMobileDevice = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
};

const isPreviewOrLocalHost = (): boolean => {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host.endsWith('.run.app') || host === 'localhost' || host === '127.0.0.1';
};

async function buildSyntheticGoogleUser(accessToken: string): Promise<User> {
  try {
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) throw new Error('userinfo failed');
    const userInfo = await userInfoRes.json();
    return {
      uid: userInfo.sub || 'google-user',
      displayName: userInfo.name || userInfo.email?.split('@')[0] || 'Conductor',
      email: userInfo.email || '',
      photoURL: userInfo.picture || null,
    } as unknown as User;
  } catch {
    return {
      uid: 'google-user',
      displayName: 'Conductor',
      email: '',
      photoURL: null,
    } as unknown as User;
  }
}

function generateOAuthState(): string {
  try {
    const arr = new Uint8Array(16);
    window.crypto.getRandomValues(arr);
    return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }
}

/**
 * Starts a top-level OAuth2 redirect flow on mobile browsers (Chrome Android / iOS)
 * so popups are never blocked. Uses ux_mode: 'redirect' semantics with MOBILE_REDIRECT_URI.
 */
function startMobileOAuthRedirect(clientId: string): void {
  const state = generateOAuthState();
  try {
    sessionStorage.setItem(OAUTH_STATE_SESSION_KEY, state);
  } catch {
    // Ignore storage errors in restricted contexts
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: MOBILE_REDIRECT_URI,
    response_type: 'token',
    scope: GIS_SCOPES,
    include_granted_scopes: 'true',
    prompt: 'select_account',
    state,
  });

  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/**
 * Resolves any returning OAuth2 hash redirect (#access_token=...) or Firebase Auth
 * getRedirectResult() once at startup (idempotent across React StrictMode mounts).
 */
export const resolveRedirectAuth = (): Promise<{ user: User; accessToken: string } | null> => {
  if (redirectResolutionPromise) return redirectResolutionPromise;

  redirectResolutionPromise = (async () => {
    // 1. Check OAuth2 implicit redirect params in URL hash (#access_token=... / #error=...)
    if (typeof window !== 'undefined' && window.location.hash) {
      const rawHash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
      const hashParams = new URLSearchParams(rawHash);
      const hashToken = hashParams.get('access_token');
      const hashError = hashParams.get('error');
      const hashErrorDesc = hashParams.get('error_description');
      const returnedState = hashParams.get('state');

      if (hashToken || hashError) {
        // Scrub token/error from URL immediately so it does not persist in history
        const cleanUrl = `${window.location.pathname}${window.location.search}`;
        window.history.replaceState(null, document.title, cleanUrl);
      }

      if (hashError) {
        try {
          sessionStorage.removeItem(OAUTH_STATE_SESSION_KEY);
        } catch {
          // ignore
        }
        throw new Error(hashErrorDesc || hashError);
      }

      if (hashToken) {
        try {
          const expectedState = sessionStorage.getItem(OAUTH_STATE_SESSION_KEY);
          sessionStorage.removeItem(OAUTH_STATE_SESSION_KEY);
          if (expectedState && returnedState && expectedState !== returnedState) {
            throw new Error('Error de validación de estado OAuth al volver de Google.');
          }
        } catch (stateErr) {
          if (stateErr instanceof Error && stateErr.message.includes('validación de estado')) {
            throw stateErr;
          }
        }

        cachedAccessToken = hashToken;
        const user = await buildSyntheticGoogleUser(hashToken);
        cachedRedirectUser = user;
        return { user, accessToken: hashToken };
      }
    }

    // 2. Check URL query string for OAuth error returned via redirect
    if (typeof window !== 'undefined' && window.location.search) {
      const searchParams = new URLSearchParams(window.location.search);
      const queryError = searchParams.get('error');
      if (queryError) {
        const desc = searchParams.get('error_description');
        searchParams.delete('error');
        searchParams.delete('error_description');
        const nextSearch = searchParams.toString();
        window.history.replaceState(
          null,
          document.title,
          `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
        );
        throw new Error(desc || queryError);
      }
    }

    // 3. Check Firebase Auth redirect result (used on mobile when Firebase redirect runs)
    try {
      const result = await getRedirectResult(auth);
      if (result?.user) {
        const credential = GoogleAuthProvider.credentialFromResult(result);
        if (credential?.accessToken) {
          cachedAccessToken = credential.accessToken;
          cachedRedirectUser = result.user;
          return { user: result.user, accessToken: credential.accessToken };
        }
      }
    } catch (firebaseRedirectErr: any) {
      console.warn('Error en getRedirectResult de Firebase Auth:', firebaseRedirectErr);
      throw firebaseRedirectErr;
    }

    return null;
  })();

  return redirectResolutionPromise;
};

/**
 * Initialize auth state listener.
 * First processes any OAuth / Firebase redirect result before notifying auth state.
 */
export const initAuth = (
  callback: (user: User | null, token: string | null, authError?: unknown) => void
) => {
  let unsubscribeAuth: (() => void) | null = null;
  let cancelled = false;
  let lastNotifiedKey: string | null = null;

  const notifyOnce = (user: User | null, token: string | null, authError?: unknown) => {
    const key = `${user?.uid || 'none'}::${token || 'null'}::${authError ? 'err' : 'ok'}`;
    if (!authError && lastNotifiedKey === key) return;
    lastNotifiedKey = key;
    callback(user, token, authError);
  };

  resolveRedirectAuth()
    .then((redirectResult) => {
      if (cancelled) return;
      if (redirectResult) {
        notifyOnce(redirectResult.user, redirectResult.accessToken);
      }
    })
    .catch((redirectErr) => {
      if (cancelled) return;
      notifyOnce(null, null, redirectErr);
    })
    .finally(() => {
      if (cancelled) return;
      unsubscribeAuth = onAuthStateChanged(auth, (user: User | null) => {
        if (cancelled) return;
        const activeUser = user || cachedRedirectUser;
        if (activeUser && cachedAccessToken) {
          notifyOnce(activeUser, cachedAccessToken);
        } else if (activeUser) {
          notifyOnce(activeUser, null);
        } else {
          cachedAccessToken = null;
          notifyOnce(null, null);
        }
      });
    });

  return () => {
    cancelled = true;
    if (unsubscribeAuth) unsubscribeAuth();
  };
};

/**
 * Request OAuth token using Google Identity Services (GIS) / OAuth 2.0.
 * Uses ux_mode: 'redirect' + MOBILE_REDIRECT_URI on mobile devices to avoid popup blocking,
 * and ux_mode: 'popup' on desktop.
 */
const requestGisToken = async (): Promise<{ user: User; accessToken: string }> => {
  const clientId = GOOGLE_OAUTH_CLIENT_ID || firebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('No se encontró Client ID de OAuth 2.0 en la configuración');
  }

  const isMobile = isMobileDevice();

  // Wait briefly for window.google.accounts.oauth2 if script is still loading
  let attempts = 0;
  while (!(window as any).google?.accounts?.oauth2 && attempts < 10) {
    await new Promise((r) => setTimeout(r, 150));
    attempts++;
  }

  if (isMobile) {
    // Configure GIS ux_mode: 'redirect' when available and perform full-page OAuth2 redirect
    // to https://n-minas-viajeros.vercel.app/ so mobile Chrome (Android/iOS) never blocks popups.
    const oauth2 = (window as any).google?.accounts?.oauth2;
    if (oauth2?.initTokenClient) {
      try {
        oauth2.initTokenClient({
          client_id: clientId,
          scope: GIS_SCOPES,
          ux_mode: 'redirect',
          redirect_uri: MOBILE_REDIRECT_URI,
          prompt: 'select_account',
          callback: () => {},
        });
      } catch {
        // Proceed with direct OAuth2 redirect
      }
    }
    startMobileOAuthRedirect(clientId);
    return new Promise(() => {});
  }

  if (!(window as any).google?.accounts?.oauth2) {
    throw new Error('Google Identity Services no está disponible en este navegador');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: GIS_SCOPES,
        ux_mode: 'popup',
        prompt: 'select_account',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            reject(new Error(tokenResponse.error_description || tokenResponse.error));
            return;
          }
          if (!tokenResponse.access_token) {
            reject(new Error('No se recibió token de acceso de Google'));
            return;
          }

          const accessToken = tokenResponse.access_token;
          cachedAccessToken = accessToken;
          const user = await buildSyntheticGoogleUser(accessToken);
          cachedRedirectUser = user;
          resolve({ user, accessToken });
        },
        error_callback: (err: any) => {
          reject(
            new Error(
              err?.message ||
                (err?.type === 'popup_closed'
                  ? 'Ventana de inicio de sesión cerrada.'
                  : 'No se pudo abrir la ventana de Google.')
            )
          );
        },
      });

      tokenClient.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Perform Google Sign-In and request Google Drive permissions.
 * - On production hosts (e.g. Vercel), uses GIS/OAuth2 with the configured client ID
 *   (redirect on mobile, popup on desktop).
 * - On preview/local hosts, uses Firebase Auth (signInWithRedirect on mobile,
 *   signInWithPopup on desktop) with automatic GIS fallback.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  const isMobile = isMobileDevice();

  try {
    if (!isPreviewOrLocalHost()) {
      try {
        return await requestGisToken();
      } catch (gisErr: any) {
        console.warn('GIS OAuth2 falló, intentando Firebase Auth:', gisErr);
      }
    }

    try {
      if (isMobile) {
        await signInWithRedirect(auth, provider);
        return null;
      }

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('No se pudo obtener el token de acceso de Google');
      }

      cachedAccessToken = credential.accessToken;
      cachedRedirectUser = result.user;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (firebaseErr: any) {
      if (
        firebaseErr.code === 'auth/unauthorized-domain' ||
        firebaseErr.code === 'auth/popup-blocked' ||
        firebaseErr.code === 'auth/operation-not-supported-in-this-environment' ||
        firebaseErr.message?.includes('unauthorized-domain')
      ) {
        console.warn('Firebase Auth no disponible en este dominio/entorno. Usando GIS OAuth2...');
        return await requestGisToken();
      }
      throw firebaseErr;
    }
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  }
};

/**
 * Get current in-memory cached access token synchronously.
 */
export const getCachedAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Get current in-memory cached access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Set or refresh in-memory cached token (e.g. from state).
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Sign out user from Firebase and clear in-memory cached token.
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
    cachedRedirectUser = null;
    redirectResolutionPromise = null;
    try {
      sessionStorage.removeItem(OAUTH_STATE_SESSION_KEY);
    } catch {
      // ignore
    }
  }
};
