/**
 * ============================================================
 *  BADGEMASTER PRO v7 — Point d'entrée
 *  ============================================================
 *  Assemble tous les modules :
 *    - Styles (tokens + base + components)
 *    - Base de données (IndexedDB)
 *    - Router de navigation
 *    - Modules métier (vendeur, badge, visitor, export...)
 *    - Délégation globale des data-action
 * ============================================================
 */

/* ============================================================
   IMPORTS CSS
   ============================================================ */
import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components/buttons.css';
import './styles/components/cards.css';
import './styles/components/forms.css';
import './styles/components/modal.css';
import './styles/components/badges.css';

/* ============================================================
   IMPORTS MODULES
   ============================================================ */
import { openDB, store, STORES }             from './modules/db/idb.js';
import { showToast, toastSuccess, toastError } from './modules/ui/toast.js';
import { showConfirm }                       from './modules/ui/confirm.js';
import { modal }                             from './modules/ui/modal.js';
import {
  showPage, bnNav, toggleSidebar, closeSidebar,
  initFromHash, listenHashChanges, attachGlobalNavigation,
  getCurrentPage
} from './modules/ui/router.js';
import { formatDateLongFR, todayISO }        from './modules/ui/util.js';

import * as vendeur from './modules/vendeur/vendeur.js';
import * as events  from './modules/events/events.js';
import * as badge   from './modules/badge/preview.js';
import * as badgeList from './modules/badge/list.js';
import * as importer  from './modules/badge/import.js';
import * as visitor   from './modules/visitor/visitor.js';
import * as journal   from './modules/journal/journal.js';
import * as settings  from './modules/settings/settings.js';
import { getMetierLabel, normalizeMetier }   from './modules/vendeur/metiers.js';

/* ============================================================
   CONSTANTES
   ============================================================ */
const APP_VERSION = '7.0.0';

/* ============================================================
   INITIALISATION
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  console.log(`[BadgeMaster] Démarrage v${APP_VERSION}…`);

  try {
    // 1. Base de données
    await openDB();
    console.log('[BadgeMaster] DB prête ✅');

    // 2. Dates affichées
    initDates();

    // 3. Router (navigation + hash)
    initRouter();

    // 4. Délégation globale des actions
    attachGlobalNavigation();
    attachActionDelegation();

    // 5. Branchement des actions spécifiques vendeur
    attachVendeurBindings();

    // 5b. Init du module badge
    badge.initBadgePreview();

    // 5c. Init du module import
    importer.initImport();

    // 5d. Init du module visiteur
    visitor.initVisitor();

    // 5e. Init du module journal
    journal.initJournal();

    // 5f. Init du module settings
    settings.initSettings();

    // 6. Chargement initial des données
    await refreshAllData();

    // 7. Service Worker (PWA)
    registerServiceWorker();

    console.log('[BadgeMaster] Prêt ✅');
  } catch (err) {
    console.error('[BadgeMaster] Erreur initialisation:', err);
    showToast('Erreur au démarrage — rechargez la page', 'error', 8000);
  }
});

/* ============================================================
   DATES
   ============================================================ */
function initDates() {
  const longDate = formatDateLongFR();
  const shortDate = new Date().toLocaleDateString('fr-FR');

  ['current-date', 'sidebar-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = longDate;
  });

  const topbar = document.getElementById('topbar-date');
  if (topbar) topbar.textContent = shortDate;

  // Journal : filtre par défaut = aujourd'hui
  const today = todayISO();
  const jFrom = document.getElementById('journal-date-from');
  const jTo   = document.getElementById('journal-date-to');
  if (jFrom && !jFrom.value) jFrom.value = today;
  if (jTo && !jTo.value)     jTo.value   = today;
}

/* ============================================================
   ROUTER
   ============================================================ */
function initRouter() {
  listenHashChanges();
  initFromHash();
}

/* ============================================================
   CHARGEMENT DES DONNÉES
   ============================================================ */
async function refreshAllData() {
  try {
    await Promise.allSettled([
      vendeur.loadVendeurs(),
      events.loadEvents(),
      badgeList.loadAllBadges(),
      visitor.loadAllVisitors(),
      visitor.updateVisitorStats(),
      updateDashboardStats()
    ]);
  } catch (err) {
    console.warn('[refreshAllData]', err);
  }
}

/**
 * Met à jour les statistiques du tableau de bord.
 */
