import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInAnonymously,
  User
} from 'firebase/auth';
import { AttributeDefinition, Track, RitualTemplate, GeneratedSequence } from '../types';
import { makeId } from '../ritual-core';
import { makeRepositories } from './repositories';

// Firebase configuration from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyBEChJqpIidCwZ_s_JpL3lO0WIriOWikIQ",
  authDomain: "franco-control.firebaseapp.com",
  projectId: "franco-control",
  storageBucket: "franco-control.firebasestorage.app",
  messagingSenderId: "354392857215",
  appId: "1:354392857215:web:45a74dc3cdb402e43e3d4a"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom databaseId
export const db = initializeFirestore(app, {}, "ai-studio-44008411-4d7f-44ef-a0d8-414d9fdceb4e");

// Initialize Auth
export const auth = getAuth(app);

// Provider for Google Login
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

/**
 * Sign in using Google Popup Auth.
 * Fallbacks to Anonymous Sign in if blocked by iframe policies in AI Studio.
 */
export async function signInWithGoogle(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn("Google Popup sign in failed or blocked, attempting anonymous fallback...", error);
    // Standard error for blocked popups or restrictions
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/operation-not-supported-in-this-environment') {
      const anonResult = await signInAnonymously(auth);
      return anonResult.user;
    }
    throw error;
  }
}

/**
 * Sign in anonymously for easy testing
 */
export async function signInDemoGuest(): Promise<User> {
  const anonResult = await signInAnonymously(auth);
  return anonResult.user;
}

/**
 * Sign out
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// ----------------------------------------------------
// PERSISTENCIA: todo el CRUD pasa por FirestoreRepository<T>, el adaptador del puerto
// Repository<T> de ritual-core. Una colección por entidad; el ownerId y los timestamps
// los estampa el repositorio, que además sanea con sanitizeForStorage antes de escribir.
// ----------------------------------------------------

// ----------------------------------------------------
// SEED DATA HELPERS FOR NEW USERS
// ----------------------------------------------------

const BUILT_IN_EMOTIONS = [
  { name: "Intención / Rezo", color: "#a855f7", kind: "intensity", min: 1, max: 10, builtIn: true },
  { name: "Apertura / Expansión", color: "#3b82f6", kind: "intensity", min: 1, max: 10, builtIn: true },
  { name: "Poder / Fuego", color: "#ef4444", kind: "intensity", min: 1, max: 10, builtIn: true },
  { name: "Profundidad / Introspección", color: "#6366f1", kind: "intensity", min: 1, max: 10, builtIn: true },
  { name: "Celebración / Éxtasis", color: "#f59e0b", kind: "intensity", min: 1, max: 10, builtIn: true },
  { name: "Integración / Paz", color: "#10b981", kind: "intensity", min: 1, max: 10, builtIn: true }
];

const PRE_CURATED_TRACKS = [
  {
    title: "Vuela con el Viento",
    artist: "Ayla Schafer",
    durationMs: 345000, // 5:45
    source: { provider: "youtube", externalId: "mB-OuhqAnK8" },
    audioMeta: { keyCamelot: "8A", bpm: 85 },
    tagMapping: [
      { name: "Apertura / Expansión", value: 8 },
      { name: "Integración / Paz", value: 6 },
      { name: "Intención / Rezo", value: 7 }
    ]
  },
  {
    title: "Medicine Melodies",
    artist: "Danit",
    durationMs: 420000, // 7:00
    source: { provider: "spotify", externalId: "3Z9O678a9B" },
    audioMeta: { keyCamelot: "11A", bpm: 90 },
    tagMapping: [
      { name: "Integración / Paz", value: 9 },
      { name: "Profundidad / Introspección", value: 8 }
    ]
  },
  {
    title: "Fuerza del Pedote",
    artist: "Hymn Tradicional",
    durationMs: 280000, // 4:40
    source: { provider: "local", externalId: "local_fuerza" },
    audioMeta: { keyCamelot: "5A", bpm: 105 },
    tagMapping: [
      { name: "Poder / Fuego", value: 9 },
      { name: "Celebración / Éxtasis", value: 7 }
    ]
  },
  {
    title: "Icaro de Sanación",
    artist: "Chamán Shipibo",
    durationMs: 510000, // 8:30
    source: { provider: "youtube", externalId: "custom_icaro" },
    audioMeta: { keyCamelot: "2A", bpm: 70 },
    tagMapping: [
      { name: "Profundidad / Introspección", value: 10 },
      { name: "Intención / Rezo", value: 9 }
    ]
  }
];

const PRE_CURATED_TEMPLATES = [
  {
    name: "Ceremonia de Medicina Sagrada (Estándar)",
    totalDurationMs: 4 * 60 * 60 * 1000, // 4 Horas
    curve: [
      { t: 0, energy: 20 },
      { t: 15, energy: 40 },
      { t: 30, energy: 60 },
      { t: 50, energy: 85 },
      { t: 70, energy: 50 },
      { t: 85, energy: 30 },
      { t: 100, energy: 15 }
    ],
    regions: [
      { id: "reg-1", name: "Apertura del Altar", startT: 0, endT: 20, targets: [] },
      { id: "reg-2", name: "Trance Profundo", startT: 20, endT: 45, targets: [] },
      { id: "reg-3", name: "Elevación de Energía - Fuego", startT: 45, endT: 70, targets: [] },
      { id: "reg-4", name: "Integración y Rezando", startT: 70, endT: 100, targets: [] }
    ],
    anchors: [],
    silences: [
      { id: "sil-1", t: 45, durationMs: 5 * 60 * 1000 }, // 5 mins de silencio antes del climax
      { id: "sil-2", t: 70, durationMs: 10 * 60 * 1000 } // 10 mins tras la bajada
    ],
    ambient: { enabled: true, baseVolume: 35 }
  }
];

/**
 * Seeds a user's collection on Firestore if it doesn't have emotions configured.
 */
