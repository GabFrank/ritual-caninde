// Controlador de reproducción (Fase 6).
//
// Recorre el borrador (elementos de la timeline de la UI) elemento por elemento. La
// LÍNEA DE TIEMPO avanza por reloj de pared (robusto: progresa aunque un SDK falle o
// esté en simulación); el engine concreto sólo aporta el audio real y los fades.
//
// Empalmes: fade-in al entrar y fade-out al salir (rampas reales en el engine local).
// El crossfade por solapamiento queda como refinamiento posterior; decideSeam/fade ya
// distinguen local↔local del resto.

import type { Provider } from '../../ritual-core';
import type { SequenceElement } from '../../types';
import { EngineRegistry } from './registry';
import { fadeDurationMs } from './playbackPlan';

export interface ControllerCallbacks {
  onIndexChange?(index: number): void;
  onTick?(globalElapsedMs: number, elementElapsedMs: number): void;
  onStateChange?(playing: boolean): void;
  onEnded?(): void;
}

const FADE_MS = 2500;
const TICK_MS = 250;

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));
const clampIdx = (i: number, max: number): number => Math.max(0, Math.min(max, i));

export class PlaybackController {
  private index = 0;
  private playing = false;
  private timer?: number;
  private startedAt = 0; // epoch ms del inicio del elemento (ajustado por offset)
  private offsetMs = 0; // posición dentro del elemento al pausar
  private masterVolume = 0.8;
  private fadingOut = false;

  constructor(
    private elements: SequenceElement[],
    private registry: EngineRegistry,
    private cb: ControllerCallbacks = {},
  ) {}

  get currentIndex(): number {
    return this.index;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  setMasterVolume(v: number): void {
    this.masterVolume = clamp01(v);
    if (!this.fadingOut) void this.currentEngine()?.setVolume(this.masterVolume);
  }

  async play(): Promise<void> {
    if (this.playing) return;
    this.playing = true;
    this.cb.onStateChange?.(true);
    await this.startElement(this.index, this.offsetMs);
    this.startTimer();
  }

  async pause(): Promise<void> {
    if (!this.playing) return;
    this.playing = false;
    this.stopTimer();
    this.offsetMs = Date.now() - this.startedAt;
    await this.currentEngine()?.pause();
    this.cb.onStateChange?.(false);
  }

  async toggle(): Promise<void> {
    if (this.playing) await this.pause();
    else await this.play();
  }

  async seekToIndex(i: number): Promise<void> {
    await this.haltCurrent();
    this.index = clampIdx(i, this.elements.length - 1);
    this.offsetMs = 0;
    this.fadingOut = false;
    this.cb.onIndexChange?.(this.index);
    this.cb.onTick?.(this.currentEl()?.startTimeMs ?? 0, 0);
    if (this.playing) await this.startElement(this.index, 0);
  }

  async next(): Promise<void> {
    await this.seekToIndex(this.index + 1);
  }

  async restart(): Promise<void> {
    await this.seekToIndex(0);
  }

  async dispose(): Promise<void> {
    this.playing = false;
    this.stopTimer();
    await this.registry.disposeAll();
  }

  // ---- internos ----

  private currentEl(): SequenceElement | undefined {
    return this.elements[this.index];
  }

  private engineFor(el: SequenceElement | undefined) {
    if (!el || el.type === 'silence' || !el.provider || !el.track) return undefined;
    return this.registry.get(el.provider as Provider);
  }

  private currentEngine() {
    return this.engineFor(this.currentEl());
  }

  private async startElement(i: number, offsetMs: number): Promise<void> {
    const el = this.elements[i];
    if (!el) {
      this.finish();
      return;
    }
    this.fadingOut = false;
    this.startedAt = Date.now() - offsetMs;

    const engine = this.engineFor(el);
    if (!engine || !el.track) return; // silencio o sin track → sólo corre el reloj

    try {
      await engine.load(el.track);
      await engine.setVolume(0);
      if (offsetMs > 0) await engine.seek(offsetMs);
      await engine.play();
      const fin = fadeDurationMs(el.durationMs, FADE_MS);
      await engine.fadeTo(this.masterVolume, fin);
    } catch {
      // Si el engine real falla, la timeline igual avanza por reloj de pared.
    }
  }

  private async haltCurrent(): Promise<void> {
    try {
      await this.currentEngine()?.stop();
    } catch {
      /* noop */
    }
  }

  private startTimer(): void {
    this.stopTimer();
    this.timer = window.setInterval(() => void this.tick(), TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private async tick(): Promise<void> {
    if (!this.playing) return;
    const el = this.currentEl();
    if (!el) {
      this.finish();
      return;
    }
    const elapsed = Date.now() - this.startedAt;
    const global = el.startTimeMs + Math.min(elapsed, el.durationMs);
    this.cb.onTick?.(global, Math.min(elapsed, el.durationMs));

    const remaining = el.durationMs - elapsed;
    const engine = this.engineFor(el);
    const fout = fadeDurationMs(el.durationMs, FADE_MS);
    if (engine && !this.fadingOut && remaining <= fout) {
      this.fadingOut = true;
      void engine.fadeTo(0, Math.max(0, remaining));
    }
    if (remaining <= 0) await this.advance();
  }

  private async advance(): Promise<void> {
    await this.haltCurrent();
    if (this.index >= this.elements.length - 1) {
      this.finish();
      return;
    }
    this.index += 1;
    this.offsetMs = 0;
    this.fadingOut = false;
    this.cb.onIndexChange?.(this.index);
    await this.startElement(this.index, 0);
  }

  private finish(): void {
    this.playing = false;
    this.stopTimer();
    this.cb.onStateChange?.(false);
    this.cb.onEnded?.();
  }
}
