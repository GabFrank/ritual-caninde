// Adaptador Local concreto (Fase 6): Web Audio API.
//
// El único con crossfade REAL y offline (doc §7). Cada instancia maneja un
// HTMLAudioElement enrutado por un GainNode propio, así el controlador puede solapar
// dos instancias locales y hacer rampas de ganancia reales (linearRampToValueAtTime).

import { CAPABILITIES, type PlaybackEngine, type PlaybackState, type Provider, type Track } from '../../ritual-core';

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export class WebAudioEngine implements PlaybackEngine {
  readonly provider: Provider = 'local';
  readonly capabilities = CAPABILITIES.local;

  private ctx: AudioContext;
  private gain: GainNode;
  private audio?: HTMLAudioElement;
  private node?: MediaElementAudioSourceNode;
  private state: PlaybackState = 'idle';

  constructor(ctx?: AudioContext) {
    const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = ctx ?? new Ctor();
    this.gain = this.ctx.createGain();
    this.gain.gain.value = 1;
    this.gain.connect(this.ctx.destination);
  }

  async load(track: Track): Promise<void> {
    await this.releaseMedia();
    const url = track.source.uri || track.source.externalId;
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.addEventListener('ended', () => { this.state = 'ended'; });
    this.audio = audio;
    this.node = this.ctx.createMediaElementSource(audio);
    this.node.connect(this.gain);
    this.state = 'ready';
  }

  async play(): Promise<void> {
    if (!this.audio) throw new Error('play() sin track cargado (local).');
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    await this.audio.play();
    this.state = 'playing';
  }

  async pause(): Promise<void> {
    this.audio?.pause();
    this.state = 'paused';
  }

  async seek(positionMs: number): Promise<void> {
    if (this.audio) this.audio.currentTime = Math.max(0, positionMs) / 1000;
  }

  async setVolume(volume: number): Promise<void> {
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(clamp01(volume), now);
  }

  async fadeTo(target: number, durationMs: number): Promise<void> {
    const now = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(clamp01(target), now + Math.max(0, durationMs) / 1000);
  }

  getPosition(): number {
    return this.audio ? this.audio.currentTime * 1000 : 0;
  }

  getState(): PlaybackState {
    return this.state;
  }

  async stop(): Promise<void> {
    await this.releaseMedia();
    this.state = 'idle';
  }

  private async releaseMedia(): Promise<void> {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = '';
    }
    try { this.node?.disconnect(); } catch { /* noop */ }
    this.audio = undefined;
    this.node = undefined;
  }
}
