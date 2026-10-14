/**
 * ============================================================
 *  BADGEMASTER PRO — IndexedDB Schema & Migrations
 *  ============================================================
 *  Ce fichier est appelé automatiquement par idb.js lors de
 *  l'événement `onupgradeneeded`.
 *
 *  Historique des versions :
 *    v1 → events, badges (index eventId), imports (index eventId)
 *    v2 → visitors
 *    v3 → settings
 *    v4 → badges : index model, index metier (vendeurs)
 *
 *  ⚠️  Ne jamais supprimer un store ou un index existant sans
 *      prévoir une migration de données.
 * ============================================================
 */

/* ---------- Version courante (miroir de idb.js) ---------- */
export const CURRENT_VERSION = 4;

/* ---------- Noms de stores canoniques ---------- */
export const STORE_NAMES = Object.freeze({
  EVENTS:   'events',
  BADGES:   'badges',
  IMPORTS:  'imports',
  VISITORS: 'visitors',
  SETTINGS: 'settings'
});

/* ---------- Noms d'index canoniques ---------- */
export const INDEX_NAMES = Object.freeze({
  BADGE_EVENT_ID: 'eventId',
  BADGE_MODEL:    'model',
  BADGE_METIER:   'metier',
  IMPORT_EVENT_ID:'eventId'
});

/* ============================================================
   FONCTION PRINCIPALE — Applique toutes les migrations
   ============================================================ */
export function applyMigrations(db, oldVersion) {
  const from = oldVersion || 0;

  console.log(`[DB Migration] ${from} → ${CURRENT_VERSION}`);

  /* ---------- v0 → v1 : stores de base ---------- */
  if (from < 1) {
    createEventsStore(db);
    createBadgesStore(db);
    createImportsStore(db);
  }

  /* ---------- v1 → v2 : visitors ---------- */
  if (from < 2) {
    createVisitorsStore(db);
  }

  /* ---------- v2 → v3 : settings ---------- */
  if (from < 3) {
    createSettingsStore(db);
  }

  /* ---------- v3 → v4 : index badges (model, metier) ---------- */
  if (from < 4) {
    addBadgesIndexes(db);
  }

  console.log('[DB Migration] ✅ Terminée');
}

/* ============================================================
   CRÉATION DES STORES — v1
   ============================================================ */

function createEventsStore(db) {
  if (db.objectStoreNames.contains(STORE_NAMES.EVENTS)) return;

  const events = db.createObjectStore(STORE_NAMES.EVENTS, {
    keyPath: 'id',
    autoIncrement: true
  });
  // Pas d'index spécifique pour l'instant
  events.createIndex('createdAt', 'createdAt', { unique: false });
  events.createIndex('name', 'name', { unique: false });
  console.log('  ✅ store "events" créé');
}

function createBadgesStore(db) {
  if (db.objectStoreNames.contains(STORE_NAMES.BADGES)) return;

  const badges = db.createObjectStore(STORE_NAMES.BADGES, {
    keyPath: 'id',
    autoIncrement: true
  });
  badges.createIndex(INDEX_NAMES.BADGE_EVENT_ID, 'eventId', { unique: false });
  badges.createIndex('createdAt', 'createdAt', { unique: false });
  badges.createIndex('name', 'name', { unique: false });
  console.log('  ✅ store "badges" créé (index: eventId, createdAt, name)');
}

function createImportsStore(db) {
  if (db.objectStoreNames.contains(STORE_NAMES.IMPORTS)) return;

  const imports = db.createObjectStore(STORE_NAMES.IMPORTS, {
    keyPath: 'id',
    autoIncrement: true
  });
  imports.createIndex(INDEX_NAMES.IMPORT_EVENT_ID, 'eventId', { unique: false });
  imports.createIndex('createdAt', 'createdAt', { unique: false });
  console.log('  ✅ store "imports" créé (index: eventId, createdAt)');
}

/* ============================================================
   CRÉATION DU STORE VISITORS — v2
   ============================================================ */
function createVisitorsStore(db) {
  if (db.objectStoreNames.contains(STORE_NAMES.VISITORS)) return;

  const visitors = db.createObjectStore(STORE_NAMES.VISITORS, {
    keyPath: 'id',
    autoIncrement: true
  });
  visitors.createIndex('visitDate', 'visitDate', { unique: false });
  visitors.createIndex('createdAt', 'createdAt', { unique: false });
  visitors.createIndex('lastname',  'lastname',  { unique: false });
  visitors.createIndex('company',   'company',   { unique: false });
  console.log('  ✅ store "visitors" créé (index: visitDate, createdAt, lastname, company)');
}

