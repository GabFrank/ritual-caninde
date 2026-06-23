// Puente entre el modelo de UI (src/types.ts) y el núcleo puro (src/ritual-core).
//
// La UI trabaja con escalas 0..100 (curva, regiones, anclas, volumen) y un `placement`
// numérico, mientras el núcleo usa 0..1 y un `AnchorPlacement` estructurado. Acá se
// convierte en el LÍMITE: justo antes de generar/validar. Lo persistido sigue en el
// modelo de UI; el núcleo nunca toca Firestore ni viceversa.
//
// (Fase 4 podrá migrar el editor a las escalas del núcleo y achicar este puente.)

import {
  generate,
  validateTemplate,
  makeId,
  type ValidationResult,
  type RitualTemplate as CoreTemplate,
  type Track as CoreTrack,
  type AttributeDefinition as CoreAttribute,
  type AttributeTarget as CoreTarget,
} from '../ritual-core';
import type {
  AttributeDefinition,
  GeneratedSequence,
  RegionTarget,
  RitualTemplate,
  SequenceElement,
  Track,
} from '../types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
const pct = (n: number): number => clamp01((n ?? 0) / 100);

// ---------------------------------------------------------------------------
// UI → núcleo
// ---------------------------------------------------------------------------

export function toCoreAttribute(a: AttributeDefinition): CoreAttribute {
  return {
    id: a.id,
    name: a.name,
    color: a.color,
    kind: a.kind,
    options: a.options,
    min: a.min,
    max: a.max,
    builtIn: a.builtIn,
  };
}

export function toCoreTrack(t: Track): CoreTrack {
  return {
    id: t.id,
    title: t.title,
    artist: t.artist,
    durationMs: t.durationMs,
    tags: t.tags.map((tag) => ({ defId: tag.defId, value: tag.value })),
    source: { provider: t.source.provider, externalId: t.source.externalId, uri: t.source.uri },
    audioMeta: t.audioMeta,
  };
}

function toCoreTarget(target: RegionTarget): CoreTarget {
  return {
    defId: target.defId,
    // En la UI el peso es 0..100; el núcleo lo pondera en 0..1.
    weight: pct(target.weight),
    // min/max son intensidades (1..10): NO se normalizan.
    min: target.min,
    max: target.max,
    equals: target.equals,
  };
}

export function toCoreTemplate(tmpl: RitualTemplate): CoreTemplate {
  return {
    id: tmpl.id,
    name: tmpl.name,
    totalDurationMs: tmpl.totalDurationMs,
    curve: tmpl.curve.map((p) => ({ t: pct(p.t), energy: pct(p.energy) })),
    regions: tmpl.regions.map((r) => ({
      id: r.id,
      name: r.name,
      startT: pct(r.startT),
      endT: pct(r.endT),
      targets: r.targets.map(toCoreTarget),
    })),
    anchors: tmpl.anchors.map((a) => ({
      id: a.id,
      trackId: a.trackId,
      // 'time' usa escala UI (0..100 → 0..1); 'region'/'anywhere' pasan tal cual.
      placement:
        a.placement.type === 'time'
          ? { type: 'time' as const, t: pct(a.placement.t) }
          : a.placement,
    })),
    silences: tmpl.silences.map((s) => ({ id: s.id, t: pct(s.t), durationMs: s.durationMs })),
    ambient: tmpl.ambient
      ? {
          enabled: tmpl.ambient.enabled,
          trackId: tmpl.ambient.trackId,
          baseVolume: pct(tmpl.ambient.baseVolume),
        }
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// Validación (antes de persistir una plantilla)
// ---------------------------------------------------------------------------

/** Valida una plantilla de UI con el validador del núcleo (chequea refs si se pasan). */
export function validateAppTemplate(
  template: RitualTemplate,
  tracks?: Track[],
  attributes?: AttributeDefinition[],
): ValidationResult {
  return validateTemplate(
    toCoreTemplate(template),
    tracks?.map(toCoreTrack),
    attributes?.map(toCoreAttribute),
  );
}

// ---------------------------------------------------------------------------
// Generación (pantalla Reproducir) — llama al generate() real del núcleo
// ---------------------------------------------------------------------------

export interface DraftOptions {
  seed: number;
  /** Variabilidad de la UI (0..100) → temperatura del azar controlado (0..1). */
  variability: number;
}

/**
 * Genera el BORRADOR editable usando el motor real del núcleo y lo devuelve en el
 * modelo de UI (con tracks hidratados y tiempos absolutos) para la timeline.
 */
export function generateDraft(
  template: RitualTemplate,
  tracks: Track[],
  attributes: AttributeDefinition[],
  options: DraftOptions,
): GeneratedSequence {
  const core = generate(
    toCoreTemplate(template),
    tracks.map(toCoreTrack),
    attributes.map(toCoreAttribute),
    { seed: options.seed, temperature: clamp01(options.variability / 100) },
  );

  const byId = new Map(tracks.map((t) => [t.id, t]));

  const elements: SequenceElement[] = core.elements.map((el, i) => {
    const startTimeMs = el.startMs;
    const endTimeMs = el.startMs + el.durationMs;

    if (el.kind === 'silence') {
      return {
        id: `el-${i}`,
        type: 'silence',
        name: 'Silencio Sagrado',
        durationMs: el.durationMs,
        startTimeMs,
        endTimeMs,
      };
    }

    const track = el.trackId ? byId.get(el.trackId) : undefined;
    const isNature = el.kind === 'nature';
    return {
      id: `el-${i}`,
      type: isNature ? 'ambient' : 'track',
      trackId: el.trackId,
      track,
      name: isNature ? track?.title || 'Capa de Naturaleza' : track?.title,
      provider: track?.source.provider,
      durationMs: el.durationMs,
      startTimeMs,
      endTimeMs,
    };
  });

  return {
    id: makeId('seq'),
    templateId: core.templateId,
    seed: core.seed,
    elements,
    warnings: core.warnings,
    ownerId: template.ownerId,
    createdAt: new Date(),
  };
}
