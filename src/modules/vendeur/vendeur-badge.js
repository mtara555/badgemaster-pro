/**
 * ============================================================
 *  BADGEMASTER PRO — Vendeur badge renderer ⭐
 *  ============================================================
 *  Rendu HTML unique du badge vendeur.
 *  Utilisé pour :
 *    - L'aperçu live (formulaire vendeur)
 *    - L'impression A4
 *    - L'export PNG (html2canvas)
 *    - L'export PDF (jsPDF)
 *    - Les miniatures dans la liste des vendeurs
 *
 *  Le métier est rendu dynamiquement via getMetierLabel().
 * ============================================================
 */

import { escapeHTML } from '../ui/util.js';
import {
  getMetierLabel,
  getMetierIcon,
  normalizeMetier,
  DEFAULT_METIER
} from './metiers.js';

/* ============================================================
   CONSTANTES
   ============================================================ */

/** Valeurs par défaut des tailles (px) */
const DEFAULT_SIZES = Object.freeze({
  name:   24,
  role:   14,
  marque: 13,
  header: 62,
  logo:   46
});

/** Valeurs par défaut des polices */
const DEFAULT_FONTS = Object.freeze({
  name:   "'BFMarjane-Black_V1', 'BFMarjane Black', sans-serif",
  role:   "Arial, sans-serif",
  marque: "'BFMarjane-Black_V1', sans-serif"
});

/** Couleur bleue du header (constante) */
const VENDEUR_BLUE = '#1a56b0';

/* ============================================================
   FONCTION PRINCIPALE
   ============================================================ */

/**
 * Construit le HTML complet d'un badge vendeur.
 *
 * @param {Object} v - Données du vendeur
 * @param {string} v.firstname
 * @param {string} v.lastname
 * @param {string} v.brandName   - Nom de la marque (obligatoire)
 * @param {string} v.metier      - Valeur métier (vendeur, vendeuse, ...)
 * @param {string} [v.brandLogo] - Data URL du logo marque
 * @param {string} [v.logo]      - Fallback
 * @param {boolean} [v.showQR]   - Afficher le QR code
 * @param {string} [v.logoBg]    - 'transparent' | 'white' | 'blue'
 * @param {boolean} [v.logoWhite]- Forcer logo en blanc
 * @param {Object} [v.sizes]     - Overrides des tailles
 * @param {Object} [v.fonts]     - Overrides des polices
 * @param {string} [v.fontName]
 * @param {string} [v.fontRole]
 * @param {string} [v.fontMarque]
 *
 * @param {Object} [opts]
 * @param {boolean} [opts.withQR=false]      - Inclure l'emplacement du QR
 * @param {string}  [opts.qrId]              - ID du div QR (pour génération)
 * @param {boolean} [opts.previewMode=false] - Mode aperçu (data-attributes)
 * @returns {string} HTML du badge
 */
export function buildVendeurBadgeHTML(v = {}, opts = {}) {
  const {
    withQR = false,
    qrId = null,
    previewMode = false
  } = opts;

  /* ---- Données nettoyées ---- */
  const firstname = String(v.firstname || '').trim();
  const lastname  = String(v.lastname  || '').trim();
  const fullName  = `${firstname} ${lastname}`.trim() || 'Nom et prénom';

  const marque     = String(v.brandName || v.marque || '').trim() || 'MARQUE';
  const metier     = normalizeMetier(v.metier || DEFAULT_METIER);
  const metierLabel = getMetierLabel(metier);
  const metierIcon  = getMetierIcon(metier);

  /* ---- Tailles (avec overrides) ---- */
  const sizes = { ...DEFAULT_SIZES, ...(v.sizes || {}) };

  /* ---- Polices (avec overrides) ---- */
  const fonts = {
    name:   v.fontName   || v.fonts?.name   || DEFAULT_FONTS.name,
    role:   v.fontRole   || v.fonts?.role   || DEFAULT_FONTS.role,
    marque: v.fontMarque || v.fonts?.marque || DEFAULT_FONTS.marque
  };

  /* ---- Logo ---- */
  const logoHtml = buildLogoHTML(v, sizes.logo);

  /* ---- QR code ---- */
  const showQR = v.showQR !== false && withQR;
  const qrDivId = qrId || (previewMode ? 'vp-qr' : `vqr-${v.id || 'preview'}`);
  const qrBox = showQR
    ? `<div class="bv-qr" id="${qrDivId}" data-qr="1"></div>`
    : '';

  /* ---- HTML complet ---- */
  return `<div class="badge-vendeur-exact" data-metier="${metier}"${previewMode ? ' id="vendeur-badge-preview"' : ''}>
  <div class="bv-header has-logo"
       style="height:${sizes.header}px;font-family:${escapeAttr(fonts.name)};background:${VENDEUR_BLUE};display:flex;align-items:center;justify-content:center;">
    ${logoHtml}
  </div>
  <div class="bv-body">
    <div class="bv-name"
         style="font-size:${sizes.name}px;font-family:${escapeAttr(fonts.name)};"
         ${previewMode ? 'id="vp-name"' : ''}>
      ${escapeHTML(fullName)}
    </div>
    <div class="bv-role-line">
      <div class="bv-role"
           style="font-size:${sizes.role}px;font-family:${escapeAttr(fonts.role)};"
           ${previewMode ? 'id="vp-role"' : ''}>
        ${escapeHTML(metierLabel)}
      </div>
    </div>
    <div class="bv-marque-box"
         style="font-size:${sizes.marque}px;font-family:${escapeAttr(fonts.marque)};">
      <strong>MARQUE:</strong>
      <span ${previewMode ? 'id="vp-marque-name"' : ''}>${escapeHTML(marque)}</span>
    </div>
  </div>
  ${qrBox}
</div>`;
}

