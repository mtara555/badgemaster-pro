/**
 * ============================================================
 *  BADGEMASTER PRO — Confirm dialog
 *  ============================================================
 *  Remplace le `confirm()` natif du navigateur par une modale
 *  élégante, promise-based.
 *
 *  Éléments HTML requis (dans index.html) :
 *    <div class="confirm-overlay" id="confirm-modal">
 *      <div class="confirm-box">
 *        <div class="confirm-icon" id="confirm-icon">⚠️</div>
 *        <div class="confirm-title" id="confirm-title">Confirmation</div>
 *        <div class="confirm-message" id="confirm-message">...</div>
 *        <div class="confirm-actions">
 *          <button id="confirm-cancel">Annuler</button>
 *          <button id="confirm-ok">Confirmer</button>
 *        </div>
 *      </div>
 *    </div>
 *
 *  Usage :
 *    import { showConfirm } from '@ui/confirm.js';
 *
 *    const ok = await showConfirm({
 *      title: 'Supprimer ce badge ?',
 *      message: 'Cette action est irréversible.',
 *      okText: 'Supprimer',
 *      type: 'danger'
 *    });
 *    if (ok) { ... }
 * ============================================================
 */

/* ---------- IDs des éléments DOM ---------- */
const ID = {
  MODAL:   'confirm-modal',
  ICON:    'confirm-icon',
  TITLE:   'confirm-title',
  MESSAGE: 'confirm-message',
  OK:      'confirm-ok',
  CANCEL:  'confirm-cancel'
};

/* ---------- Types par défaut ---------- */
const TYPE_DEFAULTS = {
  danger:  { icon: '🗑️', btnClass: 'btn-danger'  },
  warning: { icon: '⚠️', btnClass: 'btn-warning' },
  info:    { icon: 'ℹ️', btnClass: 'btn-primary' },
  success: { icon: '✅', btnClass: 'btn-success' }
};

/* ---------- État interne ---------- */
let activeResolve = null;
let activeKeyHandler = null;

/**
 * Affiche un dialogue de confirmation professionnel.
 *
 * @param {Object}  opts
 * @param {string}  [opts.title='Confirmation']
 * @param {string}  [opts.message='Êtes-vous sûr de vouloir continuer ?']
 * @param {string}  [opts.okText='Confirmer']
 * @param {string}  [opts.cancelText='Annuler']
 * @param {'danger'|'warning'|'info'|'success'} [opts.type='danger']
 * @param {string}  [opts.icon]  - Emoji personnalisé (sinon dépend du type)
 * @returns {Promise<boolean>}   - true si l'utilisateur confirme, false sinon
 */
export function showConfirm(opts = {}) {
  return new Promise((resolve) => {
    // Si une confirmation est déjà active, on la rejette
    if (activeResolve) {
      try { activeResolve(false); } catch {}
    }

    const {
      title      = 'Confirmation',
      message    = 'Êtes-vous sûr de vouloir continuer ?',
      okText     = 'Confirmer',
      cancelText = 'Annuler',
      type       = 'danger',
      icon       = null
    } = opts;

    const modal   = document.getElementById(ID.MODAL);
    const iconEl  = document.getElementById(ID.ICON);
    const titleEl = document.getElementById(ID.TITLE);
    const msgEl   = document.getElementById(ID.MESSAGE);
    const okBtn   = document.getElementById(ID.OK);
    const canBtn  = document.getElementById(ID.CANCEL);

    // Sécurité : si la modale n'existe pas, on retombe sur le natif
    if (!modal || !iconEl || !titleEl || !msgEl || !okBtn || !canBtn) {
      console.warn('[confirm] Éléments DOM manquants — fallback vers confirm() natif');
      resolve(window.confirm(message));
      return;
    }

    const config = TYPE_DEFAULTS[type] || TYPE_DEFAULTS.danger;

    // Configuration des textes et styles
    iconEl.className   = `confirm-icon ${type}`;
    iconEl.textContent = icon || config.icon;
    titleEl.textContent = title;
    msgEl.textContent   = message;
    okBtn.textContent   = okText;
    canBtn.textContent  = cancelText;

    okBtn.className = `btn ${config.btnClass}`;

    // Affichage
    modal.classList.add('show');

    /**
     * Nettoyage complet : retire les listeners, masque, résout.
     */
    const cleanup = (result) => {
      modal.classList.remove('show');
      okBtn.onclick    = null;
      canBtn.onclick   = null;
      modal.onclick    = null;
      if (activeKeyHandler) {
        document.removeEventListener('keydown', activeKeyHandler);
        activeKeyHandler = null;
      }
      if (activeResolve === resolve) activeResolve = null;
      resolve(result);
    };

    // Listeners
    okBtn.onclick  = () => cleanup(true);
    canBtn.onclick = () => cleanup(false);

    // Clic sur l'overlay = annulation
    modal.onclick = (e) => {
      if (e.target === modal) cleanup(false);
    };

    // Clavier : ESC → annuler, ENTER → confirmer
    activeKeyHandler = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
      if (e.key === 'Enter')  { e.preventDefault(); cleanup(true);  }
    };
    document.addEventListener('keydown', activeKeyHandler);

    // Focus sur le bouton OK pour accessibilité
    setTimeout(() => {
      try { okBtn.focus(); } catch {}
    }, 50);

    // Mémorise la résolution en cours pour éviter les doublons
    activeResolve = resolve;
  });
}

/* ---------- Raccourcis sémantiques ---------- */

export const confirmDelete = (title, message) =>
  showConfirm({ title, message, okText: 'Supprimer', type: 'danger',  icon: '🗑️' });

export const confirmWarning = (title, message) =>
  showConfirm({ title, message, okText: 'Continuer', type: 'warning', icon: '⚠️' });

export const confirmInfo = (title, message) =>
  showConfirm({ title, message, okText: 'OK',       type: 'info',    icon: 'ℹ️' });

/**
 * Ferme toute confirmation active (utile pour les tests ou l'arrêt d'urgence).
 */
export function abortConfirm() {
  if (activeResolve) {
    try { activeResolve(false); } catch {}
    activeResolve = null;
  }
  const modal = document.getElementById(ID.MODAL);
  if (modal) modal.classList.remove('show');
}