async function updateDashboardStats() {
  try {
    const [events, badges, visitors] = await Promise.all([
      store.count(STORES.EVENTS),
      store.count(STORES.BADGES),
      store.count(STORES.VISITORS)
    ]);

    setText('stat-events', events);
    setText('stat-badges', badges);
    setText('stat-visitors', visitors);
    setText('events-count', events);
    setText('badges-count', badges);
    setText('visitors-count', visitors);

    // Badges avec photo
    const allBadges = await store.getAll(STORES.BADGES);
    const withPhoto = allBadges.filter(b => b.photo).length;
    setText('stat-photos', withPhoto);

    // Badges bottom-nav
    const bnBadges = document.getElementById('bn-badges-count');
    if (bnBadges) {
      bnBadges.textContent = badges;
      bnBadges.style.display = badges > 0 ? 'block' : 'none';
    }
  } catch (err) {
    console.warn('[updateDashboardStats]', err);
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ============================================================
   DÉLÉGATION GLOBALE DES ACTIONS
   ============================================================
   Tous les éléments [data-action="xxx"] sont routés vers
   `ACTIONS[xxx]`. Chaque handler reçoit (event, element).
   ============================================================ */

function attachActionDelegation() {
  document.addEventListener('click', (e) => {

    // --- Détection automatique : boutons de sélection modèle ---
    const modelBtn = e.target.closest('#model-group [data-model]');
    if (modelBtn) {
      e.preventDefault();
      badge.selectModel(modelBtn.dataset.model, modelBtn);
      return;
    }

    // --- Détection automatique : boutons de sélection format ---
    const formatBtn = e.target.closest('#format-group [data-format]');
    if (formatBtn) {
      e.preventDefault();
      badge.selectFormat(formatBtn.dataset.format, formatBtn);
      return;
    }

    // --- Détection automatique : boutons import ---
    const importModelBtn = e.target.closest('#import-model-group [data-import-model]');
    if (importModelBtn) {
      e.preventDefault();
      importer.selectImportModel(importModelBtn.dataset.importModel, importModelBtn);
      return;
    }

    const importFormatBtn = e.target.closest('#import-format-group [data-import-format]');
    if (importFormatBtn) {
      e.preventDefault();
      importer.selectImportFormat(importFormatBtn.dataset.importFormat, importFormatBtn);
      return;
    }

    // --- Détection automatique : boutons modèle visiteur ---
    const visitorModelBtn = e.target.closest('#visitor-model-group [data-visitor-model]');
    if (visitorModelBtn) {
      e.preventDefault();
      // ✅ Appel à la vraie fonction qui change currentModel + rebuild l'aperçu
      visitor.selectVisitorModel(visitorModelBtn.dataset.visitorModel, visitorModelBtn);
      return;
    }

    // --- Détection automatique : filtres journal ---
    const journalFilterBtn = e.target.closest('[data-journal-filter]');
    if (journalFilterBtn) {
      e.preventDefault();
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      journalFilterBtn.classList.add('active');
      return;
    }

    // --- Délégation standard via data-action ---
    const trigger = e.target.closest('[data-action]');
    if (!trigger) return;

    const actionName = trigger.dataset.action;
    const handler = ACTIONS[actionName];

    if (typeof handler !== 'function') {
      console.warn(`[actions] Action inconnue : "${actionName}"`);
      return;
    }

    try {
      e.preventDefault();
      handler(e, trigger);
    } catch (err) {
      console.error(`[actions] Erreur dans "${actionName}":`, err);
      showToast('Une erreur est survenue', 'error');
    }
  });

  // Écoute l'événement de rafraîchissement global
  document.addEventListener('data:refresh', () => {
    refreshAllData();
  });
}

/* ============================================================
   REGISTRE DES ACTIONS
   ============================================================ */
const ACTIONS = {

  /* ---------- Navigation ---------- */
  'sidebar-toggle': () => toggleSidebar(),
  'sidebar-close':  () => closeSidebar(),
  'modal-close':    (e, el) => modal.close(el.dataset.target || el.closest('.modal-overlay')?.id),

  /* ---------- Vendeur ⭐ ---------- */
  'vendeur-open':             () => vendeur.openVendeurModal(),
  'vendeur-close':            () => vendeur.closeVendeurModal(),
  'vendeur-save':             () => vendeur.saveVendeur(),
  'vendeur-logo-upload':      () => triggerFileInput('vendeur-logo-file'),
  'vendeur-logo-clear':       () => vendeur.clearVendeurLogo(),
  'vendeur-sizes-reset':      () => vendeur.resetVendeurSizes(),
  'vendeurs-select-all':      () => vendeur.selectAllVendeurs(),
  'vendeurs-delete-selected': () => vendeur.deleteSelectedVendeurs(),
  'vendeurs-print-selected':  () => vendeur.printSelectedVendeurs(),
  'vendeurs-print-a4':        () => vendeur.printAllVendeursA4(),
  'vendeurs-export-excel':    () => vendeur.exportVendeursExcel(),
  'vendeurs-export-pdf':      () => vendeur.exportVendeursPDF(),
  'vendeur-edit':             (e, el) => vendeur.editVendeur(Number(el.dataset.id)),
  'vendeur-delete':           (e, el) => vendeur.deleteVendeur(Number(el.dataset.id)),
  'vendeur-download':         (e, el) => vendeur.downloadVendeurBadge(Number(el.dataset.id)),
  'vendeur-toggle-select':    (e, el) => vendeur.toggleSelect(Number(el.dataset.id)),

  /* ---------- Modules non encore livrés (stubs) ---------- */
  'event-open':              () => events.openEventModal(),
  'event-save':              () => events.saveEvent(),
  'event-update':            () => events.updateEvent(),
  'event-edit':              (e, el) => events.editEvent(Number(el.dataset.id)),
  'event-delete':            (e, el) => events.deleteEvent(Number(el.dataset.id)),
  'event-create-badge':      (e, el) => events.createBadgeForEvent(Number(el.dataset.id)),
  'event-import':            (e, el) => events.importForEvent(Number(el.dataset.id)),
  'badge-reset':             () => badge.resetBadgeForm(),
  'badge-save':              () => badge.saveBadge(),
  'badge-png':               () => badge.downloadBadge(),
  'badge-edit':              (e, el) => badge.editBadge(Number(el.dataset.id)),
  'badge-delete':            (e, el) => badgeList.deleteBadge(Number(el.dataset.id)),
  'badge-toggle-select':     (e, el) => badgeList.toggleSelect(Number(el.dataset.id)),
  'logo-upload':             () => {}, // géré par preview.js (listener direct)
  'brand-logo-upload':       () => {}, // géré par preview.js (listener direct)
  'brand-logo-clear':        () => badge.clearBrandLogo(),
  'camera-open-badge':       () => badge.openCamera('badge'),
  'camera-open-visitor':     () => badge.openCamera('visitor'),
  'camera-close':            () => badge.closeCamera(),
  'camera-snap':             () => badge.takeSnapshot(),
  'camera-switch':           () => badge.switchCamera(),
  'photo-upload-badge':      () => {}, // géré par preview.js (listener direct)
  'photo-upload-visitor':    () => triggerFileInput('visitor-photo-file'),
  'photo-clear':             () => badge.clearPhoto(),
  'visitor-open':            () => visitor.openVisitorModal(),
  'visitor-edit':            (e, el) => visitor.editVisitor(Number(el.dataset.id)),
  'visitor-delete':          (e, el) => visitor.deleteVisitor(Number(el.dataset.id)),
  'visitor-print-one':       (e, el) => visitor.printOneVisitor(Number(el.dataset.id)),
  'visitor-toggle-select':   (e, el) => visitor.toggleSelect(Number(el.dataset.id)),
  'journal-filter':          (e, el) => journal.setJournalFilter(el.dataset.journalFilter, el),
  'visitor-close':           () => visitor.closeVisitorModal(),
  'visitor-save':            () => visitor.saveVisitor(),
  'visitor-png':             () => visitor.downloadVisitorBadge(),
  'visitor-photo-clear':     () => visitor.clearVisitorPhoto(),
  'visitor-logo-upload':     () => triggerFileInput('visitor-logo-input'),
  'visitors-select-all':     () => visitor.selectAllVisitors(),
  'visitors-delete-selected':() => visitor.deleteSelectedVisitors(),
  'visitors-print':          () => visitor.printSelectedVisitors(),
  'visitors-export-pdf':     () => visitor.exportVisitorPDF(),
  'import-logo-upload':      () => triggerFileInput('import-logo-input'),
  'import-brand-logo-upload':() => triggerFileInput('import-brand-logo-input'),
  'import-confirm':          () => importer.confirmImport(),
  'print-open':              () => badgeList.openPrintModal('print'),
  'print-window':            () => window.print(),
  'print-pdf':               () => badgeList.openPrintModal('pdf'),
  'badges-select-all':       () => badgeList.selectAllBadges(),
  'badges-delete-selected':  () => badgeList.deleteSelectedBadges(),
  'journal-csv':             () => journal.exportJournalCSV(),
  'journal-pdf':             () => journal.exportJournalPDF(),
  'data-export':             () => settings.exportAllData(),
  'data-import':             () => triggerFileInput('data-import-input'),
  'data-clear':              () => settings.clearAllData(),
  'settings-save':           () => settings.saveSettings(),
  'settings-logo-upload':    () => triggerFileInput('settings-logo-input'),
  'settings-logo-clear':     () => settings.clearSettingsLogo()
};

/* ============================================================
   HELPERS ACTIONS
   ============================================================ */

/**
 * Déclenche le clic sur un input file caché.
 */
function triggerFileInput(inputId) {
  const input = document.getElementById(inputId);
  if (input) input.click();
  else console.warn(`[actions] Input file introuvable : #${inputId}`);
}

/**
 * Affiche un toast temporaire pour les modules non livrés.
 */
function stub(featureName) {
  toastSoon(`⏳ ${featureName} — module en cours de chargement`);
}

function toastSoon(message) {
  showToast(message, 'info', 2400);
}

/* ============================================================
   BINDINGS SPÉCIFIQUES VENDEUR
   ============================================================
   Écouteurs sur les inputs du formulaire vendeur pour
   déclencher l'aperçu live + appliquer tailles/polices.
   ============================================================ */

function attachVendeurBindings() {
  // Champs texte → mise à jour aperçu
  ['vendeur-firstname', 'vendeur-lastname', 'vendeur-marque']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => vendeur.updateVendeurPreview());
    });

  // Métier → mise à jour aperçu
  const metierSel = document.getElementById('vendeur-metier');
  if (metierSel) {
    metierSel.addEventListener('change', () => vendeur.updateVendeurPreview());
  }

  // Cases à cocher → mise à jour aperçu
  ['vendeur-show-qr', 'vendeur-logo-white', 'vendeur-logo-bg']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => vendeur.updateVendeurPreview());
    });

  // Sliders de tailles
  ['vsl-name', 'vsl-role', 'vsl-marque', 'vsl-header', 'vsl-logo']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => vendeur.applyVendeurSizes());
    });

  // Polices
  ['vendeur-font-name', 'vendeur-font-role', 'vendeur-font-marque']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => vendeur.applyVendeurFonts());
    });

  // Import data (JSON)
  const dataImportInput = document.getElementById('data-import-input');
  if (dataImportInput) {
    dataImportInput.addEventListener('change', (e) => {
      settings.importAllData(e);
    });
  }

  // Upload logo vendeur
  const logoInput = document.getElementById('vendeur-logo-file');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => vendeur.handleVendeurLogoUpload(e));
  }

  // Filtres de la page vendeurs
  ['search-vendeurs', 'filter-vendeur-metier', 'filter-vendeur-marque']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', () => vendeur.loadVendeurs());
    });

  // Recharger les vendeurs à chaque changement de page
  document.addEventListener('page:change', (e) => {
    if (e.detail.pageId === 'vendeurs') {
      vendeur.loadVendeurs();
    }
    if (e.detail.pageId === 'events') {
      events.loadEvents();
    }
    if (e.detail.pageId === 'create-badge') {
      badge.updateBadgePreview();
    }
    if (e.detail.pageId === 'all-badges') {
      badgeList.loadAllBadges();
    }
    if (e.detail.pageId === 'import-excel') {
      importer.loadImportsHistory();
    }
    if (e.detail.pageId === 'visitors') {
      visitor.loadAllVisitors();
      visitor.updateVisitorStats();
    }
    if (e.detail.pageId === 'journal') {
      journal.loadJournal();
    }
    if (e.detail.pageId === 'settings') {
      settings.loadSettings();
    }
    if (e.detail.pageId === 'dashboard') {
      updateDashboardStats();
    }
  });
}

/* ============================================================
   SERVICE WORKER
   ============================================================ */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('[SW] Enregistré :', reg.scope))
      .catch((err) => console.warn('[SW] Échec :', err));
  });
}

/* ============================================================
   API PUBLIQUE (debug / console)
   ============================================================ */
window.BadgeMaster = {
  version: APP_VERSION,
  vendeur,
  badgeList,
  visitor,
  journal,
  settings,
  ui: {
    showToast,
    showConfirm,
    modal,
    showPage,
    bnNav,
    toggleSidebar,
    closeSidebar,
    getCurrentPage
  },
  db: {
    openDB,
    store,
    STORES
  },
  getMetierLabel,
  normalizeMetier,
  refreshAll: refreshAllData
};

/* ============================================================
   GESTION D'ERREURS GLOBALE
   ============================================================ */
window.addEventListener('error', (e) => {
  console.error('[BadgeMaster] Erreur globale:', e.error || e.message);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('[BadgeMaster] Promesse rejetée:', e.reason);
});

console.log(`[BadgeMaster] Module main.js chargé — v${APP_VERSION}`);
