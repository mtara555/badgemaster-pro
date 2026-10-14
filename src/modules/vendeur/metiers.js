/**
 * ============================================================
 *  BADGEMASTER PRO — Métiers Vendeurs ⭐
 *  ============================================================
 *  Source unique de vérité pour les métiers affichés sur les
 *  badges vendeurs.
 *
 *  Liste des métiers (choix multiple) :
 *    - Vendeur / Vendeuse
 *    - Animateur / Animatrice
 *    - Merchandiser
 *
 *  Utilisé par :
 *    - Form select (buildMetierOptions)
 *    - Rendu badge (getMetierLabel)
 *    - Filtres page vendeurs
 *    - Export Excel
 *    - Tests
 *
 *  Toute modification de la liste doit passer par ce fichier.
 * ============================================================
 */

/* ============================================================
   LISTE CANONIQUE DES MÉTIERS
   ============================================================ */

export const METIERS = Object.freeze([
  {
    value: 'vendeur',
    label: 'Vendeur',
    icon: '🛒',
    genre: 'M',
    badgeClass: 'metier-vendeur'
  },
  {
    value: 'vendeuse',
    label: 'Vendeuse',
    icon: '🛒',
    genre: 'F',
    badgeClass: 'metier-vendeuse'
  },
  {
    value: 'animateur',
    label: 'Animateur',
    icon: '🎤',
    genre: 'M',
    badgeClass: 'metier-animateur'
  },
  {
    value: 'animatrice',
    label: 'Animatrice',
    icon: '🎤',
    genre: 'F',
    badgeClass: 'metier-animatrice'
  },
  {
    value: 'merchandiser',
    label: 'Merchandiser',
    icon: '📦',
    genre: 'N',
    badgeClass: 'metier-merchandiser'
  }
]);

/* ---------- Métier par défaut ---------- */
export const DEFAULT_METIER = 'vendeur';

/* ============================================================
   FONCTIONS UTILITAIRES
   ============================================================ */

/**
 * Retourne l'objet métier complet pour une valeur donnée.
 * @param {string} value - Ex: "vendeuse"
 * @returns {Object|null}
 */
export function getMetier(value) {
  return METIERS.find((m) => m.value === value) || null;
}

/**
 * Retourne le libellé affiché d'un métier.
 * @param {string} value - Ex: "vendeuse"
 * @returns {string}     - Ex: "Vendeuse"
 */
export function getMetierLabel(value) {
  const m = getMetier(value);
  return m ? m.label : METIERS[0].label;
}

/**
 * Retourne l'icône emoji associée à un métier.
 * @param {string} value
 * @returns {string}
 */
export function getMetierIcon(value) {
  const m = getMetier(value);
  return m ? m.icon : METIERS[0].icon;
}

/**
 * Vérifie si une valeur de métier est valide.
 * @param {string} value
 * @returns {boolean}
 */
export function isValidMetier(value) {
  return METIERS.some((m) => m.value === value);
}

/**
 * Normalise une valeur de métier (fallback sur le défaut si invalide).
 * @param {string} value
 * @returns {string} - valeur valide
 */
export function normalizeMetier(value) {
  return isValidMetier(value) ? value : DEFAULT_METIER;
}

/**
 * Retourne la liste des valeurs uniquement (pour filtres).
 * @returns {string[]}
 */
export function getMetierValues() {
  return METIERS.map((m) => m.value);
}

/**
 * Retourne la liste des libellés uniquement.
 * @returns {string[]}
 */
export function getMetierLabels() {
  return METIERS.map((m) => m.label);
}

/* ============================================================
   GÉNÉRATION HTML — <option> pour <select>
   ============================================================ */

/**
 * Génère les <option> HTML d'un <select> pour les métiers.
 *
 * @param {string} selected - Valeur pré-sélectionnée (défaut: 'vendeur')
 * @param {Object} [opts]
 * @param {boolean} [opts.withIcon=true]  - Afficher l'icône emoji
 * @param {boolean} [opts.withEmpty=false] - Ajouter une option vide en tête
 * @param {string}  [opts.emptyLabel='-- Sélectionner un métier --']
 * @returns {string} - HTML des <option>
 */
