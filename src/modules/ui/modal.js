/**
 * ============================================================
 *  BADGEMASTER PRO — Modal manager
 *  ============================================================
 *  Gestion centralisée des modales :
 *   - ouverture / fermeture par ID
 *   - fermeture au clic sur l'overlay
 *   - fermeture à la touche Échap
 *   - verrouillage du scroll de la page sous-jacente
 *   - stack (plusieurs modales empilées)
 *
 *  Usage :
 *    import { modal } from '@ui/modal.js';
 *
 *    modal.open('event-modal');
 *    modal.close('event-modal');
 *    modal.closeAll();
 * ============================================================
 */

/* ---------- État interne ---------- */
const openedModals = new Set();
let bodyScrollLocked = false;
let originalBodyOverflow = '';
let escHandlerAttached = false;

/* ============================================================
   API PUBLIQUE
   ============================================================ */
export const modal = {

  /**
   * Ouvre une modale par son ID (ex: 'event-modal').
   * @param {string} id
   * @returns {HTMLElement|null}
   */
  open(id) {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[modal] Élément introuvable : #${id}`);
      return null;
    }

    // Retire le display:none et ajoute la classe .show
    el.classList.add('show');
    el.style.display = ''; // au cas où un style inline l'aurait caché
    openedModals.add(id);

    // Attache les comportements de fermeture si pas déjà fait
    attachCloseBehaviors(el);

    // Verrouille le scroll de la page
    lockBodyScroll();

    // Attache le listener global Échap
    ensureEscHandler();

    // Focus sur le premier input trouvé (accessibilité)
    setTimeout(() => {
      const firstInput = el.querySelector('input:not([type=hidden]), select, textarea, button.btn-primary');
      if (firstInput) {
        try { firstInput.focus(); } catch {}
      }
    }, 60);

    return el;
  },

  /**
   * Ferme une modale par son ID.
   * @param {string} id
   */
  close(id) {
    const el = document.getElementById(id);
    if (!el) return;

    el.classList.remove('show');
    openedModals.delete(id);

    // Si plus aucune modale ouverte, déverrouille le scroll
    if (openedModals.size === 0) {
      unlockBodyScroll();
      detachEscHandler();
    }
  },

  /**
   * Bascule l'état d'une modale (open ↔ close).
   */
  toggle(id) {
    const el = document.getElementById(id);
    if (!el) return;

    if (el.classList.contains('show')) {
      this.close(id);
    } else {
      this.open(id);
    }
  },

  /**
   * Vérifie si une modale est actuellement ouverte.
   */
  isOpen(id) {
    return openedModals.has(id);
  },

  /**
   * Retourne la liste des modales actuellement ouvertes.
   */
  listOpen() {
    return Array.from(openedModals);
  },

  /**
   * Ferme toutes les modales ouvertes.
   */
  closeAll() {
    Array.from(openedModals).forEach((id) => this.close(id));
    openedModals.clear();
    unlockBodyScroll();
    detachEscHandler();
  }
};

/* ============================================================
   COMPORTEMENTS DE FERMETURE AUTOMATIQUE
   ============================================================ */

/**
 * Ajoute des listeners pour fermer la modale :
 *   - clic sur l'overlay (outside modal-box)
 *   - clic sur les éléments [data-action="modal-close"] avec data-target
 *   - clic sur les éléments [data-action="<id>-close"] (fallback)
 *
 * @param {HTMLElement} modalEl
 */
function attachCloseBehaviors(modalEl) {
  // Évite les doublons de listeners
  if (modalEl.dataset.closeBehaviorsAttached === 'true') return;
  modalEl.dataset.closeBehaviorsAttached = 'true';

  // ---- Clic sur l'overlay (hors du contenu .modal-box) ----
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) {
      modal.close(modalEl.id);
    }
  });

  // ---- Délégation d'événements pour les boutons de fermeture ----
  modalEl.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-action="modal-close"], .modal-close');
    if (!trigger) return;

    e.preventDefault();

    // Priorité : data-target, sinon la modale parente
    const targetId = trigger.dataset.target || modalEl.id;
    modal.close(targetId);
  });
}

/* ============================================================
   VERROUILLAGE DU SCROLL BODY
   ============================================================ */

function lockBodyScroll() {
  if (bodyScrollLocked) return;
  originalBodyOverflow = document.body.style.overflow || '';
  document.body.style.overflow = 'hidden';
  bodyScrollLocked = true;
}

function unlockBodyScroll() {
  if (!bodyScrollLocked) return;
  document.body.style.overflow = originalBodyOverflow;
  bodyScrollLocked = false;
}

/* ============================================================
   TOUCHE ÉCHAP → FERME LA DERNIÈRE MODALE
   ============================================================ */

function ensureEscHandler() {
  if (escHandlerAttached) return;
  document.addEventListener('keydown', globalEscHandler);
  escHandlerAttached = true;
}

function detachEscHandler() {
  if (!escHandlerAttached) return;
  document.removeEventListener('keydown', globalEscHandler);
  escHandlerAttached = false;
}

function globalEscHandler(e) {
  if (e.key !== 'Escape') return;
  if (openedModals.size === 0) return;

  // Ferme la dernière modale ouverte (LIFO)
  const lastId = Array.from(openedModals).pop();
  if (lastId) modal.close(lastId);
}

/* ============================================================
   FERMETURE AUTOMATIQUE AU CHANGEMENT DE PAGE
   ============================================================ */
document.addEventListener('page:change', () => {
  // Sécurité : ferme toutes les modales quand on change de page
  // (désactivable en commentant cette ligne si besoin)
  if (openedModals.size > 0) modal.closeAll();
});

/* ============================================================
   RACCOURCIS : modal.open / close exposés pour usage direct
   ============================================================ */
export const openModal  = (id) => modal.open(id);
export const closeModal = (id) => modal.close(id);
