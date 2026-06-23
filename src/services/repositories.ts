// Repositorios concretos por entidad (Fase 2).
//
// Una colección por entidad, igual que CanindéChords. Cada repo queda atado al
// dueño (uid) y expone el puerto `Repository<T>` del núcleo. La UI/persistencia los
// usa sin saber que por debajo hay Firestore.

import { FirestoreRepository } from './firestoreRepository';
import type { AttributeDefinition, Track, RitualTemplate, GeneratedSequence } from '../types';
import type { Repository } from '../ritual-core';

export const COLLECTIONS = {
  attributeDefinitions: 'attributeDefinitions',
  tracks: 'tracks',
  ritualTemplates: 'ritualTemplates',
  generatedSequences: 'generatedSequences',
} as const;

export interface Repositories {
  attributes: Repository<AttributeDefinition>;
  tracks: Repository<Track>;
  templates: Repository<RitualTemplate>;
  sequences: Repository<GeneratedSequence>;
}

/** Construye el set de repositorios para el usuario actual. */
export function makeRepositories(ownerId: string): Repositories {
  return {
    attributes: new FirestoreRepository<AttributeDefinition>(COLLECTIONS.attributeDefinitions, ownerId),
    tracks: new FirestoreRepository<Track>(COLLECTIONS.tracks, ownerId),
    templates: new FirestoreRepository<RitualTemplate>(COLLECTIONS.ritualTemplates, ownerId),
    sequences: new FirestoreRepository<GeneratedSequence>(COLLECTIONS.generatedSequences, ownerId),
  };
}