export function buildMetierOptions(selected = DEFAULT_METIER, opts = {}) {
  const { withIcon = true, withEmpty = false, emptyLabel = '-- Sélectionner un métier --' } = opts;

  let html = '';

  if (withEmpty) {
    html += `<option value=""${!selected ? ' selected' : ''}>${emptyLabel}</option>`;
  }

  const normalizedSelected = normalizeMetier(selected);

  html += METIERS.map((m) => {
    const isSelected = m.value === normalizedSelected ? ' selected' : '';
    const label = withIcon ? `${m.icon} ${m.label}` : m.label;
    return `<option value="${m.value}"${isSelected}>${label}</option>`;
  }).join('');

  return html;
}

/* ============================================================
   GÉNÉRATION HTML — Badge visuel (chip/pill)
   ============================================================ */

/**
 * Génère un petit badge HTML pour afficher un métier.
 *
 * @param {string} value - Valeur du métier
 * @param {Object} [opts]
 * @param {boolean} [opts.withIcon=true]
 * @returns {string} - HTML du badge
 */
export function buildMetierBadge(value, opts = {}) {
  const { withIcon = true } = opts;
  const m = getMetier(value) || METIERS[0];
  const icon = withIcon ? `${m.icon} ` : '';
  return `<span class="metier-badge ${m.badgeClass}">${icon}${m.label}</span>`;
}

/* ============================================================
   GÉNÉRATION HTML — Liste pour filtres
   ============================================================ */

/**
 * Génère les <option> pour un filtre "Tous les métiers".
 *
 * @param {string} selected - Valeur actuellement sélectionnée
 * @param {string} [allLabel='Tous les métiers']
 * @returns {string}
 */
export function buildMetierFilterOptions(selected = '', allLabel = 'Tous les métiers') {
  let html = `<option value="">${allLabel}</option>`;
  html += METIERS.map((m) => {
    const isSelected = m.value === selected ? ' selected' : '';
    return `<option value="${m.value}"${isSelected}>${m.icon} ${m.label}</option>`;
  }).join('');
  return html;
}

/* ============================================================
   STATISTIQUES
   ============================================================ */

/**
 * Compte le nombre de vendeurs par métier.
 *
 * @param {Array} vendeurs - Liste d'objets avec un champ .metier
 * @returns {Object} - { vendeur: 5, vendeuse: 3, ... }
 */
export function countByMetier(vendeurs = []) {
  const counts = {};
  METIERS.forEach((m) => { counts[m.value] = 0; });

  vendeurs.forEach((v) => {
    const key = normalizeMetier(v.metier);
    counts[key] = (counts[key] || 0) + 1;
  });

  return counts;
}

/**
 * Retourne le métier le plus fréquent.
 *
 * @param {Array} vendeurs
 * @returns {string|null}
 */
export function getMostFrequentMetier(vendeurs = []) {
  const counts = countByMetier(vendeurs);
  let max = 0;
  let mostFrequent = null;

  Object.entries(counts).forEach(([key, count]) => {
    if (count > max) {
      max = count;
      mostFrequent = key;
    }
  });

  return mostFrequent;
}

/* ============================================================
   DÉTECTION DE GENRE (utile pour grammaire française)
   ============================================================ */

/**
 * Vrai si le métier est au féminin.
 */
export function isFeminine(value) {
  const m = getMetier(value);
  return m ? m.genre === 'F' : false;
}

/**
 * Accord d'un adjectif selon le genre du métier.
 * Ex: "Expérimenté" → "Expérimentée" si féminin
 */
export function accordMetier(value, adjectifM, adjectifF) {
  return isFeminine(value) ? adjectifF : adjectifM;
}