/* ============================================================
   RENDU DU LOGO
   ============================================================ */

/**
 * Construit le HTML du logo selon le mode d'arrière-plan choisi.
 *
 * @param {Object} v
 * @param {number} maxHeight
 * @returns {string}
 */
function buildLogoHTML(v, maxHeight) {
  const src = v.brandLogo || v.logo || '';
  if (!src) {
    return `<span style="color:white;font-weight:800;letter-spacing:0.5px;">LOGO DU MARQUE</span>`;
  }

  const baseStyle = `max-height:${maxHeight}px;max-width:88%;object-fit:contain;display:block;`;
  const bgMode = v.logoBg || 'white';
  const forceWhite = !!v.logoWhite;

  /* ---- Mode BLANC : carré blanc autour du logo couleur ---- */
  if (bgMode === 'white') {
    return `<div style="background:#ffffff;padding:6px 14px;border-radius:8px;display:inline-flex;box-shadow:0 1px 4px rgba(0,0,0,0.1);">
      <img src="${escapeAttr(src)}" alt="Logo" style="${baseStyle}background:transparent;">
    </div>`;
  }

  /* ---- Mode FORCER BLANC : logo monochrome blanc sur bleu ---- */
  if (forceWhite || bgMode === 'white-forced') {
    return `<img src="${escapeAttr(src)}" alt="Logo"
      style="${baseStyle}filter:brightness(0) invert(1);-webkit-filter:brightness(0) invert(1);background:transparent;">`;
  }

  /* ---- Mode TRANSPARENT : logo couleur d'origine sur bleu ---- */
  return `<img src="${escapeAttr(src)}" alt="Logo"
    style="${baseStyle}filter:none;-webkit-filter:none;background:transparent;">`;
}

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Échappe une valeur pour un attribut HTML (style, id...).
 */
