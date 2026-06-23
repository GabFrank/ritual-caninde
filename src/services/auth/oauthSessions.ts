// Cableado OAuth del lado app (Fase 6).
//
// Usa las primitivas del núcleo (AuthSession + WebStorageTokenStore + las configs de
// proveedor) y agrega lo que es propio del navegador: redirect, manejo del callback y
// el almacenamiento del PKCE pendiente entre la ida y la vuelta.
//
// Sin client IDs configurados (import.meta.env), el proveedor queda "no configurado" y
// la reproducción cae en modo simulación.

import {
  AuthSession,
  WebStorageTokenStore,
  makeSpotifyConfig,
  makeYouTubeConfig,
  type OAuthConfig,
} from '../../ritual-core';

export type OAuthProvider = 'spotify' | 'youtube';

const PENDING_KEY = 'caninde-ritual.oauth.pending';

function redirectUri(): string {
  return (
    import.meta.env.VITE_OAUTH_REDIRECT_URI ||
    `${window.location.origin}/callback`
  );
}

function clientId(provider: OAuthProvider): string {
  return (
    (provider === 'spotify'
      ? import.meta.env.VITE_SPOTIFY_CLIENT_ID
      : import.meta.env.VITE_YOUTUBE_CLIENT_ID) || ''
  );
}

/** ¿Hay client ID para este proveedor? Si no, no se puede hacer OAuth real. */
export function isConfigured(provider: OAuthProvider): boolean {
  return clientId(provider).length > 0;
}

function configFor(provider: OAuthProvider): OAuthConfig {
  const opts = { clientId: clientId(provider), redirectUri: redirectUri() };
  return provider === 'spotify' ? makeSpotifyConfig(opts) : makeYouTubeConfig(opts);
}

const tokenStore = new WebStorageTokenStore(window.localStorage);

function sessionFor(provider: OAuthProvider): AuthSession {
  // El intercambio de token usa el fetch global del navegador.
  return new AuthSession(configFor(provider), tokenStore);
}

interface PendingLoginState {
  provider: OAuthProvider;
  verifier: string;
  state: string;
}

/** Paso 1: arranca el login redirigiendo al proveedor (guarda el PKCE pendiente). */
export async function startLogin(provider: OAuthProvider): Promise<void> {
  if (!isConfigured(provider)) {
    throw new Error(`Falta el client ID de ${provider} (configurá VITE_${provider.toUpperCase()}_CLIENT_ID).`);
  }
  const { url, verifier, state } = await sessionFor(provider).startLogin();
  const pending: PendingLoginState = { provider, verifier, state };
  sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  window.location.assign(url);
}

/**
 * Paso 2: en la vuelta a /callback. Si la URL trae ?code&state válidos, canjea el
 * token, lo persiste, limpia la URL y devuelve el proveedor conectado.
 */
export async function handleRedirectCallback(): Promise<OAuthProvider | null> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code || !state) return null;

  const rawPending = sessionStorage.getItem(PENDING_KEY);
  if (!rawPending) return null;

  let pending: PendingLoginState;
  try {
    pending = JSON.parse(rawPending) as PendingLoginState;
  } catch {
    sessionStorage.removeItem(PENDING_KEY);
    return null;
  }

  // Anti-CSRF: el state de la URL debe coincidir con el que guardamos.
  if (pending.state !== state) {
    sessionStorage.removeItem(PENDING_KEY);
    throw new Error('OAuth state mismatch: posible CSRF, login abortado.');
  }

  try {
    await sessionFor(pending.provider).completeLogin(code, pending.verifier);
    return pending.provider;
  } finally {
    sessionStorage.removeItem(PENDING_KEY);
    // Limpia ?code&state de la URL sin recargar.
    const clean = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, clean);
  }
}

export async function isConnected(provider: OAuthProvider): Promise<boolean> {
  if (!isConfigured(provider)) return false;
  return sessionFor(provider).isLoggedIn();
}

export async function logout(provider: OAuthProvider): Promise<void> {
  await sessionFor(provider).logout();
}

/** Devuelve un access token válido (refresca si hace falta) o null si no hay sesión. */
export async function getAccessToken(provider: OAuthProvider): Promise<string | null> {
  try {
    return await sessionFor(provider).getAccessToken();
  } catch {
    return null;
  }
}
