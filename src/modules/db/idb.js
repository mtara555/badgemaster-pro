/**
 * ============================================================
 *  BADGEMASTER PRO — IndexedDB Wrapper
 *  ============================================================
 *  Promisified IndexedDB wrapper.
 *  - Aucun callback imbriqué
 *  - API async/await partout
 *  - Transaction unique par opération
 *  - Support des index et getAllByIndex
 *
 *  Usage:
 *    import { store, openDB } from '@db/idb.js';
 *
 *    await openDB();
 *    const badges = await store.getAll('badges');
 *    await store.add('badges', { name: 'Said' });
 * ============================================================
 */

import { applyMigrations } from './schema.js';

/* ---------- Constantes ---------- */
export const DB_NAME    = 'BadgeMasterPro';
export const DB_VERSION = 4;

/* ---------- Stores canoniques ---------- */
export const STORES = Object.freeze({
  EVENTS:   'events',
  BADGES:   'badges',
  IMPORTS:  'imports',
  VISITORS: 'visitors',
  SETTINGS: 'settings'
});

/* ---------- État interne ---------- */
let dbPromise = null;

/* ============================================================
   OUVERTURE DE LA BASE
   ============================================================ */
export function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('IndexedDB non supporté par ce navigateur.'));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      try {
        applyMigrations(event.target.result, event.oldVersion);
      } catch (err) {
        console.error('Erreur migration:', err);
        reject(err);
      }
    };

    req.onsuccess = (event) => {
      const db = event.target.result;
      db.onerror = (ev) => console.error('DB error:', ev.target.error);
      db.onversionchange = () => {
        db.close();
        console.warn('Base de données modifiée dans un autre onglet — rechargez la page.');
      };
      resolve(db);
    };

    req.onerror = () => reject(req.error);
    req.onblocked = () => {
      console.warn('Base bloquée — fermez les autres onglets BadgeMaster.');
    };
  });

  return dbPromise;
}

/* ============================================================
   TRANSACTION BAS-NIVEAU
   ============================================================ */
async function runTransaction(storeName, mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const objectStore = tx.objectStore(storeName);

    let request;
    try {
      request = operation(objectStore, tx);
    } catch (err) {
      reject(err);
      return;
    }

    tx.oncomplete = () => {
      if (request && 'result' in request) resolve(request.result);
      else resolve(undefined);
    };

    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error || new Error('Transaction annulée'));
  });
}

/* ============================================================
   API PUBLIQUE — STORE
   ============================================================ */
export const store = {
  /** Ajoute un enregistrement (auto-increment sur l'id) */
  add(storeName, value) {
    return runTransaction(storeName, 'readwrite', (s) => s.add(value));
  },

  /** Ajoute plusieurs enregistrements en une seule transaction */
  async addMany(storeName, values) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const s  = tx.objectStore(storeName);
      values.forEach((v) => s.add(v));
      tx.oncomplete = () => resolve(values.length);
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(tx.error);
    });
  },

  /** Ajoute ou remplace un enregistrement (par clé primaire) */
  put(storeName, value) {
    return runTransaction(storeName, 'readwrite', (s) => s.put(value));
  },

  /** Récupère un enregistrement par id */
  get(storeName, id) {
    return runTransaction(storeName, 'readonly', (s) => s.get(id));
  },

  /** Récupère tous les enregistrements */
  getAll(storeName) {
    return runTransaction(storeName, 'readonly', (s) => s.getAll());
  },

  /** Supprime un enregistrement par id */
  delete(storeName, id) {
    return runTransaction(storeName, 'readwrite', (s) => s.delete(id));
  },

  /** Supprime plusieurs enregistrements en une seule transaction */
  async deleteMany(storeName, ids) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const s  = tx.objectStore(storeName);
      ids.forEach((id) => s.delete(id));
      tx.oncomplete = () => resolve(ids.length);
      tx.onerror    = () => reject(tx.error);
      tx.onabort    = () => reject(tx.error);
    });
  },

  /** Vide un store */
  clear(storeName) {
    return runTransaction(storeName, 'readwrite', (s) => s.clear());
  },

  /** Compte les enregistrements */
  count(storeName) {
    return runTransaction(storeName, 'readonly', (s) => s.count());
  },

  /** Récupère tous les enregistrements correspondant à un index */
  async getAllByIndex(storeName, indexName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const idx = tx.objectStore(storeName).index(indexName);
      const req = idx.getAll(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  },

  /** Récupère le premier enregistrement correspondant à un index */
  async getByIndex(storeName, indexName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const idx = tx.objectStore(storeName).index(indexName);
      const req = idx.get(value);
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
};

/* ============================================================
   HELPERS HAUT NIVEAU
   ============================================================ */

/** Vide complètement la base (toutes les tables) */
export async function clearAllStores() {
  const stores = Object.values(STORES);
  await Promise.all(stores.map((s) => store.clear(s)));
}

/** Retourne le compte de tous les stores */
export async function getCounts() {
  const entries = await Promise.all(
    Object.entries(STORES).map(async ([key, name]) => {
      try {
        const n = await store.count(name);
        return [key.toLowerCase(), n];
      } catch {
        return [key.toLowerCase(), 0];
      }
    })
  );
  return Object.fromEntries(entries);
}

/** Ferme la connexion (utile pour les tests) */
export async function closeDB() {
  if (!dbPromise) return;
  const db = await dbPromise;
  db.close();
  dbPromise = null;
}