function escapeAttr(value) {
  return String(value ?? '')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ============================================================
   FONCTION DE COMPATIBILITÉ (ancien nommage)
   ============================================================ */
export const buildBadgeHTML = buildVendeurBadgeHTML;

/* ============================================================
   HELPERS DE TEST / DEBUG
   ============================================================ */

/**
 * Extrait le métier affiché depuis un HTML de badge vendeur.
 * Utile pour les tests.
 */
export function extractMetierFromHTML(html) {
  const match = html.match(/data-metier="([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Vérifie si un HTML contient bien le libellé d'un métier donné.
 */
export function htmlContainsMetierLabel(html, metierValue) {
  return html.includes(getMetierLabel(metierValue));
}

/* ============================================================
   RENDERER SAMSUNG — Modèle vertical 54×86 mm
   ============================================================ */

/**
 * Construit le HTML du badge vendeur modèle "Samsung".
 * Format vertical 54×86 mm, header bleu, corps blanc, footer bleu.
 * Couleurs personnalisables via v.colors.
 *
 * @param {Object} v
 * @param {string} v.firstname
 * @param {string} v.lastname
 * @param {string} v.brandName
 * @param {string} v.metier
 * @param {string} [v.brandLogo]
 * @param {Object} [v.colors]
 * @param {string} [v.colors.header]    - Couleur header
 * @param {string} [v.colors.body]      - Couleur corps
 * @param {string} [v.colors.footer]    - Couleur footer
 * @param {string} [v.colors.accent]    - Couleur accent (dorée)
 * @param {string} [v.colors.textName]  - Couleur du nom
 * @param {string} [v.colors.textRole]  - Couleur du métier
 */
export function buildVendeurBadgeSamsungHTML(v = {}) {
  const firstname = String(v.firstname || "").trim();
  const lastname  = String(v.lastname  || "").trim();
  const fullName  = `${firstname} ${lastname}`.trim() || "Nom et Prénom";

  const brandName = String(v.brandName || v.marque || "").trim();
  const metier    = normalizeMetier(v.metier || DEFAULT_METIER);
  const metierLabel = getMetierLabel(metier);

  // ✅ Dimensions badge
  const widthMm  = Math.min(200, Math.max(30, parseFloat(v.samsungW) || 54));
  const heightMm = Math.min(200, Math.max(30, parseFloat(v.samsungH) || 86));
  const MM_TO_PX = 3.7795;
  const widthPx  = Math.round(widthMm * MM_TO_PX);
  const heightPx = Math.round(heightMm * MM_TO_PX);

  // ✅ Tailles de base (lecture du formulaire)
  const sizes = {
    name:   v.sizes?.name   || 24,
    role:   v.sizes?.role   || 14,
    marque: v.sizes?.marque || 13,
    header: v.sizes?.header || 62,
    logo:   v.sizes?.logo   || 46,
    ...(v.sizes || {})
  };

  // ✅ Taille du LOGO MARQUE (le slider "Logo marque")
  // Le logo peut atteindre cette taille MAX (en px)
  const logoSize = sizes.logo;

  // ✅ Adaptation proportionnelle pour Samsung
  // Le badge Samsung a une hauteur de référence de 325px (86mm)
  const scale = heightPx / 325;

  // Tailles de textes
  const nameFontSize = Math.round(sizes.name * scale * 0.65);
  const roleFontSize = Math.round(sizes.role * scale * 0.75);

  // ✅ Taille du logo : applique directement la valeur du slider
  // mais limitée par la hauteur du header (25% du badge)
  const headerHeightPx = Math.round(heightPx * 0.25);
  const logoMaxHeight = Math.min(logoSize, headerHeightPx * 0.85);
  const logoMaxWidth = Math.round(widthPx * 0.75);

  // ✅ Styles inline
  const dimensionStyle = [
    `--samsung-width:${widthPx}px`,
    `--samsung-height:${heightPx}px`,
    `width:${widthPx}px`,
    `height:${heightPx}px`
  ].join(";");

  // Mode logo
  const logoBg = v.logoBg || "transparent";
  const forceWhite = !!v.logoWhite;
  let logoMode = "original";
  if (logoBg === "white" || logoBg === "blue" || forceWhite) {
    logoMode = "white";
  }

  // Fonts
  const fontName = v.fontName || "'BFMarjane-Black_V1', 'BFMarjane Black', sans-serif";
  const fontRole = v.fontRole || "Arial, sans-serif";

  // ✅ LOGO MARQUE : image ou texte
  const logo = v.brandLogo || v.logo || "";
  const headerContent = logo
    ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(brandName)}" style="max-height:${logoMaxHeight}px !important;max-width:${logoMaxWidth}px !important;">`
    : `<div class="sv-header-text" style="font-size:${Math.round(logoSize * scale)}px !important;">${escapeHTML(brandName || "MARQUE")}</div>`;

  return `<div class="badge-vendeur-samsung" data-metier="${metier}" data-logo-mode="${logoMode}" style="${dimensionStyle}">
  <div class="sv-header">
    ${headerContent}
  </div>
  <div class="sv-body">
    <div class="sv-name" style="font-size:${nameFontSize}px !important;font-family:${escapeAttr(fontName)} !important;">${escapeHTML(fullName)}</div>
    <div class="sv-role" style="font-size:${roleFontSize}px !important;font-family:${escapeAttr(fontRole)} !important;">${escapeHTML(metierLabel)}</div>
  </div>
  <div class="sv-footer"></div>
</div>`;
}
