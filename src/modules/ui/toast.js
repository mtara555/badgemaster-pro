/**
 * ============================================================
 *  BADGEMASTER PRO — Toast notifications
 *  ============================================================
 *  Notifications éphémères en bas à droite.
 *  Conteneur requis : <div id="toast-container">
 *
 *  Usage :
 *    import { showToast } from '@ui/toast.js';
 *    showToast('Badge créé ✅');
 *    showToast('Nom requis', 'error');
 * ============================================================
 */

/* ---------- Configuration ---------- */
const DEFAULT_DURATION = 3200;
const MAX_VISIBLE      = 5;
const CONTAINER_ID     = 'toast-container';

/* ---------- Compteur pour gestion de file ---------- */
let activeToasts = 0;

/**
 * Récupère (ou crée) le conteneur de toasts.
 */
function getContainer() {
  let container = document.getElementById(CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = CONTAINER_ID;
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Affiche une notification éphémère.
 *
 * @param {string} message   - Texte à afficher
 * @param {'success'|'error'|'info'|'warning'} type - Type visuel
 * @param {number} duration  - Durée en ms (défaut : 3200)
 * @returns {HTMLElement} Le nœud DOM du toast (utile pour tests)
 */
export function showToast(message, type = 'success', duration = DEFAULT_DURATION) {
  const container = getContainer();

  // Limiter le nombre de toasts simultanés
  while (container.children.length >= MAX_VISIBLE) {
    container.removeChild(container.firstChild);
  }

  // Création du toast
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.textContent = String(message ?? '');

  // Animation d'entrée
  toast.style.animation = 'toastIn 0.3s ease';

  container.appendChild(toast);
  activeToasts++;

  // Suppression automatique
  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  // Permettre la fermeture au clic
  toast.style.cursor = 'pointer';
  toast.addEventListener('click', () => {
    clearTimeout(timeoutId);
    dismissToast(toast);
  });

  return toast;
}

/**
 * Retire un toast avec animation de sortie.
 */
function dismissToast(toast) {
  if (!toast || !toast.parentNode) return;

  toast.style.animation = 'toastOut 0.22s ease forwards';

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
    activeToasts = Math.max(0, activeToasts - 1);
  }, 220);
}

/**
 * Supprime tous les toasts affichés.
 */
export function clearToasts() {
  const container = document.getElementById(CONTAINER_ID);
  if (container) container.innerHTML = '';
  activeToasts = 0;
}

/* ---------- Raccourcis sémantiques ---------- */
export const toastSuccess = (msg, duration) => showToast(msg, 'success', duration);
export const toastError   = (msg, duration) => showToast(msg, 'error',   duration);
export const toastInfo    = (msg, duration) => showToast(msg, 'info',    duration);
export const toastWarning = (msg, duration) => showToast(msg, 'warning', duration);