/* ============================================================
   CRÉATION DU STORE SETTINGS — v3
   ============================================================ */
function createSettingsStore(db) {
  if (db.objectStoreNames.contains(STORE_NAMES.SETTINGS)) return;

  db.createObjectStore(STORE_NAMES.SETTINGS, {
    keyPath: 'key' // Clé-valeur : { key: 'app', value: {...} }
  });
  console.log('  ✅ store "settings" créé');
}

/* ============================================================
   AJOUT D'INDEX BADGES — v4
   ============================================================
   ⚠️  Dans onupgradeneeded, on ne peut PAS ouvrir une transaction
       sur un store. On doit utiliser `transaction.objectStore()`
       fourni par le paramètre `db.transaction` implicite.
   ============================================================ */
function addBadgesIndexes(db) {
  if (!db.objectStoreNames.contains(STORE_NAMES.BADGES)) return;

  // On doit récupérer le store dans la transaction de mise à jour
  // (dans onupgradeneeded, le store est accessible directement via
  //  db.transaction sur la version en cours)
  const tx = getUpgradeTransaction(db);
  if (!tx) {
    console.warn('  ⚠️  Impossible de récupérer la transaction de mise à jour');
    return;
  }

  const badgesStore = tx.objectStore(STORE_NAMES.BADGES);

  // Index "model" (with-photo, no-photo, brand-vendor, vendeur-exact)
  if (!badgesStore.indexNames.contains(INDEX_NAMES.BADGE_MODEL)) {
    badgesStore.createIndex(INDEX_NAMES.BADGE_MODEL, 'model', { unique: false });
    console.log('  ✅ index "model" ajouté à badges');
  }

  // Index "metier" (vendeur, vendeuse, animateur, animatrice, merchandiser)
  if (!badgesStore.indexNames.contains(INDEX_NAMES.BADGE_METIER)) {
    badgesStore.createIndex(INDEX_NAMES.BADGE_METIER, 'metier', { unique: false });
    console.log('  ✅ index "metier" ajouté à badges');
  }
}

/* ============================================================
   HELPER — Récupérer la transaction de mise à jour
   ============================================================
   Dans `onupgradeneeded`, la seule façon officielle d'accéder
   à une transaction est d'utiliser la propriété interne via
   l'objet `db`. On utilise une astuce en passant par
   `IDBDatabase.transaction()` avec la version courante.
   ============================================================ */
function getUpgradeTransaction(db) {
  try {
    // Dans onupgradeneeded, on peut ouvrir une transaction en lecture/écriture
    // uniquement sur les stores existants (avec la version en cours d'upgrade).
    return db.transaction(Object.values(STORE_NAMES), 'versionchange');
  } catch (err) {
    // Certains navigateurs (Safari ancien) ne supportent pas
    // l'ouverture explicite. Dans ce cas, on retombe sur une
    // récupération directe depuis le store.
    try {
      // Fallback : on récupère le store via la propriété interne
      // (fonctionne sur Chrome/Firefox/Edge modernes)
      if (db._rawDatabase) {
        return db._rawDatabase.transaction(
          Object.values(STORE_NAMES),
          'versionchange'
        );
      }
    } catch (e) {
      console.warn('getUpgradeTransaction fallback échoué:', e);
    }
    return null;
  }
}

/* ============================================================
   HELPERS DE DIAGNOSTIC
   ============================================================ */

/** Retourne la liste des stores présents */
export function listStores(db) {
  return Array.from(db.objectStoreNames);
}

/** Retourne les index d'un store donné */
export function listIndexes(db, storeName) {
  if (!db.objectStoreNames.contains(storeName)) return [];
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  return Array.from(store.indexNames);
}

/** Vérifie que la structure attendue est bien en place */
export function checkSchema(db) {
  const report = {
    version: db.version,
    expectedVersion: CURRENT_VERSION,
    ok: true,
    stores: {}
  };

  for (const name of Object.values(STORE_NAMES)) {
    const exists = db.objectStoreNames.contains(name);
    report.stores[name] = {
      exists,
      indexes: exists ? listIndexes(db, name) : []
    };
    if (!exists) report.ok = false;
  }

  // Vérifications ciblées sur les index v4
  if (report.stores[STORE_NAMES.BADGES]?.exists) {
    const idx = report.stores[STORE_NAMES.BADGES].indexes;
    if (!idx.includes(INDEX_NAMES.BADGE_MODEL))  report.ok = false;
    if (!idx.includes(INDEX_NAMES.BADGE_METIER)) report.ok = false;
  }

  if (db.version !== CURRENT_VERSION) report.ok = false;

  return report;
}
