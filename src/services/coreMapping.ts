// Puente entre la app y el núcleo puro (src/ritual-core).
//
// Tras migrar el modelo de la app a la escala del núcleo (todo en 0..1, mismas formas),
// los tipos de la app son un superset estructural de los del núcleo, así que las
// entidades se pasan DIRECTO a generate()/validateTemplate() sin conversión de escala.
//
// Sólo queda un mapeo de salida: la GeneratedSequence del núcleo (startMs/durationMs/
// kind/trackId) se traduce al modelo de timeline de la UI (tiempos absolutos, track
// hidratado, nombres) para la pantalla Reproducir.

import {
  generate,
  validateTemplate,
  makeId,
  type ValidationResult,
} from '../ritual-core';
import type {
  AttributeDefinition,
  GeneratedSequence,
  RitualTemplate,
  SequenceElement,
  Track,
} from '../types';

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

// ---------------------------------------------------------------------------
// Validación (antes de persistir una plantilla)
// ---------------------------------------------------------------------------

/** Valida una plantilla con el validador del núcleo (chequea refs si se pasan). */
export function validateAppTemplate(
  template: RitualTemplate,
  tracks?: Track[],
  attributes?: AttributeDefinition[],
): ValidationResult {
  return validateTemplate(template, tracks, attributes);
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
 * modelo de timeline de la UI (con tracks hidratados y tiempos absolutos).
 */
export function generateDraft(
  template: RitualTemplate,
  tracks: Track[],
  attributes: AttributeDefinition[],
  options: DraftOptions,
): GeneratedSequence {
  const core = generate(template, tracks, attributes, {
    seed: options.seed,
    temperature: clamp01(options.variability / 100),
  });

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
