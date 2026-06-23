// Adaptador Spotify concreto (Fase 6): Web Playback SDK + Web API.
//
// Requiere Premium + OAuth (Authorization Code + PKCE; el token lo provee AuthSession).
// Headless, SIN Web Audio → el fade se aproxima por pasos con PUT /me/player/volume.

import { CAPABILITIES, type PlaybackEngine, type PlaybackState, type Provider, type Track } from '../../ritual-core';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const API = 'https://api.spotify.com/v1';

let sdkPromise: Promise<void> | null = null;

function loadSpotifySdk(): Promise<void> {
  const w = window as any;
  if (w.Spotify && w.Spotify.Player) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve) => {
      const prev = w.onSpotifyWebPlaybackSDKReady;
      w.onSpotifyWebPlaybackSDKReady = () => {
        prev?.();
        resolve();
      };
      const tag = document.createElement('script');
      tag.src = 'https://sdk.scdn.co/spotify-player.js';
      document.head.appendChild(tag);
    });
  }
  return sdkPromise;
}

export class SpotifyEngine implements PlaybackEngine {
  readonly provider: Provider = 'spotify';
  readonly capabilities = CAPABILITIES.spotify;

  private player: any;
  private deviceId?: string;
  private state: PlaybackState = 'idle';
  private volume = 1;
  private positionMs = 0;
  private current?: Track;
  private fadeTimer?: number;

  /** `getToken` entrega un access token vigente (de AuthSession). */
  constructor(private getToken: () => Promise<string>) {}

  private async ensurePlayer(): Promise<void> {
    await loadSpotifySdk();
    if (this.player) return;
    const w = window as any;
    this.player = new w.Spotify.Player({
      name: 'Caniné Ritual',
      volume: this.volume,
      getOAuthToken: (cb: (t: string) => void) => {
        this.getToken().then(cb).catch(() => cb(''));
      },
    });
    this.player.addListener('ready', ({ device_id }: any) => {
      this.deviceId = device_id;
    });
    this.player.addListener('player_state_changed', (s: any) => {
      if (!s) return;
      this.positionMs = s.position;
      this.state = s.paused ? 'paused' : 'playing';
    });
    const ok = await this.player.connect();
    if (!ok) throw new Error('No se pudo conectar el reproductor de Spotify.');
    // Espera breve a que llegue el device_id.
    await new Promise((r) => setTimeout(r, 600));
  }

  async load(track: Track): Promise<void> {
    await this.ensurePlayer();
    this.current = track;
    this.state = 'ready';
  }

  async play(): Promise<void> {
    await this.ensurePlayer();
    if (!this.current) throw new Error('play() sin track cargado (spotify).');
    if (!this.deviceId) throw new Error('Spotify sin device activo todavía.');
    const token = await this.getToken();
    const uri = this.current.source.uri || `spotify:track:${this.current.source.externalId}`;
    await fetch(`${API}/me/player/play?device_id=${this.deviceId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri] }),
    });
    this.state = 'playing';
  }

  async pause(): Promise<void> {
    await this.player?.pause();
    this.state = 'paused';
  }

  async seek(positionMs: number): Promise<void> {
    await this.player?.seek(Math.max(0, positionMs));
    this.positionMs = Math.max(0, positionMs);
  }

  async setVolume(volume: number): Promise<void> {
    this.clearFade();
    this.volume = clamp01(volume);
    await this.player?.setVolume(this.volume);
  }

  async fadeTo(target: number, durationMs: number): Promise<void> {
    this.clearFade();
    if (!this.player || durationMs <= 0) return this.setVolume(target);
    const from = this.volume;
    const to = clamp01(target);
    const steps = Math.max(1, Math.round(durationMs / 120));
    let i = 0;
    this.fadeTimer = window.setInterval(() => {
      i++;
      this.volume = clamp01(from + (to - from) * (i / steps));
      this.player?.setVolume(this.volume);
      if (i >= steps) this.clearFade();
    }, 120);
  }

  getPosition(): number {
    return this.positionMs;
  }

  getState(): PlaybackState {
    return this.state;
  }

  async stop(): Promise<void> {
    this.clearFade();
    try { await this.player?.pause(); } catch { /* noop */ }
    this.state = 'idle';
    this.positionMs = 0;
    this.current = undefined;
  }

  private clearFade(): void {
    if (this.fadeTimer !== undefined) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = undefined;
    }
  }
}
