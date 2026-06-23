import { describe, it, expect } from 'vitest';
import { generateDraft, validateAppTemplate, toCoreTemplate } from './coreMapping';
import type { AttributeDefinition, Track, RitualTemplate } from '../types';

const attrs: AttributeDefinition[] = [
  { id: 'calm', name: 'Calma', color: '#5b9bd5', kind: 'intensity', min: 1, max: 10, builtIn: true, ownerId: 'u1' },
  { id: 'energy', name: 'Energía', color: '#e8743b', kind: 'intensity', min: 1, max: 10, builtIn: true, ownerId: 'u1' },
];

const tracks: Track[] = [
  { id: 't1', title: 'Apertura', durationMs: 300000, tags: [{ defId: 'calm', value: 8 }], source: { provider: 'youtube', externalId: 'a' }, ownerId: 'u1' },
  { id: 't2', title: 'Subida', durationMs: 300000, tags: [{ defId: 'energy', value: 8 }], source: { provider: 'spotify', externalId: 'b' }, ownerId: 'u1' },
  { id: 't3', title: 'Pico', durationMs: 300000, tags: [{ defId: 'energy', value: 10 }], source: { provider: 'local', externalId: 'c' }, ownerId: 'u1' },
  { id: 't4', title: 'Cierre', durationMs: 300000, tags: [{ defId: 'calm', value: 9 }], source: { provider: 'youtube', externalId: 'd' }, ownerId: 'u1' },
];

const template: RitualTemplate = {
  id: 'tmpl1',
  name: 'Viaje',
  totalDurationMs: 60 * 60 * 1000, // 1h
  curve: [{ t: 0, energy: 20 }, { t: 50, energy: 90 }, { t: 100, energy: 20 }],
  regions: [
    { id: 'r1', name: 'Apertura', startT: 0, endT: 50, targets: [{ defId: 'calm', weight: 80, min: 6, max: 10 }] },
    { id: 'r2', name: 'Pico', startT: 50, endT: 100, targets: [{ defId: 'energy', weight: 90, min: 7, max: 10 }] },
  ],
  anchors: [],
  silences: [{ id: 's1', t: 50, durationMs: 5 * 60 * 1000 }],
  ambient: { enabled: true, baseVolume: 35 },
  ownerId: 'u1',
};

describe('coreMapping — escalas UI (0..100) → núcleo (0..1)', () => {
  it('normaliza curva, regiones, silencios, ambiente y peso de targets', () => {
    const core = toCoreTemplate(template);
    expect(core.curve).toEqual([{ t: 0, energy: 0.2 }, { t: 0.5, energy: 0.9 }, { t: 1, energy: 0.2 }]);
    expect(core.regions[0].startT).toBe(0);
    expect(core.regions[0].endT).toBe(0.5);
    expect(core.regions[0].targets[0].weight).toBeCloseTo(0.8);
    // min/max son intensidades 1..10: NO se normalizan.
    expect(core.regions[0].targets[0].min).toBe(6);
    expect(core.silences[0].t).toBe(0.5);
    expect(core.ambient?.baseVolume).toBeCloseTo(0.35);
  });
});

describe('generateDraft — usa el generate() real y devuelve modelo de UI', () => {
  it('produce un borrador editable con tiempos absolutos y reproducible por semilla', () => {
    const a = generateDraft(template, tracks, attrs, { seed: 7, variability: 30 });
    const b = generateDraft(template, tracks, attrs, { seed: 7, variability: 30 });
    expect(a.elements.length).toBeGreaterThan(0);
    expect(a.elements.map((e) => e.trackId)).toEqual(b.elements.map((e) => e.trackId)); // determinista
    // Tiempos absolutos consistentes.
    for (const el of a.elements) {
      expect(el.endTimeMs).toBe(el.startTimeMs + el.durationMs);
    }
    // Incluye el silencio planificado y al menos un track hidratado.
    expect(a.elements.some((e) => e.type === 'silence')).toBe(true);
    expect(a.elements.some((e) => e.type === 'track' && !!e.track)).toBe(true);
  });
});

describe('validateAppTemplate — gatea el guardado', () => {
  it('acepta una plantilla bien formada', () => {
    expect(validateAppTemplate(template, tracks, attrs).ok).toBe(true);
  });

  it('rechaza una región invertida (startT >= endT)', () => {
    const bad: RitualTemplate = {
      ...template,
      regions: [{ id: 'r1', startT: 80, endT: 20, targets: [] }],
    };
    const res = validateAppTemplate(bad, tracks, attrs);
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });

  it('marca error si un ancla referencia un track inexistente', () => {
    const bad: RitualTemplate = {
      ...template,
      anchors: [{ id: 'anc1', trackId: 'NO_EXISTE', placement: { type: 'time', t: 30 } }],
    };
    const res = validateAppTemplate(bad, tracks, attrs);
    expect(res.ok).toBe(false);
  });
});

describe('coreMapping — placement de anclas (UI → núcleo)', () => {
  it("traduce 'time' a 0..1 y pasa 'region'/'anywhere' tal cual", () => {
    const withAnchors: RitualTemplate = {
      ...template,
      anchors: [
        { id: 'a1', trackId: 't1', placement: { type: 'time', t: 40 } },
        { id: 'a2', trackId: 't2', placement: { type: 'region', regionId: 'r2', position: 'end' } },
        { id: 'a3', trackId: 't3', placement: { type: 'anywhere' } },
      ],
    };
    const core = toCoreTemplate(withAnchors);
    expect(core.anchors[0].placement).toEqual({ type: 'time', t: 0.4 });
    expect(core.anchors[1].placement).toEqual({ type: 'region', regionId: 'r2', position: 'end' });
    expect(core.anchors[2].placement).toEqual({ type: 'anywhere' });
  });

  it('acepta una plantilla con un ancla por región válida', () => {
    const withAnchors: RitualTemplate = {
      ...template,
      anchors: [{ id: 'a2', trackId: 't2', placement: { type: 'region', regionId: 'r2', position: 'end' } }],
    };
    expect(validateAppTemplate(withAnchors, tracks, attrs).ok).toBe(true);
  });
});
