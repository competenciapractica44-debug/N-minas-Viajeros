import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Workspace Drive scope: create, read, and manage files created by this app in user's Drive
provider.addScope('https://www.googleapis.com/auth/drive.file');
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to track sign-in in progress
let isSigningIn = false;
// In-memory cache for the access token (Never in localStorage per security guidelines)
let cachedAccessToken: string | null = null;

export interface AppAuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

/**
 * Initialize auth state listener.
 * Calls callback with user and token (or null if not logged in / no token).
 */
export const initAuth = (
  callback: (user: User | null, token: string | null) => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      callback(user, cachedAccessToken);
    } else if (user) {
      // User is authenticated in Firebase but token is not in memory
      callback(user, null);
    } else {
      cachedAccessToken = null;
      callback(null, null);
    }
  });
};

/**
 * Request OAuth token directly using Google Identity Services (GIS)
 * as a robust fallback when Firebase popup is blocked by domain restrictions.
 */
const requestGisToken = async (): Promise<{ user: User; accessToken: string }> => {
  const clientId = firebaseConfig.oAuthClientId;
  if (!clientId) {
    throw new Error('No se encontró oAuthClientId en la configuración');
  }

  // Wait briefly for window.google.accounts.oauth2 if script is still loading
  let attempts = 0;
  while (!(window as any).google?.accounts?.oauth2 && attempts < 10) {
    await new Promise((r) => setTimeout(r, 150));
    attempts++;
  }

  if (!(window as any).google?.accounts?.oauth2) {
    throw new Error('Google Identity Services no está disponible en este navegador');
  }

  return new Promise((resolve, reject) => {
    try {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
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

          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const userInfo = await userInfoRes.json();
            const syntheticUser = {
              uid: userInfo.sub || 'google-user',
              displayName: userInfo.name || userInfo.email?.split('@')[0] || 'Conductor',
              email: userInfo.email || '',
              photoURL: userInfo.picture || null,
            } as unknown as User;
            resolve({ user: syntheticUser, accessToken });
          } catch {
            const fallbackUser = {
              uid: 'google-user',
              displayName: 'Conductor',
              email: '',
              photoURL: null,
            } as unknown as User;
            resolve({ user: fallbackUser, accessToken });
          }
        },
      });

      tokenClient.requestAccessToken();
    } catch (err) {
      reject(err);
    }
  });
};

/**
 * Perform Google Sign-In with popup and request Google Drive permissions.
 * If Firebase Auth rejects with auth/unauthorized-domain, attempts Google Identity Services fallback.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (!credential?.accessToken) {
        throw new Error('No se pudo obtener el token de acceso de Google');
      }

      cachedAccessToken = credential.accessToken;
      return { user: result.user, accessToken: cachedAccessToken };
    } catch (firebaseErr: any) {
      // Check if it's an unauthorized domain error (common on Vercel or external hostings)
      if (
        firebaseErr.code === 'auth/unauthorized-domain' ||
        firebaseErr.message?.includes('unauthorized-domain')
      ) {
        console.warn('Firebase unauthorized domain detected. Attempting direct Google Identity Services...');
        try {
          const gisResult = await requestGisToken();
          return gisResult;
        } catch (gisErr: any) {
          console.warn('GIS fallback also failed or domain not authorized in GCP:', gisErr);
          // Re-throw original firebase error so modal displays domain authorization instructions
          throw firebaseErr;
        }
      }
      throw firebaseErr;
    }
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
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
 * Sign out user from Firebase and clear cached token.
 */
export const logout = async () => {
  try {
    await signOut(auth);
  } finally {
    cachedAccessToken = null;
  }
};
