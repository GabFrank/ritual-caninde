// Detección de fuente a partir de una URL pegada (Spotify / YouTube).
//
// `parseSourceUrl` es PURA y offline: de un link deduce proveedor, ID externo y tipo
// (track/álbum/playlist/video). `fetchSourceMeta` es un extra best-effort que intenta
// traer título/artista vía oEmbed (puede fallar por CORS; el llamador lo trata como opcional).

export type SourceProvider = 'spotify' | 'youtube';

export type SourceKind =
  // Spotify
  | 'track'
  | 'album'
  | 'playlist'
  | 'artist'
  | 'episode'
  | 'show'
  // YouTube
  | 'video'
  | 'yt-playlist';

export interface ParsedSource {
  provider: SourceProvider;
  /** ID externo tal cual lo usan los reproductores (videoId / spotify id). */
  externalId: string;
  kind: SourceKind;
  /** true sólo si es reproducible como un único tema (track de Spotify o video de YouTube). */
  isSingleTrack: boolean;
  /** URI canónica de Spotify (spotify:track:ID) cuando aplica. */
  uri?: string;
  /** URL canónica normalizada (útil para oEmbed). */
  canonicalUrl: string;
}

const SPOTIFY_KINDS: ReadonlyArray<SourceKind> = [
  'track',
  'album',
  'playlist',
  'artist',
  'episode',
  'show',
];

/** Intenta crear un URL; tolera que falte el esquema (open.spotify.com/...). */
function toUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function parseSpotifyUri(raw: string): ParsedSource | null {
  // spotify:track:6ee6...  / spotify:album:...
  const m = raw.trim().match(/^spotify:(track|album|playlist|artist|episode|show):([A-Za-z0-9]+)$/);
  if (!m) return null;
  const kind = m[1] as SourceKind;
  const externalId = m[2];
  return {
    provider: 'spotify',
    externalId,
    kind,
    isSingleTrack: kind === 'track',
    uri: `spotify:${kind}:${externalId}`,
    canonicalUrl: `https://open.spotify.com/${kind}/${externalId}`,
  };
}

function parseSpotify(url: URL): ParsedSource | null {
  if (!/(^|\.)spotify\.com$/.test(url.hostname)) return null;
  // Quita prefijo de locale tipo /intl-es/ y segmentos vacíos.
  const segments = url.pathname.split('/').filter(Boolean).filter((s) => !/^intl-[a-z]{2}$/i.test(s));
  if (segments.length < 2) return null;
  const kind = segments[0].toLowerCase() as SourceKind;
  if (!SPOTIFY_KINDS.includes(kind)) return null;
  const externalId = segments[1];
  if (!/^[A-Za-z0-9]+$/.test(externalId)) return null;
  return {
    provider: 'spotify',
    externalId,
    kind,
    isSingleTrack: kind === 'track',
    uri: `spotify:${kind}:${externalId}`,
    canonicalUrl: `https://open.spotify.com/${kind}/${externalId}`,
  };
}

function isValidYouTubeId(id: string): boolean {
  return /^[A-Za-z0-9_-]{11}$/.test(id);
}

function youTubeVideo(id: string): ParsedSource {
  return {
    provider: 'youtube',
    externalId: id,
    kind: 'video',
    isSingleTrack: true,
    canonicalUrl: `https://www.youtube.com/watch?v=${id}`,
  };
}

function parseYouTube(url: URL): ParsedSource | null {
  const host = url.hostname.replace(/^www\./, '');
  const segments = url.pathname.split('/').filter(Boolean);

  // youtu.be/<id>
  if (host === 'youtu.be') {
    const id = segments[0];
    return id && isValidYouTubeId(id) ? youTubeVideo(id) : null;
  }

  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'm.youtube.com') {
    // /watch?v=<id>
    const v = url.searchParams.get('v');
    if (v && isValidYouTubeId(v)) return youTubeVideo(v);

    // /shorts/<id>  y  /embed/<id>
    if ((segments[0] === 'shorts' || segments[0] === 'embed') && isValidYouTubeId(segments[1] ?? '')) {
      return youTubeVideo(segments[1]);
    }

    // /playlist?list=<id>
    const list = url.searchParams.get('list');
    if (segments[0] === 'playlist' && list) {
      return {
        provider: 'youtube',
        externalId: list,
        kind: 'yt-playlist',
        isSingleTrack: false,
        canonicalUrl: `https://www.youtube.com/playlist?list=${list}`,
      };
    }
  }

  return null;
}

