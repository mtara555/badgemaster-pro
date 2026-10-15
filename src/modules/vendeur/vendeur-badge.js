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

  // Dimensions
  const widthMm  = Math.min(200, Math.max(30, parseFloat(v.samsungW) || 54));
  const heightMm = Math.min(200, Math.max(30, parseFloat(v.samsungH) || 86));
  const MM_TO_PX = 3.7795;
  const widthPx  = Math.round(widthMm * MM_TO_PX);
  const heightPx = Math.round(heightMm * MM_TO_PX);

  const sizes = { name: 24, role: 14, marque: 13, header: 62, logo: 46, ...(v.sizes || {}) };
  const scale = heightPx / 325;
  const nameFontSize = Math.round(sizes.name * scale * 0.65);
  const roleFontSize = Math.round(sizes.role * scale * 0.75);

  const headerHeightPx = Math.round(heightPx * 0.25);
  const logoMaxHeight = Math.min(sizes.logo, headerHeightPx * 0.85);
  const logoMaxWidth = Math.round(widthPx * 0.75);

  // ✅ LOGIQUE DU MODE LOGO :
  //    - "white"  : blanc avec carré blanc autour (logo en couleur sur fond blanc)
  //    - "blue"   : forcé blanc direct sur la bande bleue
  //    - "transparent" : couleur d'origine
  //    - forceWhite : force blanc dans tous les cas
  const logoBg = v.logoBg || "transparent";
  const forceWhite = !!v.logoWhite;

  let logoMode = "original";
  if (forceWhite) {
    logoMode = "white-forced";     // filtre CSS : invert(1)
  } else if (logoBg === "blue") {
    logoMode = "white-forced";     // filtre CSS : invert(1) sur bleu
  } else if (logoBg === "white") {
    logoMode = "white-square";     // carré blanc + logo en couleur
  } else {
    logoMode = "original";          // couleur d'origine, pas de carré
  }

  // Fonts
  const fontName = v.fontName || "'BFMarjane-Black_V1', 'BFMarjane Black', sans-serif";
  const fontRole = v.fontRole || "Arial, sans-serif";

  // Logo HTML selon le mode
  const logo = v.brandLogo || v.logo || "";
  let headerContent = "";

  if (logo) {
    const imgStyle = `max-height:${logoMaxHeight}px;max-width:${logoMaxWidth}px;object-fit:contain;display:block;position:relative;z-index:3;`;

    if (logoMode === "white-square") {
      // Carré blanc autour du logo (logo en couleur préservée)
      headerContent = `<div style="background:#ffffff;padding:6px 12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.15);position:relative;z-index:3;display:inline-flex;align-items:center;justify-content:center;">
        <img src="${escapeAttr(logo)}" alt="${escapeAttr(brandName)}" style="${imgStyle}">
      </div>`;
    } else if (logoMode === "white-forced") {
      // Logo forcé en blanc (filtre CSS)
      headerContent = `<img src="${escapeAttr(logo)}" alt="${escapeAttr(brandName)}" style="${imgStyle}filter:brightness(0) invert(1) !important;-webkit-filter:brightness(0) invert(1) !important;">`;
    } else {
      // Couleur d'origine (transparent ou pas de bg)
      headerContent = `<img src="${escapeAttr(logo)}" alt="${escapeAttr(brandName)}" style="${imgStyle}">`;
    }
  } else {
    // Pas de logo → texte
    headerContent = `<div style="color:#ffffff;font-weight:900;font-size:${Math.round(sizes.logo * scale)}px;letter-spacing:2.5px;text-transform:uppercase;position:relative;z-index:3;text-shadow:0 1px 3px rgba(0,0,0,0.3);">${escapeHTML(brandName || "MARQUE")}</div>`;
  }

  // SVG header en data URL base64
  const headerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1054 340" preserveAspectRatio="none">
    <defs>
      <linearGradient id="n" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#030f26"/>
        <stop offset="0.45" stop-color="#041630"/>
        <stop offset="0.75" stop-color="#082445"/>
        <stop offset="1" stop-color="#00112b"/>
      </linearGradient>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#e9b93f"/>
        <stop offset="0.35" stop-color="#dba91f"/>
        <stop offset="0.75" stop-color="#f8e594"/>
        <stop offset="1" stop-color="#dba91f"/>
      </linearGradient>
    </defs>
    <path d="M0 0H1054V150C700 250 350 305 0 325Z" fill="url(#n)"/>
    <path d="M0 325C350 305 700 250 1054 150V183C700 285 350 330 0 332Z" fill="url(#g)"/>
  </svg>`;

  const footerSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1054 214" preserveAspectRatio="none">
    <defs>
      <linearGradient id="f" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#030f26"/>
        <stop offset="0.6" stop-color="#041a38"/>
        <stop offset="0.9" stop-color="#00112b"/>
      </linearGradient>
      <linearGradient id="b" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stop-color="#102a55"/>
        <stop offset="0.5" stop-color="#073066"/>
        <stop offset="1" stop-color="#1f4a80"/>
      </linearGradient>
    </defs>
    <rect width="1054" height="214" fill="url(#f)"/>
    <polygon points="1015,0 1054,0 1054,214 745,214" fill="url(#b)"/>
  </svg>`;

  const headerBg = svgToDataUrl(headerSvg);
  const footerBg = svgToDataUrl(footerSvg);

  const dimensionStyle = [
    `--samsung-width:${widthPx}px`,
    `--samsung-height:${heightPx}px`,
    `width:${widthPx}px`,
    `height:${heightPx}px`
  ].join(";");

  return `<div class="badge-vendeur-samsung" data-metier="${metier}" data-logo-mode="${logoMode}" style="${dimensionStyle};position:relative;overflow:hidden;border-radius:14px;background:#ffffff;display:flex;flex-direction:column;font-family:'Plus Jakarta Sans',Arial,sans-serif;">

    <div style="position:relative;height:25%;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:8px 12px 18px 12px;box-sizing:border-box;">
      <img src="${headerBg}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;display:block;" alt="">
      ${headerContent}
    </div>

    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:12px;text-align:center;background:#ffffff;">
      <div class="sv-name" style="font-size:${nameFontSize}px;font-family:${escapeAttr(fontName)};color:#0a1f3d;font-weight:700;line-height:1.3;margin:0 0 16px 0;">${escapeHTML(fullName)}</div>
      <div class="sv-role" style="font-size:${roleFontSize}px;font-family:${escapeAttr(fontRole)};color:#0a1f3d;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;margin:0;position:relative;padding-bottom:10px;">
        ${escapeHTML(metierLabel)}
        <span style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:55px;height:1.5px;background:linear-gradient(90deg,#dba91f,#f8e594,#dba91f);display:block;"></span>
      </div>
    </div>

    <div style="position:relative;height:15%;flex-shrink:0;overflow:hidden;">
      <img src="${footerBg}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:fill;display:block;" alt="">
    </div>

  </div>`;
}

/* ============================================================
   Utilitaire : SVG string → data URL base64
   ============================================================
   Convertit un SVG en data URL base64 pour html2canvas.
   Les SVG inline ne sont pas capturés par html2canvas,
   mais les <img src="data:..."> le sont parfaitement.
   ============================================================ */
function svgToDataUrl(svgString) {
  // Nettoyage : retire les retours à la ligne et espaces multiples
  const cleanSvg = svgString
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();

  // Encodage UTF-8 → base64
  try {
    // Pour navigateur moderne
    const utf8Bytes = new TextEncoder().encode(cleanSvg);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    return 'data:image/svg+xml;base64,' + btoa(binary);
  } catch (e) {
    // Fallback : encodage URI
    return 'data:image/svg+xml,' + encodeURIComponent(cleanSvg);
  }
}
