import { describe, it, expect } from 'vitest';
import { parseSourceUrl, fetchSourceMeta } from './sourceUrl';

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