export async function seedUserDataIfNeeded(userId: string): Promise<void> {
  const repos = makeRepositories(userId);
  const existing = await repos.attributes.list();
  if (existing.length > 0) return;

  console.log("Seeding default emotions and tracks for user:", userId);

  // 1. Seed emotions and map their assigned ids.
  const createdEmotionsMap: Record<string, string> = {};
  for (const em of BUILT_IN_EMOTIONS) {
    const id = makeId('attr');
    const emotion: AttributeDefinition = {
      id,
      name: em.name,
      color: em.color,
      kind: em.kind as any,
      min: em.min,
      max: em.max,
      builtIn: em.builtIn,
      ownerId: userId,
    };
    await repos.attributes.save(emotion);
    createdEmotionsMap[em.name] = id;
  }

  // 2. Seed pre-curated tracks, mapping tags to the freshly created emotion ids.
  for (const tr of PRE_CURATED_TRACKS) {
    const tags = tr.tagMapping
      .filter((tm) => createdEmotionsMap[tm.name])
      .map((tm) => ({ defId: createdEmotionsMap[tm.name], value: tm.value }));

    const track: Track = {
      id: makeId('track'),
      title: tr.title,
      artist: tr.artist,
      durationMs: tr.durationMs,
      tags,
      source: tr.source as any,
      audioMeta: tr.audioMeta,
      ownerId: userId,
    };
    await repos.tracks.save(track);
  }

  // 3. Seed first template with region climates referencing our seeded emotions.
  for (const tm of PRE_CURATED_TEMPLATES) {
    const customizedRegions = tm.regions.map((reg, index) => {
      const targets: any[] = [];
      if (index === 0) {
        const emId = createdEmotionsMap["Apertura / Expansión"];
        if (emId) targets.push({ defId: emId, weight: 80, min: 6, max: 10 });
      } else if (index === 1) {
        const emId = createdEmotionsMap["Profundidad / Introspección"];
        if (emId) targets.push({ defId: emId, weight: 90, min: 7, max: 10 });
      } else if (index === 2) {
        const emId = createdEmotionsMap["Poder / Fuego"];
        if (emId) targets.push({ defId: emId, weight: 95, min: 8, max: 10 });
      } else if (index === 3) {
        const emId = createdEmotionsMap["Integración / Paz"];
        if (emId) targets.push({ defId: emId, weight: 90, min: 6, max: 10 });
      }
      return { ...reg, targets };
    });

    const template: RitualTemplate = {
      id: makeId('tmpl'),
      name: tm.name,
      totalDurationMs: tm.totalDurationMs,
      curve: tm.curve,
      regions: customizedRegions,
      anchors: tm.anchors,
      silences: tm.silences,
      ambient: tm.ambient,
      ownerId: userId,
    };
    await repos.templates.save(template);
  }
}

