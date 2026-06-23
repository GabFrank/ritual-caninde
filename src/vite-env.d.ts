/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client ID de Spotify (OAuth Authorization Code + PKCE). */
  readonly VITE_SPOTIFY_CLIENT_ID?: string;
  /** Client ID de Google/YouTube (OAuth + PKCE). */
  readonly VITE_YOUTUBE_CLIENT_ID?: string;
  /** Redirect URI registrado en los proveedores (por defecto: origin + /callback). */
  readonly VITE_OAUTH_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Versión de la app (package.json) incrustada en build por Vite (define). */
declare const __APP_VERSION__: string;
