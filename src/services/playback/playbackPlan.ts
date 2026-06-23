// Lógica pura de orquestación de reproducción (testeable, sin navegador).
//
// El "empalme" entre dos elementos depende de las capacidades del proveedor (tabla del
// núcleo): sólo el local tiene Web Audio → crossfade real. Entre proveedores sellados
// (Spotify/YouTube) o mixtos se hace fade a silencio (lo tapa la capa de naturaleza).

import { CAPABILITIES, type Provider } from '../../ritual-core';

export type Seam = 'crossfade' | 'fade' | 'cut';

/** Empalme de entrada al pasar de `prev` a `next`. */
export function decideSeam(prev: Provider | undefined, next: Provider | undefined): Seam {
  if (!next) return 'cut';
  if (!prev) return 'fade'; // primer elemento: fade-in suave desde silencio
  // Crossfade real sólo si ambos lados soportan crossfade (hoy: local↔local).
  if (CAPABILITIES[prev].realCrossfade && CAPABILITIES[next].realCrossfade) return 'crossfade';
  return 'fade';
}

export interface TimedElement {
  startTimeMs: number;
  endTimeMs: number;
}

/** Índice del elemento activo en una posición global (ms), o -1 si está vacío. */
export function activeIndexAt(elements: TimedElement[], positionMs: number): number {
  if (elements.length === 0) return -1;
  for (let i = 0; i < elements.length; i++) {
    if (positionMs < elements[i].endTimeMs) return i;
  }
  return elements.length - 1;
}

/** Duración del fade/crossfade acotada a la duración del elemento (no más de la mitad). */
export function fadeDurationMs(elementDurationMs: number, desiredMs: number): number {
  return Math.max(0, Math.min(desiredMs, Math.floor(elementDurationMs / 2)));
}