/** Deduce la fuente de una URL/URI pegada. Devuelve null si no la reconoce. */
export function parseSourceUrl(input: string): ParsedSource | null {
  if (!input) return null;
  const spotifyUri = parseSpotifyUri(input);
  if (spotifyUri) return spotifyUri;

  const url = toUrl(input);
  if (!url) return null;

  return parseSpotify(url) ?? parseYouTube(url);
}

const KIND_LABELS: Record<SourceKind, string> = {
  track: 'tema',
  album: 'álbum',
  playlist: 'playlist',
  artist: 'artista',
  episode: 'episodio',
  show: 'podcast',
  video: 'video',
  'yt-playlist': 'playlist',
};

export function describeKind(kind: SourceKind): string {
  return KIND_LABELS[kind] ?? kind;
}

export interface SourceMeta {
  title?: string;
  artist?: string;
  /** Duración en ms cuando la fuente la expone (ej. Spotify Web API). */
  durationMs?: number;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Best-effort: trae título/artista vía oEmbed público. Puede fallar por CORS o red;
 * el llamador debe tratar el resultado como opcional (try/catch o .catch()).
 */
export async function fetchSourceMeta(
  parsed: ParsedSource,
  fetchImpl?: FetchLike,
): Promise<SourceMeta> {
  const doFetch: FetchLike =
    fetchImpl ?? ((u) => (globalThis as { fetch: FetchLike }).fetch(u));

  const endpoint =
    parsed.provider === 'spotify'
      ? `https://open.spotify.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}`
      : `https://www.youtube.com/oembed?url=${encodeURIComponent(parsed.canonicalUrl)}&format=json`;

  const res = await doFetch(endpoint);
  if (!res.ok) throw new Error(`oEmbed ${res.status}`);
  const data = (await res.json()) as { title?: string; author_name?: string };

  return {
    title: data.title,
    // YouTube expone el canal en author_name; Spotify no trae artista en oEmbed.
    artist: parsed.provider === 'youtube' ? data.author_name : undefined,
  };
}

const SPOTIFY_API_PATH: Partial<Record<SourceKind, string>> = {
  track: 'tracks',
  album: 'albums',
  playlist: 'playlists',
  artist: 'artists',
  episode: 'episodes',
  show: 'shows',
};

interface SpotifyApiEntity {
  name?: string;
  duration_ms?: number;
  artists?: Array<{ name?: string }>;
  owner?: { display_name?: string };
  publisher?: string;
}

/**
 * Trae metadatos completos (título, artista y duración cuando aplica) desde la Web API
 * de Spotify. Requiere un access token válido — usar `getAccessToken('spotify')`.
 * Lanza si no hay token o la API falla; el llamador decide el fallback (p. ej. oEmbed).
 */
export async function fetchSpotifyMeta(
  parsed: ParsedSource,
  token: string,
  fetchImpl?: FetchLike,
): Promise<SourceMeta> {
  if (parsed.provider !== 'spotify') throw new Error('fetchSpotifyMeta: la fuente no es de Spotify');
  if (!token) throw new Error('fetchSpotifyMeta: falta el access token de Spotify');

  const path = SPOTIFY_API_PATH[parsed.kind];
  if (!path) throw new Error(`fetchSpotifyMeta: tipo no soportado (${parsed.kind})`);

  const doFetch = fetchImpl ?? ((u, init) => (globalThis as { fetch: FetchLike }).fetch(u, init));
  const res = await doFetch(`https://api.spotify.com/v1/${path}/${parsed.externalId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify API ${res.status}`);
  const data = (await res.json()) as SpotifyApiEntity;

  const artist =
    (data.artists && data.artists.length
      ? data.artists.map((a) => a.name).filter(Boolean).join(', ')
      : undefined) ??
    data.owner?.display_name ?? // playlists
    data.publisher; // shows/podcasts

  return {
    title: data.name,
    artist: artist || undefined,
    durationMs: typeof data.duration_ms === 'number' ? data.duration_ms : undefined,
  };
}
