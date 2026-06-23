import { describe, it, expect } from 'vitest';
import { decideSeam, activeIndexAt, fadeDurationMs } from './playbackPlan';

describe('decideSeam — empalmes según capacidades del proveedor', () => {
  it('crossfade real sólo entre locales', () => {
    expect(decideSeam('local', 'local')).toBe('crossfade');
  });

  it('fade a silencio entre proveedores sellados o mixtos', () => {
    expect(decideSeam('spotify', 'youtube')).toBe('fade');
    expect(decideSeam('local', 'spotify')).toBe('fade');
    expect(decideSeam('youtube', 'local')).toBe('fade');
  });

  it('primer elemento hace fade-in; sin siguiente, corte', () => {
    expect(decideSeam(undefined, 'local')).toBe('fade');
    expect(decideSeam('local', undefined)).toBe('cut');
  });
});

describe('activeIndexAt', () => {
  const els = [
    { startTimeMs: 0, endTimeMs: 1000 },
    { startTimeMs: 1000, endTimeMs: 3000 },
    { startTimeMs: 3000, endTimeMs: 4000 },
  ];

  it('ubica la posición en el elemento correcto', () => {
    expect(activeIndexAt(els, 0)).toBe(0);
    expect(activeIndexAt(els, 999)).toBe(0);
    expect(activeIndexAt(els, 1000)).toBe(1);
    expect(activeIndexAt(els, 2999)).toBe(1);
    expect(activeIndexAt(els, 3500)).toBe(2);
  });

  it('más allá del final se queda en el último; vacío devuelve -1', () => {
    expect(activeIndexAt(els, 99999)).toBe(2);
    expect(activeIndexAt([], 10)).toBe(-1);
  });
});

describe('fadeDurationMs', () => {
  it('acota el fade a la mitad de la duración del elemento', () => {
    expect(fadeDurationMs(10000, 3000)).toBe(3000);
    expect(fadeDurationMs(4000, 3000)).toBe(2000);
    expect(fadeDurationMs(0, 3000)).toBe(0);
  });
});
