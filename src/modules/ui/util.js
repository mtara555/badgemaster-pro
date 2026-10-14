/**
 * ============================================================
 *  BADGEMASTER PRO — Utility helpers
 *  ============================================================
 *  Fonctions pures, réutilisables partout dans l'app.
 *  Aucune dépendance DOM sauf mention contraire.
 * ============================================================
 */

/* ============================================================
   STRINGS & HTML
   ============================================================ */

/**
 * Échappe les caractères HTML dangereux (anti-XSS).
 */
export function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

/** Normalise pour comparaison (lowercase + trim). */
export function normalize(str) {
  return String(str ?? '').trim().toLowerCase();
}

/** Tronque avec ellipsis. */
export function truncate(str, max = 40) {
  const s = String(str ?? '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

/** Capitalise la première lettre. */
export function capitalize(str) {
  const s = String(str ?? '');
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ============================================================
   DATES & HEURES
   ============================================================ */

/** Date du jour au format ISO court (YYYY-MM-DD). */
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/** Formate une date ISO en format français (JJ/MM/AAAA). */
export function formatDateFR(isoDate) {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate + 'T00:00:00');
    if (isNaN(d.getTime())) return isoDate;
    return d.toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  } catch {
    return isoDate;
  }
}

/** Date longue française : "lundi 14 octobre 2026". */
export function formatDateLongFR(date = new Date()) {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

/** Heure courante au format HH:MM. */
export function nowHHMM() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Calcule la durée entre deux heures HH:MM → "1h30", "45min" ou null. */
export function calcDuration(entry, exit) {
  if (!entry || !exit) return null;
  const e = entry.split(':').map(Number);
  const x = exit.split(':').map(Number);
  if (e.length < 2 || x.length < 2) return null;

  const minutes = (x[0] * 60 + x[1]) - (e[0] * 60 + e[1]);
  if (minutes <= 0) return null;

  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
}

/** Timestamp ISO → date+heure FR. */
export function formatDateTimeFR(isoString) {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('fr-FR');
  } catch {
    return isoString;
  }
}

/* ============================================================
   IMAGES
   ============================================================ */

/** Compresse une image (data URL) → JPEG data URL. */
export function compressImage(dataUrl, maxW = 400, maxH = 520, quality = 0.75) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve('');

    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const cw = Math.round(img.width * ratio);
      const ch = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d').drawImage(img, 0, 0, cw, ch);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Compresse un logo (conserve transparence PNG). */
export function compressLogo(dataUrl, maxSize = 300) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve('');

    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
      const cw = Math.round(img.width * ratio);
      const ch = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, 0, 0, cw, ch);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Convertit un File en data URL. */
export function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Aucun fichier fourni'));
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e.target.error);
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   MATH & CONVERSIONS
   ============================================================ */

/** Constante mm → px à 96 dpi. */
export const MM_TO_PX = 3.7795275591;

/** Millimètres → pixels (arrondi). */
export function mmToPx(mm) {
  return Math.round(mm * MM_TO_PX);
}

/** Pixels → millimètres. */
export function pxToMm(px) {
  return Math.round((px / MM_TO_PX) * 10) / 10;
}

/** Contraint une valeur numérique dans une plage. */
export function clamp(value, min, max) {
  const v = parseFloat(value);
  if (isNaN(v)) return min;
  return Math.min(max, Math.max(min, v));
}

/** ID unique (timestamp + random). */
export function uniqueId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ============================================================
   FONCTIONS FONCTIONNELLES
   ============================================================ */

/** Debounce — n'exécute qu'après un délai sans nouvel appel. */
export function debounce(fn, delay = 300) {
  let timeoutId;
  return function debounced(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), delay);
  };
}

/** Throttle — exécution max toutes les `delay` ms. */
export function throttle(fn, delay = 200) {
  let last = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn.apply(this, args);
    }
  };
}

/** Clone profond (structuredClone → fallback JSON). */
export function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (typeof structuredClone === 'function') {
    try { return structuredClone(obj); } catch {}
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

/** Initiales : "Said", "BOUSSOUF" → "BS". */
export function getInitials(firstName = '', lastName = '') {
  const f = String(firstName).trim().charAt(0).toUpperCase();
  const l = String(lastName).trim().charAt(0).toUpperCase();
  return (l + f) || '?';
}

/** Slug URL-friendly. */
export function slugify(str) {
  return String(str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ============================================================
   DOM HELPERS
   ============================================================ */

/** Raccourci querySelector. */
export const $  = (selector, root = document) => root.querySelector(selector);

/** Raccourci querySelectorAll → Array. */
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

/** Crée un élément avec attributs + contenu. */
export function el(tag, attrs = {}, content = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    }
    else node.setAttribute(key, value);
  });
  if (content) node.innerHTML = content;
  return node;
}

/** Scroll en douceur vers un élément. */
export function scrollIntoViewSoft(element) {
  if (!element) return;
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ============================================================
   VALIDATION
   ============================================================ */

/** Vrai si vide (null, undefined, '', espaces, [], {}). */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/** Vrai si date valide. */
export function isValidDate(value) {
  if (!value) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
}

/** Vrai si email basique. */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email ?? ''));
}
