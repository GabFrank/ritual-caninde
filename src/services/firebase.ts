import { initializeApp } from 'firebase/app';
import { 
  initializeFirestore, 
  collection, 
  doc, 
  getDocs, 
  getDoc,
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  onAuthStateChanged,
  signInAnonymously,
  User
} from 'firebase/auth';
import { AttributeDefinition, Track, RitualTemplate, GeneratedSequence } from '../types';

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
  const attribCol = collection(db, 'attributeDefinitions');
  const qAttr = query(attribCol, where('ownerId', '==', userId));
  const snapAttr = await getDocs(qAttr);

  if (snapAttr.empty) {
    console.log("Seeding default emotions and tracks for user:", userId);
    
    // 1. Seed emotions and map their assigned Firestore IDs
    const createdEmotionsMap: Record<string, string> = {};
    
    for (const em of BUILT_IN_EMOTIONS) {
      const docRef = doc(attribCol); // auto ID
      const emotionData: AttributeDefinition = {
        id: docRef.id,
        name: em.name,
        color: em.color,
        kind: em.kind as any,
        min: em.min,
        max: em.max,
        builtIn: em.builtIn,
        ownerId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, emotionData);
      createdEmotionsMap[em.name] = docRef.id;
    }

    // Load newly created IDs from map
    const tracksCol = collection(db, 'tracks');
    for (const tr of PRE_CURATED_TRACKS) {
      const docRef = doc(tracksCol);
      const tags = tr.tagMapping
        .filter(tm => createdEmotionsMap[tm.name])
        .map(tm => ({
          defId: createdEmotionsMap[tm.name],
          value: tm.value
        }));

      const trackData: Track = {
        id: docRef.id,
        title: tr.title,
        artist: tr.artist,
        durationMs: tr.durationMs,
        tags,
        source: tr.source as any,
        audioMeta: tr.audioMeta,
        ownerId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, trackData);
    }

    // Setup first template with region mappings using our seeded emotions
    const templatesCol = collection(db, 'ritualTemplates');
    for (const tm of PRE_CURATED_TEMPLATES) {
      const docRef = doc(templatesCol);
      
      // Map region targets
      const customizedRegions = tm.regions.map((reg, index) => {
        const targets: any[] = [];
        if (index === 0) { // Apertura
          const emId = createdEmotionsMap["Apertura / Expansión"] || "";
          if (emId) targets.push({ defId: emId, weight: 80, min: 6, max: 10 });
        } else if (index === 1) { // Trance
          const emId = createdEmotionsMap["Profundidad / Introspección"] || "";
          if (emId) targets.push({ defId: emId, weight: 90, min: 7, max: 10 });
        } else if (index === 2) { // Poder
          const emId = createdEmotionsMap["Poder / Fuego"] || "";
          if (emId) targets.push({ defId: emId, weight: 95, min: 8, max: 10 });
        } else if (index === 3) { // Integración
          const emId = createdEmotionsMap["Integración / Paz"] || "";
          if (emId) targets.push({ defId: emId, weight: 90, min: 6, max: 10 });
        }
        return { ...reg, targets };
      });

      const templateData: RitualTemplate = {
        id: docRef.id,
        name: tm.name,
        totalDurationMs: tm.totalDurationMs,
        curve: tm.curve,
        regions: customizedRegions,
        anchors: tm.anchors,
        silences: tm.silences,
        ambient: tm.ambient,
        ownerId: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, templateData);
    }
  }
}

// ----------------------------------------------------
// CRUD OPERATORS FOR ATTRIBUTES
// ----------------------------------------------------

export async function fetchAttributes(userId: string): Promise<AttributeDefinition[]> {
  const attribCol = collection(db, 'attributeDefinitions');
  // BuiltIn list can also be queried, but here we query user-owned ones
  const q = query(attribCol, where('ownerId', '==', userId));
  const snap = await getDocs(q);
  const items: AttributeDefinition[] = [];
  snap.forEach(doc => {
    items.push(doc.data() as AttributeDefinition);
  });
  return items;
}

