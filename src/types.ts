export type AttributeKind = 'intensity' | 'category' | 'flag';

export interface AttributeDefinition {
  id: string;
  name: string;
  color: string; // Tailwind color class or hex, e.g. '#a855f7' or 'violet'
  kind: AttributeKind;
  options?: string[]; // Used for kind === 'category'
  min?: number; // Used for kind === 'intensity' (default: 1)
  max?: number; // Used for kind === 'intensity' (default: 10)
  builtIn: boolean;
  ownerId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface TrackTag {
  defId: string;
  value: number | string | boolean;
}

export interface TrackSource {
  provider: 'spotify' | 'youtube' | 'local';
  externalId: string;
  uri?: string;
}

export interface AudioMeta {
  keyCamelot?: string;
  bpm?: number;
}

export interface Track {
  id: string;
  title: string;
  artist?: string;
  durationMs: number;
  tags: TrackTag[];
  source: TrackSource;
  audioMeta?: AudioMeta; // Hidden from the UI as per product rules
  ownerId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface CurvePoint {
  t: number; // Percentage of total duration (0 to 100)
  energy: number; // Energy level (0 to 100)
}

export interface RegionTarget {
  defId: string;
  weight: number; // How important this target is (0 to 100)
  min?: number;
  max?: number;
  equals?: string;
}

export interface Region {
  id: string;
  name?: string;
  startT: number; // Start percentage (0 to 100)
  endT: number; // End percentage (0 to 100)
  targets: RegionTarget[];
}

/**
 * Dónde se clava un ancla (espejo del AnchorPlacement del núcleo, pero en escala de UI).
 * - 'time'     → posición temporal fija (t en 0..100% de la duración).
 * - 'region'   → atada a una región (al inicio, al final, o en cualquier punto del tramo).
 * - 'anywhere' → el motor la ubica donde mejor encaje.
 */
export type AnchorPlacement =
  | { type: 'time'; t: number }
  | { type: 'region'; regionId: string; position: 'start' | 'end' | 'any' }
  | { type: 'anywhere' };

export interface Anchor {
  id: string;
  trackId: string;
  placement: AnchorPlacement;
}

export interface Silence {
  id: string;
  t: number; // Percentage of total duration (0 to 100)
  durationMs: number;
}

export interface AmbientConfig {
  enabled: boolean;
  trackId?: string;
  baseVolume: number; // Volume percentage (0 to 100)
}

export interface RitualTemplate {
  id: string;
  name: string;
  totalDurationMs: number; // Default duration of the ritual in milliseconds
  curve: CurvePoint[];
  regions: Region[];
  anchors: Anchor[];
  silences: Silence[];
  ambient?: AmbientConfig;
  ownerId: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SequenceElement {
  id: string;
  type: 'track' | 'silence' | 'ambient';
  trackId?: string;
  track?: Track; // Populated client-side for displaying titles/artists
  name?: string; // Descriptive name (e.g. "Silencio de Integración")
  provider?: 'spotify' | 'youtube' | 'local';
  durationMs: number;
  startTimeMs: number;
  endTimeMs: number;
}

export interface GeneratedSequence {
  id: string;
  templateId: string;
  seed: number;
  elements: SequenceElement[];
  warnings: string[];
  ownerId: string;
  createdAt?: any;
}
