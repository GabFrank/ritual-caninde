import { describe, it, expect } from 'vitest';
import { parseSourceUrl, fetchSourceMeta, fetchSpotifyMeta } from './sourceUrl';

describe('parseSourceUrl - Spotify', () => {
  it('álbum con parámetro si', () => {
    const r = parseSourceUrl('https://open.spotify.com/album/6ee6iLY45OVLY13OgMXeDZ?si=-CzOG0UhSHqKhMsDjo6hrA');
    expect(r).toMatchObject({
      provider: 'spotify',
      kind: 'album',
      externalId: '6ee6iLY45OVLY13OgMXeDZ',
      isSingleTrack: false,
      uri: 'spotify:album:6ee6iLY45OVLY13OgMXeDZ',
    });
  });

  it('track es reproducible como tema único', () => {
    const r = parseSourceUrl('https://open.spotify.com/track/4xSg7A0123456789ABCDEF');
    expect(r?.kind).toBe('track');
    expect(r?.isSingleTrack).toBe(true);
  });

  it('tolera prefijo de locale /intl-es/', () => {
    const r = parseSourceUrl('https://open.spotify.com/intl-es/track/4xSg7A0123456789ABCDEF');
    expect(r).toMatchObject({ provider: 'spotify', kind: 'track', externalId: '4xSg7A0123456789ABCDEF' });
  });

  it('acepta URI spotify:album:ID', () => {
    const r = parseSourceUrl('spotify:album:6ee6iLY45OVLY13OgMXeDZ');
    expect(r).toMatchObject({ provider: 'spotify', kind: 'album', externalId: '6ee6iLY45OVLY13OgMXeDZ' });
  });
});

describe('parseSourceUrl - YouTube', () => {
  it('youtu.be corto con si', () => {
    const r = parseSourceUrl('https://youtu.be/n1_Y96yUTtA?si=bcTJ7nBr1mSw2UHe');
    expect(r).toMatchObject({ provider: 'youtube', kind: 'video', externalId: 'n1_Y96yUTtA', isSingleTrack: true });
  });

  it('segundo ejemplo youtu.be', () => {
    const r = parseSourceUrl('https://youtu.be/XX0gTauVbNY?si=3dYPOHnCjR9pXRbf');
    expect(r?.externalId).toBe('XX0gTauVbNY');
  });

  it('watch?v=', () => {
    expect(parseSourceUrl('https://www.youtube.com/watch?v=n1_Y96yUTtA')?.externalId).toBe('n1_Y96yUTtA');
  });

  it('shorts y embed', () => {
    expect(parseSourceUrl('https://www.youtube.com/shorts/n1_Y96yUTtA')?.externalId).toBe('n1_Y96yUTtA');
    expect(parseSourceUrl('https://www.youtube.com/embed/n1_Y96yUTtA')?.externalId).toBe('n1_Y96yUTtA');
  });

  it('music.youtube.com', () => {
    expect(parseSourceUrl('https://music.youtube.com/watch?v=n1_Y96yUTtA')?.externalId).toBe('n1_Y96yUTtA');
  });

  it('playlist de YouTube no es tema único', () => {
    const r = parseSourceUrl('https://www.youtube.com/playlist?list=PLabc123');
    expect(r).toMatchObject({ provider: 'youtube', kind: 'yt-playlist', externalId: 'PLabc123', isSingleTrack: false });
  });
});

describe('parseSourceUrl - inválidos', () => {
  it('devuelve null para basura / vacío / otros dominios', () => {
    expect(parseSourceUrl('')).toBeNull();
    expect(parseSourceUrl('hola mundo')).toBeNull();
    expect(parseSourceUrl('https://example.com/track/123')).toBeNull();
    expect(parseSourceUrl('https://youtu.be/short')).toBeNull(); // id de largo inválido
  });
});

describe('fetchSourceMeta (best-effort)', () => {
  it('YouTube: mapea title y author_name->artist', async () => {
    const parsed = parseSourceUrl('https://youtu.be/n1_Y96yUTtA')!;
    const fakeFetch = async () =>
      new Response(JSON.stringify({ title: 'Canto Medicina', author_name: 'Ayla Schafer' }), { status: 200 });
    const meta = await fetchSourceMeta(parsed, fakeFetch as any);
    expect(meta).toEqual({ title: 'Canto Medicina', artist: 'Ayla Schafer' });
  });

  it('Spotify: trae title sin artista', async () => {
    const parsed = parseSourceUrl('https://open.spotify.com/album/6ee6iLY45OVLY13OgMXeDZ')!;
    const fakeFetch = async () => new Response(JSON.stringify({ title: 'Medicine' }), { status: 200 });
    const meta = await fetchSourceMeta(parsed, fakeFetch as any);
    expect(meta).toEqual({ title: 'Medicine', artist: undefined });
  });

  it('propaga error si oEmbed falla', async () => {
    const parsed = parseSourceUrl('https://youtu.be/n1_Y96yUTtA')!;
    const fakeFetch = async () => new Response('', { status: 404 });
    await expect(fetchSourceMeta(parsed, fakeFetch as any)).rejects.toThrow();
  });
});

describe('fetchSpotifyMeta (Web API)', () => {
  it('track: junta artistas y trae duración', async () => {
    const parsed = parseSourceUrl('https://open.spotify.com/track/4xSg7A0123456789ABCDEF')!;
    const fakeFetch = async (url: string, init?: RequestInit) => {
      expect(url).toContain('/v1/tracks/4xSg7A0123456789ABCDEF');
      expect((init?.headers as any).Authorization).toBe('Bearer tok123');
      return new Response(
        JSON.stringify({ name: 'Icaro', duration_ms: 510000, artists: [{ name: 'Danit' }, { name: 'Ayla' }] }),
        { status: 200 },
      );
    };
    const meta = await fetchSpotifyMeta(parsed, 'tok123', fakeFetch as any);
    expect(meta).toEqual({ title: 'Icaro', artist: 'Danit, Ayla', durationMs: 510000 });
  });

  it('álbum: usa artistas, sin duración', async () => {
    const parsed = parseSourceUrl('https://open.spotify.com/album/6ee6iLY45OVLY13OgMXeDZ')!;
    const fakeFetch = async () =>
      new Response(JSON.stringify({ name: 'Medicine', artists: [{ name: 'Danit' }] }), { status: 200 });
    const meta = await fetchSpotifyMeta(parsed, 'tok', fakeFetch as any);
    expect(meta).toEqual({ title: 'Medicine', artist: 'Danit', durationMs: undefined });
  });

  it('playlist: cae al display_name del dueño', async () => {
    const parsed = parseSourceUrl('spotify:playlist:37i9dQZF1DX')!;
    const fakeFetch = async () =>
      new Response(JSON.stringify({ name: 'Ceremonia', owner: { display_name: 'Gabriel' } }), { status: 200 });
    const meta = await fetchSpotifyMeta(parsed, 'tok', fakeFetch as any);
    expect(meta).toMatchObject({ title: 'Ceremonia', artist: 'Gabriel' });
  });

  it('falla sin token o si la API responde error', async () => {
    const parsed = parseSourceUrl('https://open.spotify.com/track/4xSg7A0123456789ABCDEF')!;
    await expect(fetchSpotifyMeta(parsed, '', (async () => new Response('', { status: 200 })) as any)).rejects.toThrow();
    const err = async () => new Response('', { status: 401 });
    await expect(fetchSpotifyMeta(parsed, 'tok', err as any)).rejects.toThrow();
  });
});
