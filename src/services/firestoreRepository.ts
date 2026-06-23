// FirestoreRepository — adaptador concreto del puerto `Repository<T>` de ritual-core.
//
// El núcleo (`src/ritual-core/persistence`) define la interfaz pura `Repository<T>` y los
// tipos de metadatos (`Stored<T> = T & EntityMeta`). Acá vive la implementación que habla
// con Firestore, igual que los adaptadores de reproducción: el core no conoce Firebase.
//
// Reglas (mismo patrón que CanindéChords):
//  - Una instancia = una colección de un único dueño (ownerId = user.uid).
//  - Todas las lecturas filtran por ownerId; `get` además verifica propiedad.
//  - Antes de escribir se sanea con `sanitizeForStorage` (Firestore no acepta undefined).
//  - Los timestamps (createdAt/updatedAt) son epoch ms, como define EntityMeta.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  sanitizeForStorage,
  type Clock,
  type Identifiable,
  type Repository,
  type Stored,
} from '../ritual-core';

export class FirestoreRepository<T extends Identifiable> implements Repository<T> {
  constructor(
    private readonly collectionName: string,
    private readonly ownerId: string,
    private readonly clock: Clock = Date.now,
  ) {}

  async list(): Promise<Stored<T>[]> {
    const col = collection(db, this.collectionName);
    const snap = await getDocs(query(col, where('ownerId', '==', this.ownerId)));
    const items = snap.docs.map((d) => d.data() as Stored<T>);
    // Orden estable por antigüedad (evita exigir un índice compuesto en Firestore).
    return items.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }

  async get(id: string): Promise<Stored<T> | null> {
    const snap = await getDoc(doc(db, this.collectionName, id));
    if (!snap.exists()) return null;
    const data = snap.data() as Stored<T>;
    // No filtrar por ownerId acá expondría datos de otros dueños: lo verificamos.
    if (data.ownerId !== this.ownerId) return null;
    return data;
  }

  async save(entity: T): Promise<Stored<T>> {
    const now = this.clock();
    const existing = await this.get(entity.id);
    const stored = sanitizeForStorage({
      ...entity,
      ownerId: this.ownerId,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    } as Stored<T>);
    await setDoc(doc(db, this.collectionName, entity.id), stored);
    return stored;
  }

  async remove(id: string): Promise<void> {
    // Idempotente: borrar algo inexistente no es un error.
    await deleteDoc(doc(db, this.collectionName, id));
  }
}
