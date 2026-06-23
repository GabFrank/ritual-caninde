// Registro de engines de reproducción (Fase 6).
//
// Devuelve el engine concreto de navegador cuando el proveedor está "habilitado"
// (local con Web Audio, YouTube con contenedor visible, Spotify conectado) y, si no,
// cae en los adaptadores de SIMULACIÓN del núcleo (que llevan estado/posición sin SDK).
// Así la app sigue siendo usable para curar y previsualizar sin credenciales ni audio.

import {
  LocalPlaybackAdapter,
  SpotifyPlaybackAdapter,
  YouTubePlaybackAdapter,
  type PlaybackEngine,
  type Provider,
} from '../../ritual-core';
import { WebAudioEngine } from './webAudioEngine';
import { YouTubeEngine } from './youtubeEngine';
import { SpotifyEngine } from './spotifyEngine';

export interface EngineDeps {
  /** Proveedores con reproducción REAL habilitada; el resto va a simulación. */
  realProviders?: Set<Provider>;
  /** Contenedor visible para el iframe de YouTube (obligatorio para YT real). */
  youtubeMount?: HTMLElement | null;
  /** Entrega un access token de Spotify vigente. */
  spotifyToken?: () => Promise<string>;
}

export class EngineRegistry {
  private cache = new Map<Provider, PlaybackEngine>();

  constructor(private deps: EngineDeps = {}) {}

  get(provider: Provider): PlaybackEngine {
    const cached = this.cache.get(provider);
    if (cached) return cached;
    const engine = this.create(provider);
    this.cache.set(provider, engine);
    return engine;
  }

  private isReal(provider: Provider): boolean {
    return this.deps.realProviders?.has(provider) ?? false;
  }

  private create(provider: Provider): PlaybackEngine {
    try {
      if (this.isReal(provider)) {
        if (provider === 'local') return new WebAudioEngine();
        if (provider === 'youtube' && this.deps.youtubeMount) {
          return new YouTubeEngine(this.deps.youtubeMount);
        }
        if (provider === 'spotify' && this.deps.spotifyToken) {
          return new SpotifyEngine(this.deps.spotifyToken);
        }
      }
    } catch {
      // Cualquier problema al construir el engine real → simulación.
    }
    return this.simulated(provider);
  }

  private simulated(provider: Provider): PlaybackEngine {
    if (provider === 'youtube') return new YouTubePlaybackAdapter();
    if (provider === 'spotify') return new SpotifyPlaybackAdapter();
    return new LocalPlaybackAdapter();
  }

  async disposeAll(): Promise<void> {
    for (const engine of this.cache.values()) {
      try {
        await engine.stop();
      } catch {
        /* noop */
      }
    }
    this.cache.clear();
  }
}
