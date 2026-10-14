/**
 * ============================================================
 *  BADGEMASTER PRO — Router / Navigation
 *  ============================================================
 *  Gestion de la navigation entre les pages de l'application.
 *   - Sync sidebar + bottom-nav
 *   - Événement `page:change` pour les modules abonnés
 *   - Historique via hash (optionnel)
 *   - Ouverture/fermeture de la sidebar mobile
 *
 *  Usage :
 *    import { showPage, toggleSidebar, closeSidebar } from '@ui/router.js';
 *    showPage('dashboard');
 * ============================================================
 */

/* ---------- État interne ---------- */
let currentPage = null;

/* ---------- Pages valides (whitelist) ---------- */
const VALID_PAGES = new Set([
  'dashboard',
  'events',
  'create-badge',
  'import-excel',
  'all-badges',
  'visitors',
  'journal',
  'vendeurs',
  'settings'
]);

/* ============================================================
   AFFICHAGE D'UNE PAGE
   ============================================================ */

/**
 * Affiche une page et synchronise la navigation.
 *
 * @param {string} pageId   - ID de la page (sans le préfixe "page-")
 * @param {HTMLElement|null} navItem  - Élément nav-item à activer (optionnel)
 * @param {Object} [opts]
 * @param {boolean} [opts.silent=false] - Ne pas émettre l'événement page:change
 * @param {boolean} [opts.updateHash=true] - Mettre à jour le hash de l'URL
 */
export function showPage(pageId, navItem = null, opts = {}) {
  const { silent = false, updateHash = true } = opts;

  if (!VALID_PAGES.has(pageId)) {
    console.warn(`[router] Page inconnue : "${pageId}"`);
    return;
  }

  const pageEl = document.getElementById(`page-${pageId}`);
  if (!pageEl) {
    console.error(`[router] Élément introuvable : #page-${pageId}`);
    return;
  }

  /* ---- Pages : activer la nouvelle, désactiver les autres ---- */
  document.querySelectorAll('.page').forEach((p) => p.classList.remove('active'));
  pageEl.classList.add('active');

  /* ---- Sidebar : synchroniser l'état actif ---- */
  document.querySelectorAll('.nav-item').forEach((n) => n.classList.remove('active'));

  if (navItem) {
    navItem.classList.add('active');
  } else {
    // Auto-sync : trouve le nav-item correspondant
    const autoNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
    if (autoNav) autoNav.classList.add('active');
  }

  /* ---- Bottom-nav : synchroniser l'état actif ---- */
  document.querySelectorAll('.bottom-nav-item').forEach((i) => {
    i.classList.toggle('active', i.dataset.bnPage === pageId);
  });

  /* ---- Fermeture automatique de la sidebar mobile ---- */
  if (window.innerWidth <= 768) {
    closeSidebar();
  }

  /* ---- Mise à jour du hash URL ---- */
  if (updateHash && window.location.hash !== `#${pageId}`) {
    try {
      history.replaceState(null, '', `#${pageId}`);
    } catch {}
  }

  /* ---- Mise à jour de l'état interne ---- */
  const previousPage = currentPage;
  currentPage = pageId;

  /* ---- Émission de l'événement ---- */
  if (!silent) {
    document.dispatchEvent(new CustomEvent('page:change', {
      detail: { pageId, previousPage }
    }));
  }

  /* ---- Scroll en haut de la nouvelle page ---- */
  const pagesContainer = document.querySelector('.pages');
  if (pagesContainer) pagesContainer.scrollTop = 0;
}

/**
 * Retourne la page courante.
 */
export function getCurrentPage() {
  return currentPage;
}

/* ============================================================
   SIDEBAR MOBILE
   ============================================================ */

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (!sidebar) return;

  const isOpen = sidebar.classList.toggle('open');
  if (overlay) overlay.classList.toggle('show', isOpen);
}

export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

export function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('show');
}

/* ============================================================
   NAVIGATION VIA BOTTOM-NAV
   ============================================================ */

/**
 * Active un onglet de la bottom-nav et affiche la page.
 *
 * @param {string} pageId
 * @param {HTMLElement} item  - Élément .bottom-nav-item cliqué
 */
export function bnNav(pageId, item) {
  document.querySelectorAll('.bottom-nav-item').forEach((i) => i.classList.remove('active'));
  if (item) item.classList.add('active');
  showPage(pageId, null);
}

/* ============================================================
   INITIALISATION DEPUIS LE HASH
   ============================================================ */

/**
 * Lit le hash de l'URL et affiche la page correspondante.
 * À appeler au démarrage de l'app.
 */
export function initFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (hash && VALID_PAGES.has(hash)) {
    showPage(hash);
  } else {
    showPage('dashboard');
  }
}

/**
 * Écoute les changements de hash (boutons précédent/suivant navigateur).
 */
export function listenHashChanges() {
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash && VALID_PAGES.has(hash) && hash !== currentPage) {
      showPage(hash, null, { updateHash: false });
    }
  });
}

/* ============================================================
   DÉLÉGATION D'ÉVÉNEMENTS GLOBALE
   ============================================================
   Gère automatiquement tous les éléments avec :
     - data-page="xxx"           → navigation vers la page
     - data-bn-page="xxx"        → navigation via bottom-nav
     - data-action="sidebar-toggle|sidebar-close"
   ============================================================ */

export function attachGlobalNavigation() {
  document.addEventListener('click', (e) => {
    /* ---- Navigation via data-page ---- */
    const pageTrigger = e.target.closest('[data-page]');
    if (pageTrigger && !pageTrigger.classList.contains('nav-item')) {
      e.preventDefault();
      showPage(pageTrigger.dataset.page);
      return;
    }

    /* ---- Navigation via nav-item (sidebar) ---- */
    const navItem = e.target.closest('.nav-item[data-page]');
    if (navItem) {
      e.preventDefault();
      showPage(navItem.dataset.page, navItem);
      return;
    }

    /* ---- Navigation via bottom-nav ---- */
    const bnItem = e.target.closest('.bottom-nav-item[data-bn-page]');
    if (bnItem) {
      e.preventDefault();
      bnNav(bnItem.dataset.bnPage, bnItem);
      return;
    }

    /* ---- Actions sidebar ---- */
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;

    switch (actionEl.dataset.action) {
      case 'sidebar-toggle':
        e.preventDefault();
        toggleSidebar();
        break;
      case 'sidebar-close':
        e.preventDefault();
        closeSidebar();
        break;
    }
  });
}
