import { RitualTemplate, Track, GeneratedSequence, SequenceElement } from '../types';

/**
 * RITUAL CANINDÉ - GENERADOR LEGADO (TEMPORAL)
 *
 * Este es el mock que originalmente vivía en `src/ritual-core/index.ts`. Se preservó
 * aquí tal cual para que la UI (TimelineView) siga compilando y funcionando tras
 * incorporar el `ritual-core` real (puro) en `src/ritual-core/`.
 *
 * ⚠️ TEMPORAL: en la Fase 2 la pantalla Reproducir debe llamar a `generate(...)` del
 * `ritual-core` real (con reconciliación de tipos app ↔ core) y este archivo se elimina.
 */

export interface GeneratorOptions {
  seed: number;
  variability: number; // 0 a 100
}

/**
 * Genera una secuencia de reproducción (borrador editable) a partir de una plantilla
 * de ritual, un conjunto de canciones disponibles, y parámetros de semilla/variación.
 */
export function generateSequence(
  template: RitualTemplate,
  tracks: Track[],
  options: GeneratorOptions
): GeneratedSequence {
  const { seed, variability } = options;
  const elements: SequenceElement[] = [];
  const warnings: string[] = [];

  // 1. Identificar canciones disponibles
  if (tracks.length === 0) {
    warnings.push("No hay canciones en la biblioteca de este usuario para generar el viaje.");
    // Crear un mock básico de todas formas si no hay temas
    const duration = template.totalDurationMs || 3600000; // 1 hora
    elements.push({
      id: "mock-ambient-start",
      type: "track",
      name: "Espacio de Inicio (Demo Sin Biblioteca)",
      durationMs: duration / 2,
      startTimeMs: 0,
      endTimeMs: duration / 2,
      provider: "local"
    });
    elements.push({
      id: "mock-silence-mid",
      type: "silence",
      name: "Silencio de Integración",
      durationMs: 300000, // 5 min
      startTimeMs: duration / 2,
      endTimeMs: (duration / 2) + 300000,
    });
    elements.push({
      id: "mock-ambient-end",
      type: "track",
      name: "Espacio de Cierre (Demo Sin Biblioteca)",
      durationMs: (duration / 2) - 300000,
      startTimeMs: (duration / 2) + 300000,
      endTimeMs: duration,
      provider: "local"
    });

    return {
      id: `seq-${Date.now()}-${seed}`,
      templateId: template.id,
      seed,
      elements,
      warnings,
      ownerId: template.ownerId,
      createdAt: new Date()
    };
  }

  // 2. Generar basándonos en la duración total de la plantilla
  const totalDuration = template.totalDurationMs || 3600000; // 1 hora por defecto
  let currentTimeMs = 0;

  // Insertar Anclas al principio, medio o final simulando el matching de placement
  const anchors = [...template.anchors];
  const silences = [...template.silences];

  // Ordenar silences por tiempo de aparición t (0-100%)
  silences.sort((a, b) => a.t - b.t);

  // Intentar rellenar el viaje distribuyendo temas
  // Mapeamos los puntos de la curva de energía para simular que seleccionamos temas concordantes
  // con la energía y las regiones emocionales.
  let trackIndex = 0;
  let elementIdCounter = 1;

  while (currentTimeMs < totalDuration && trackIndex < 40) {
    // Determinar porcentaje actual
    const currentPercent = (currentTimeMs / totalDuration) * 100;

    // Verificar si hay un silencio programado cerca de este porcentaje
    const nextSilence = silences.find(s => s.t >= currentPercent && s.t < currentPercent + 8 && !elements.some(el => el.type === 'silence' && Math.abs((el.startTimeMs / totalDuration) * 100 - s.t) < 5));
    if (nextSilence) {
      const silenceDuration = nextSilence.durationMs;
      elements.push({
        id: `el-silence-${elementIdCounter++}`,
        type: 'silence',
        name: 'Silencio Sagrado',
        durationMs: silenceDuration,
        startTimeMs: currentTimeMs,
        endTimeMs: currentTimeMs + silenceDuration
      });
      currentTimeMs += silenceDuration;
      continue;
    }

    // Verificar si hay un ancla aquí
    const nextAnchor = anchors.find(a => a.placement >= currentPercent && a.placement < currentPercent + 12 && !elements.some(el => el.trackId === a.trackId));
    if (nextAnchor) {
      const anchorTrack = tracks.find(t => t.id === nextAnchor.trackId);
      if (anchorTrack) {
        elements.push({
          id: `el-anchor-${elementIdCounter++}`,
          type: 'track',
          trackId: anchorTrack.id,
          track: anchorTrack,
          durationMs: anchorTrack.durationMs,
          startTimeMs: currentTimeMs,
          endTimeMs: currentTimeMs + anchorTrack.durationMs,
          provider: anchorTrack.source.provider
        });
        currentTimeMs += anchorTrack.durationMs;
        continue;
      }
    }

    // Alternativamente, tomamos un tema de la biblioteca que encaje "emocionalmente".
    // Para el mock, seleccionamos un tema rotando los disponibles y haciéndole calzar con la duración.
    const selectedTrack = tracks[trackIndex % tracks.length];
    trackIndex++;

    // Si el tema excede por mucho el tiempo restante, lo acortamos o paramos
    const remainingTime = totalDuration - currentTimeMs;
    const trackDuration = Math.min(selectedTrack.durationMs, remainingTime > 60000 ? selectedTrack.durationMs : remainingTime);

    if (trackDuration <= 0) break;

    elements.push({
      id: `el-track-${elementIdCounter++}`,
      type: 'track',
      trackId: selectedTrack.id,
      track: selectedTrack,
      durationMs: trackDuration,
      startTimeMs: currentTimeMs,
      endTimeMs: currentTimeMs + trackDuration,
      provider: selectedTrack.source.provider
    });

    currentTimeMs += trackDuration;
  }

  // Si habilitamos el ambiente, agregamos una capa en los warnings indicando que la capa de ambiente está predispuesta
  if (template.ambient?.enabled) {
    const ambientTrack = tracks.find(t => t.id === template.ambient?.trackId);
    if (ambientTrack) {
      warnings.push(`Capa de ambiente activa en segundo plano: "${ambientTrack.title}" (${template.ambient.baseVolume}% de volumen)`);
    } else {
      warnings.push(`Capa de ambiente activada con sonido por defecto (Volumen: ${template.ambient?.baseVolume || 50}%)`);
    }
  }

  // Generar advertencia simulada si es que falta energía o no se completó la duración entera
  if (currentTimeMs < totalDuration) {
    warnings.push(`La duración del viaje es menor a la requerida por ${Math.round((totalDuration - currentTimeMs) / 60000)} minutos. Se sugiere añadir más temas o silencias.`);
  }

  return {
    id: `seq-${Date.now()}-${seed}`,
    templateId: template.id,
    seed,
    elements,
    warnings,
    ownerId: template.ownerId,
    createdAt: new Date()
  };
}
