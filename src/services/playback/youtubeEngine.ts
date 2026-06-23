// Adaptador YouTube concreto (Fase 6): IFrame Player API.
//
// Restricción de producto/diseño: reproductor VISIBLE obligatorio (la app monta este
// engine sobre un contenedor a la vista). Sin Web Audio → el fade se aproxima por pasos
// con setVolume(0..100). Fuente secundaria.

import { CAPABILITIES, type PlaybackEngine, type PlaybackState, type Provider, type Track } from '../../ritual-core';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

let apiPromise: Promise<void> | null = null;

/** Carga (una sola vez) el script de la IFrame Player API. */
function loadYouTubeApi(): Promise<void> {
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

export class YouTubeEngine implements PlaybackEngine {
  readonly provider: Provider = 'youtube';
  readonly capabilities = CAPABILITIES.youtube;

  private player: any;
  private state: PlaybackState = 'idle';
  private volume = 1;
  private fadeTimer?: number;

  /** `mount` es un contenedor VISIBLE donde la API inyecta el iframe. */
  constructor(private mount: HTMLElement) {}

  private async ensurePlayer(): Promise<void> {
    await loadYouTubeApi();
    if (this.player) return;
    const w = window as any;
    await new Promise<void>((resolve) => {
      this.player = new w.YT.Player(this.mount, {
        width: '100%',
        height: '100%',
        playerVars: { controls: 1, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => resolve(),
          onStateChange: (e: any) => {
            const YT = (window as any).YT;
            if (e.data === YT.PlayerState.PLAYING) this.state = 'playing';
            else if (e.data === YT.PlayerState.PAUSED) this.state = 'paused';
            else if (e.data === YT.PlayerState.ENDED) this.state = 'ended';
          },
        },
      });
    });
  }

  async load(track: Track): Promise<void> {
    await this.ensurePlayer();
    this.player.cueVideoById(track.source.externalId);
    this.state = 'ready';
  }

  async play(): Promise<void> {
    await this.ensurePlayer();
    this.player.playVideo();
    this.state = 'playing';
  }

  async pause(): Promise<void> {
    this.player?.pauseVideo();
    this.state = 'paused';
  }

  async seek(positionMs: number): Promise<void> {
    this.player?.seekTo(Math.max(0, positionMs) / 1000, true);
  }

  async setVolume(volume: number): Promise<void> {
    this.clearFade();
    this.volume = clamp01(volume);
    this.player?.setVolume(Math.round(this.volume * 100));
  }

  async fadeTo(target: number, durationMs: number): Promise<void> {
    this.clearFade();
    if (!this.player || durationMs <= 0) return this.setVolume(target);
    const from = this.volume;
    const to = clamp01(target);
    const steps = Math.max(1, Math.round(durationMs / 100));
    let i = 0;
    this.fadeTimer = window.setInterval(() => {
      i++;
      const v = from + (to - from) * (i / steps);
      this.volume = clamp01(v);
      this.player?.setVolume(Math.round(this.volume * 100));
      if (i >= steps) this.clearFade();
    }, 100);
  }

  getPosition(): number {
    return this.player?.getCurrentTime ? this.player.getCurrentTime() * 1000 : 0;
  }

  getState(): PlaybackState {
    return this.state;
  }

  async stop(): Promise<void> {
    this.clearFade();
    try { this.player?.stopVideo(); } catch { /* noop */ }
    this.state = 'idle';
  }

  private clearFade(): void {
    if (this.fadeTimer !== undefined) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = undefined;
    }
  }
}