// ----------------------------------------------------
// CRUD ATTRIBUTES
// ----------------------------------------------------

export async function fetchAttributes(userId: string): Promise<AttributeDefinition[]> {
  return makeRepositories(userId).attributes.list();
}

export async function createAttribute(
  userId: string,
  attr: Omit<AttributeDefinition, 'id' | 'ownerId' | 'builtIn'>,
): Promise<AttributeDefinition> {
  const entity: AttributeDefinition = { ...attr, id: makeId('attr'), builtIn: false, ownerId: userId };
  return makeRepositories(userId).attributes.save(entity);
}

export async function updateAttribute(userId: string, attr: AttributeDefinition): Promise<void> {
  await makeRepositories(userId).attributes.save(attr);
}

export async function deleteAttribute(userId: string, attrId: string): Promise<void> {
  await makeRepositories(userId).attributes.remove(attrId);
}

// ----------------------------------------------------
// CRUD TRACKS
// ----------------------------------------------------

export async function fetchTracks(userId: string): Promise<Track[]> {
  return makeRepositories(userId).tracks.list();
}

export async function createTrack(userId: string, track: Omit<Track, 'id' | 'ownerId'>): Promise<Track> {
  const entity: Track = { ...track, id: makeId('track'), ownerId: userId };
  return makeRepositories(userId).tracks.save(entity);
}

export async function updateTrack(userId: string, track: Track): Promise<void> {
  await makeRepositories(userId).tracks.save(track);
}

export async function deleteTrack(userId: string, trackId: string): Promise<void> {
  await makeRepositories(userId).tracks.remove(trackId);
}

// ----------------------------------------------------
// CRUD TEMPLATES
// ----------------------------------------------------

export async function fetchTemplates(userId: string): Promise<RitualTemplate[]> {
  return makeRepositories(userId).templates.list();
}

export async function createTemplate(
  userId: string,
  template: Omit<RitualTemplate, 'id' | 'ownerId'>,
): Promise<RitualTemplate> {
  const entity: RitualTemplate = { ...template, id: makeId('tmpl'), ownerId: userId };
  return makeRepositories(userId).templates.save(entity);
}

export async function updateTemplate(userId: string, template: RitualTemplate): Promise<void> {
  await makeRepositories(userId).templates.save(template);
}

export async function deleteTemplate(userId: string, templateId: string): Promise<void> {
  await makeRepositories(userId).templates.remove(templateId);
}

// ----------------------------------------------------
// CRUD GENERATED SEQUENCES
// ----------------------------------------------------

export async function fetchSequences(userId: string): Promise<GeneratedSequence[]> {
  return makeRepositories(userId).sequences.list();
}

export async function saveSequence(userId: string, seq: GeneratedSequence): Promise<GeneratedSequence> {
  return makeRepositories(userId).sequences.save({ ...seq, ownerId: userId });
}

export async function deleteSequence(userId: string, seqId: string): Promise<void> {
  await makeRepositories(userId).sequences.remove(seqId);
}