export async function createAttribute(userId: string, attr: Omit<AttributeDefinition, 'id' | 'ownerId' | 'builtIn'>): Promise<AttributeDefinition> {
  const docRef = doc(collection(db, 'attributeDefinitions'));
  const newAttr: AttributeDefinition = {
    ...attr,
    id: docRef.id,
    builtIn: false,
    ownerId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await setDoc(docRef, newAttr);
  return newAttr;
}

export async function updateAttribute(attr: AttributeDefinition): Promise<void> {
  const docRef = doc(db, 'attributeDefinitions', attr.id);
  await updateDoc(docRef, {
    ...attr,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteAttribute(attrId: string): Promise<void> {
  await deleteDoc(doc(db, 'attributeDefinitions', attrId));
}

// ----------------------------------------------------
// CRUD OPERATORS FOR TRACKS
// ----------------------------------------------------

export async function fetchTracks(userId: string): Promise<Track[]> {
  const tracksCol = collection(db, 'tracks');
  const q = query(tracksCol, where('ownerId', '==', userId));
  const snap = await getDocs(q);
  const items: Track[] = [];
  snap.forEach(doc => {
    items.push(doc.data() as Track);
  });
  return items;
}

export async function createTrack(userId: string, track: Omit<Track, 'id' | 'ownerId'>): Promise<Track> {
  const docRef = doc(collection(db, 'tracks'));
  const newTrack: Track = {
    ...track,
    id: docRef.id,
    ownerId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await setDoc(docRef, newTrack);
  return newTrack;
}

export async function updateTrack(track: Track): Promise<void> {
  const docRef = doc(db, 'tracks', track.id);
  await updateDoc(docRef, {
    ...track,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteTrack(trackId: string): Promise<void> {
  await deleteDoc(doc(db, 'tracks', trackId));
}

// ----------------------------------------------------
// CRUD OPERATORS FOR TEMPLATES
// ----------------------------------------------------

export async function fetchTemplates(userId: string): Promise<RitualTemplate[]> {
  const templatesCol = collection(db, 'ritualTemplates');
  const q = query(templatesCol, where('ownerId', '==', userId));
  const snap = await getDocs(q);
  const items: RitualTemplate[] = [];
  snap.forEach(doc => {
    items.push(doc.data() as RitualTemplate);
  });
  return items;
}

export async function createTemplate(userId: string, template: Omit<RitualTemplate, 'id' | 'ownerId'>): Promise<RitualTemplate> {
  const docRef = doc(collection(db, 'ritualTemplates'));
  const newTemplate: RitualTemplate = {
    ...template,
    id: docRef.id,
    ownerId: userId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  await setDoc(docRef, newTemplate);
  return newTemplate;
}

export async function updateTemplate(template: RitualTemplate): Promise<void> {
  const docRef = doc(db, 'ritualTemplates', template.id);
  await updateDoc(docRef, {
    ...template,
    updatedAt: new Date().toISOString()
  });
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await deleteDoc(doc(db, 'ritualTemplates', templateId));
}

// ----------------------------------------------------
// CRUD OPERATORS FOR GENERATED SEQUENCES
// ----------------------------------------------------

export async function fetchSequences(userId: string): Promise<GeneratedSequence[]> {
  const col = collection(db, 'generatedSequences');
  const q = query(col, where('ownerId', '==', userId));
  const snap = await getDocs(q);
  const items: GeneratedSequence[] = [];
  snap.forEach(doc => {
    items.push(doc.data() as GeneratedSequence);
  });
  return items;
}

export async function saveSequence(userId: string, seq: GeneratedSequence): Promise<void> {
  const docRef = doc(db, 'generatedSequences', seq.id);
  await setDoc(docRef, {
    ...seq,
    ownerId: userId,
    createdAt: new Date().toISOString()
  });
}

export async function deleteSequence(seqId: string): Promise<void> {
  await deleteDoc(doc(db, 'generatedSequences', seqId));
}
