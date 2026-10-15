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

  // ✅ Dimensions en PX (pas %)
  const widthMm  = Math.min(200, Math.max(30, parseFloat(v.samsungW) || 54));
  const heightMm = Math.min(200, Math.max(30, parseFloat(v.samsungH) || 86));
  const MM_TO_PX = 3.7795;
  const W = Math.round(widthMm * MM_TO_PX);   // 204
  const H = Math.round(heightMm * MM_TO_PX);  // 325

  // ✅ Hauteurs en PX FIXES
  const HEADER_H = Math.round(H * 0.25);      // 81px
  const BODY_H   = Math.round(H * 0.60);      // 195px
  const FOOTER_H = H - HEADER_H - BODY_H;     // 49px

  const sizes = { name: 24, role: 14, marque: 13, header: 62, logo: 46, ...(v.sizes || {}) };

  const logoBg = v.logoBg || "transparent";
  const forceWhite = !!v.logoWhite;
  const makeLogoWhite = forceWhite || logoBg === "white" || logoBg === "blue";

  const logo = v.brandLogo || v.logo || "";
  const logoFilter = makeLogoWhite
    ? "filter:brightness(0) invert(1)!important;-webkit-filter:brightness(0) invert(1)!important;"
    : "filter:none!important;-webkit-filter:none!important;";

  // ✅ Logo HTML centré
  let headerContent;
  if (logo) {
    headerContent = `<img class="sv-logo-img" src="${escapeAttr(logo)}" alt="${escapeAttr(brandName)}" style="max-height:${sizes.logo}px!important;max-width:75%!important;width:auto!important;height:auto!important;object-fit:contain!important;display:block!important;${logoFilter}">`;
  } else {
    headerContent = `<div class="sv-header-text" style="color:#fff!important;font-weight:900!important;font-size:${sizes.logo}px!important;letter-spacing:2.5px!important;text-transform:uppercase!important;">${escapeHTML(brandName || "MARQUE")}</div>`;
  }

  // ✅ SVG header en data URL
  const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1054 340" preserveAspectRatio="none"><defs><linearGradient id="n" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#030f26"/><stop offset="0.45" stop-color="#041630"/><stop offset="0.75" stop-color="#082445"/><stop offset="1" stop-color="#00112b"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9b93f"/><stop offset="0.35" stop-color="#dba91f"/><stop offset="0.75" stop-color="#f8e594"/><stop offset="1" stop-color="#dba91f"/></linearGradient></defs><path d="M0 0H1054V150C700 250 350 305 0 325Z" fill="url(#n)"/><path d="M0 325C350 305 700 250 1054 150V183C700 285 350 330 0 332Z" fill="url(#g)"/></svg>`;

  const footerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1054 214" preserveAspectRatio="none"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#030f26"/><stop offset="0.6" stop-color="#041a38"/><stop offset="0.9" stop-color="#00112b"/></linearGradient><linearGradient id="b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#102a55"/><stop offset="0.5" stop-color="#073066"/><stop offset="1" stop-color="#1f4a80"/></linearGradient></defs><rect width="1054" height="214" fill="url(#f)"/><polygon points="1015,0 1054,0 1054,214 745,214" fill="url(#b)"/></svg>`;

  const headerUrl = svgToDataUrl(headerSvg);
  const footerUrl = svgToDataUrl(footerSvg);

  // ✅ Structure avec dimensions px FIXES partout
  return `<div style="width:${W}px!important;height:${H}px!important;position:relative!important;overflow:hidden!important;border-radius:12px!important;background:white!important;display:block!important;box-sizing:border-box!important;page-break-inside:avoid!important;break-inside:avoid!important;">

    <!-- HEADER -->
    <div style="position:absolute!important;top:0!important;left:0!important;width:${W}px!important;height:${HEADER_H}px!important;overflow:hidden!important;">
      <img src="${headerUrl}" style="display:block!important;width:${W}px!important;height:${HEADER_H}px!important;object-fit:fill!important;margin:0!important;padding:0!important;">
      <div style="position:absolute!important;top:0!important;left:0!important;width:${W}px!important;height:${HEADER_H}px!important;display:flex!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:0!important;box-sizing:border-box!important;">
        ${headerContent}
      </div>
    </div>

    <!-- BODY -->
    <div style="position:absolute!important;top:${HEADER_H}px!important;left:0!important;width:${W}px!important;height:${BODY_H}px!important;background:white!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:8px!important;box-sizing:border-box!important;text-align:center!important;">
      <div class="sv-name" style="font-size:${sizes.name}px!important;font-weight:700!important;color:#0a1f3d!important;line-height:1.2!important;margin:0 0 14px 0!important;font-family:'Plus Jakarta Sans',Arial,sans-serif!important;word-break:break-word!important;">${escapeHTML(fullName)}</div>
      <div class="sv-role" style="font-size:${sizes.role}px!important;font-weight:700!important;color:#0a1f3d!important;letter-spacing:1.2px!important;text-transform:uppercase!important;margin:0 0 8px 0!important;text-align:center!important;width:100%!important;">${escapeHTML(metierLabel)}</div>
      <hr class="sv-gold-line" style="display:block!important;width:50px!important;height:0!important;border:0!important;border-top:2px solid #dba91f!important;margin:0 auto!important;padding:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important;">
    </div>

    <!-- FOOTER -->
    <div style="position:absolute!important;bottom:0!important;left:0!important;width:${W}px!important;height:${FOOTER_H}px!important;overflow:hidden!important;">
      <img src="${footerUrl}" style="display:block!important;width:${W}px!important;height:${FOOTER_H}px!important;object-fit:fill!important;margin:0!important;padding:0!important;">
    </div>

  </div>`;
}

/* ============================================================
   HELPERS SVG → DATA URL
   ============================================================ */
function svgHeaderDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1054 340" preserveAspectRatio="none"><defs><linearGradient id="n" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#030f26"/><stop offset="0.45" stop-color="#041630"/><stop offset="0.75" stop-color="#082445"/><stop offset="1" stop-color="#00112b"/></linearGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9b93f"/><stop offset="0.35" stop-color="#dba91f"/><stop offset="0.75" stop-color="#f8e594"/><stop offset="1" stop-color="#dba91f"/></linearGradient></defs><path d="M0 0H1054V150C700 250 350 305 0 325Z" fill="url(#n)"/><path d="M0 325C350 305 700 250 1054 150V183C700 285 350 330 0 332Z" fill="url(#g)"/></svg>`;
  return svgToDataUrl(svg);
}

function svgFooterDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1054 214" preserveAspectRatio="none"><defs><linearGradient id="f" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#030f26"/><stop offset="0.6" stop-color="#041a38"/><stop offset="0.9" stop-color="#00112b"/></linearGradient><linearGradient id="b" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#102a55"/><stop offset="0.5" stop-color="#073066"/><stop offset="1" stop-color="#1f4a80"/></linearGradient></defs><rect width="1054" height="214" fill="url(#f)"/><polygon points="1015,0 1054,0 1054,214 745,214" fill="url(#b)"/></svg>`;
  return svgToDataUrl(svg);
}

function svgToDataUrl(svgString) {
  const cleanSvg = svgString.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim();
  try {
    const utf8Bytes = new TextEncoder().encode(cleanSvg);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return 'data:image/svg+xml;base64,' + btoa(binary);
  } catch (e) {
    return 'data:image/svg+xml,' + encodeURIComponent(cleanSvg);
  }
}
