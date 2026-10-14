/**
 * ============================================================
 *  BADGEMASTER PRO — Vendeur module ⭐
 *  ============================================================
 *  Module complet pour la gestion des badges vendeurs :
 *    - Formulaire modal (créer / modifier)
 *    - Liste filtrable + statistiques
 *    - Upload logo marque
 *    - Tailles et polices ajustables
 *    - Aperçu live via vendeur-badge.js
 *    - Impression A4 + export PDF/Excel/PNG
 * ============================================================
 */

import { store }                from '../db/idb.js';
import { showToast }            from '../ui/toast.js';
import { showConfirm }          from '../ui/confirm.js';
import { modal }                from '../ui/modal.js';
import {
  escapeHTML,
  compressLogo,
  fileToDataURL,
  clamp,
  nowHHMM
} from '../ui/util.js';

import {
  METIERS,
  DEFAULT_METIER,
  buildMetierOptions,
  buildMetierFilterOptions,
  normalizeMetier,
  getMetierLabel,
  countByMetier
} from './metiers.js';

import {
  buildVendeurBadgeHTML
} from './vendeur-badge.js';

/* ============================================================
   ÉTAT INTERNE DU MODULE
   ============================================================ */

/** Modèle de badge vendeur */
const VENDEUR_MODEL = 'vendeur-exact';

/** IDs des modales gérées */
const MODAL_ID       = 'vendeur-modal';
const PRINT_MODAL_ID = 'vendeur-print-modal';

/** Vendeurs actuellement sélectionnés (Set d'IDs) */
const selectedVendeurs = new Set();

/** Logo courant (en cours d'édition) */
let currentLogoSrc = '';

/** ID du vendeur en cours d'édition (null si création) */
let editingId = null;

/** Constantes des limites de tailles */
const SIZE_DEFAULTS = Object.freeze({
  name: 24,
  role: 14,
  marque: 13,
  header: 62,
  logo: 46
});

/* ============================================================
   OUVERTURE / FERMETURE DU FORMULAIRE
   ============================================================ */

/**
 * Ouvre la modale vendeur (création ou édition).
 * @param {number} [id] - ID du vendeur à éditer (optionnel)
 */
export function openVendeurModal(id = null) {
  if (id) return editVendeur(id);

  resetVendeurForm();
  modal.open(MODAL_ID);
  updateVendeurPreview();
}

/**
 * Ferme la modale vendeur.
 */
export function closeVendeurModal() {
  modal.close(MODAL_ID);
}

/**
 * Réinitialise complètement le formulaire vendeur.
 */
function resetVendeurForm() {
  editingId = null;
  currentLogoSrc = '';

  // Champs texte
  const fields = ['vendeur-firstname', 'vendeur-lastname', 'vendeur-marque', 'vendeur-event'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Sélecteur métier
  const metierSelect = document.getElementById('vendeur-metier');
  if (metierSelect) metierSelect.innerHTML = buildMetierOptions(DEFAULT_METIER);

  // Logo preview
  const lp = document.getElementById('vendeur-logo-preview');
  if (lp) lp.innerHTML = '<span style="font-size:1.4rem;opacity:0.3;">🏷️</span>';

  // Cases à cocher
  const showQR = document.getElementById('vendeur-show-qr');
  if (showQR) showQR.checked = true;

  const logoWhite = document.getElementById('vendeur-logo-white');
  if (logoWhite) logoWhite.checked = false;

  // Bg logo
  const logoBg = document.getElementById('vendeur-logo-bg');
  if (logoBg) logoBg.value = 'white';

  // Polices
  const fontName = document.getElementById('vendeur-font-name');
  if (fontName) fontName.value = "'BFMarjane-Black_V1', 'BFMarjane Black', sans-serif";

  const fontRole = document.getElementById('vendeur-font-role');
  if (fontRole) fontRole.value = 'Arial, sans-serif';

  const fontMarque = document.getElementById('vendeur-font-marque');
  if (fontMarque) fontMarque.value = "'BFMarjane-Black_V1', sans-serif";

  // Tailles
  resetVendeurSizes();

  // Titre
  const title = document.getElementById('vendeur-modal-title');
  if (title) title.textContent = '🏷️ Nouveau Vendeur';
}

/* ============================================================
   UPLOAD LOGO
   ============================================================ */

export async function handleVendeurLogoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressLogo(dataUrl, 500);
    currentLogoSrc = compressed;

    const preview = document.getElementById('vendeur-logo-preview');
    if (preview) {
      preview.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:contain;background:transparent;">`;
    }

    updateVendeurPreview();
    showToast('Logo chargé ✅');
  } catch (err) {
    console.error('Erreur upload logo:', err);
    showToast('Erreur chargement logo', 'error');
  }
}

export function clearVendeurLogo() {
  currentLogoSrc = '';
  const preview = document.getElementById('vendeur-logo-preview');
  if (preview) preview.innerHTML = '<span style="font-size:1.4rem;opacity:0.3;">🏷️</span>';
  updateVendeurPreview();
}

/* ============================================================
   APERÇU LIVE
   ============================================================ */

export function updateVendeurPreview() {
  const container = document.getElementById('vendeur-badge-preview');
  if (!container) return;

  const data = collectFormData(false); // sans validation
  const html = buildVendeurBadgeHTML(data, { previewMode: true, withQR: false });

  // Remplace l'aperçu en conservant l'ID
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const newPreview = wrapper.firstElementChild;
  newPreview.id = 'vendeur-badge-preview';

  container.replaceWith(newPreview);

  // Régénère le QR séparément
  updateVendeurQR(data);
}

/**
 * Génère le QR code dans l'aperçu.
 */
function updateVendeurQR(data) {
  const qrDiv = document.querySelector('#vendeur-badge-preview .bv-qr');
  if (!qrDiv) return;

  if (data.showQR === false) {
    qrDiv.style.display = 'none';
    return;
  }

  qrDiv.style.display = '';
  qrDiv.innerHTML = '';

  const qrText = `NOM:${data.firstname} ${data.lastname}|METIER:${data.metier}|MARQUE:${data.brandName}`;

  import('qrcode').then(({ default: QRCode }) => {
    QRCode.toCanvas(qrText || 'VENDEUR', { width: 44, margin: 0 }, (err, canvas) => {
      if (err) { console.warn('QR error:', err); return; }
      qrDiv.innerHTML = '';
      qrDiv.appendChild(canvas);
      canvas.style.width  = '100%';
      canvas.style.height = '100%';
      canvas.style.display = 'block';
    });
  }).catch(err => console.warn('QRCode module non disponible:', err));
}

/* ============================================================
   TAILLES ET POLICES
   ============================================================ */

function readSizesFromForm() {
  return {
    name:   parseInt(document.getElementById('vsl-name')?.value)   || SIZE_DEFAULTS.name,
    role:   parseInt(document.getElementById('vsl-role')?.value)   || SIZE_DEFAULTS.role,
    marque: parseInt(document.getElementById('vsl-marque')?.value) || SIZE_DEFAULTS.marque,
    header: parseInt(document.getElementById('vsl-header')?.value) || SIZE_DEFAULTS.header,
    logo:   parseInt(document.getElementById('vsl-logo')?.value)   || SIZE_DEFAULTS.logo
  };
}

export function applyVendeurSizes() {
  const sizes = readSizesFromForm();

  // Met à jour les labels
  const labels = {
    'vsl-lbl-name':   sizes.name,
    'vsl-lbl-role':   sizes.role,
    'vsl-lbl-marque': sizes.marque,
    'vsl-lbl-header': sizes.header,
    'vsl-lbl-logo':   sizes.logo
  };
  Object.entries(labels).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = `${val}px`;
  });

  // Applique aux éléments de l'aperçu
  const pv = document.getElementById('vendeur-badge-preview');
  if (!pv) return;

  const styleMap = [
    ['.bv-name',         `font-size:${sizes.name}px`],
    ['.bv-role',         `font-size:${sizes.role}px`],
    ['.bv-marque-box',   `font-size:${sizes.marque}px`],
    ['.bv-header',       `height:${sizes.header}px`],
    ['.bv-header img',   `max-height:${sizes.logo}px`]
  ];

  styleMap.forEach(([selector, style]) => {
    pv.querySelectorAll(selector).forEach(el => {
      el.style.cssText += ';' + style + ';';
    });
  });
}

export function applyVendeurFonts() {
  const fName = document.getElementById('vendeur-font-name')?.value;
  const fRole = document.getElementById('vendeur-font-role')?.value;
  const fMarq = document.getElementById('vendeur-font-marque')?.value;

  const pv = document.getElementById('vendeur-badge-preview');
  if (!pv || !fName) return;

  pv.querySelectorAll('.bv-name').forEach(el => el.style.fontFamily = fName);
  pv.querySelectorAll('.bv-header').forEach(el => el.style.fontFamily = fName);
  pv.querySelectorAll('.bv-role').forEach(el => el.style.fontFamily = fRole || fName);
  pv.querySelectorAll('.bv-marque-box').forEach(el => el.style.fontFamily = fMarq || fName);
}

export function resetVendeurSizes() {
  const map = {
    'vsl-name':   SIZE_DEFAULTS.name,
    'vsl-role':   SIZE_DEFAULTS.role,
    'vsl-marque': SIZE_DEFAULTS.marque,
    'vsl-header': SIZE_DEFAULTS.header,
    'vsl-logo':   SIZE_DEFAULTS.logo
  };
  Object.entries(map).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  applyVendeurSizes();
}

/* ============================================================
   COLLECTE DES DONNÉES DU FORMULAIRE
   ============================================================ */

function collectFormData(validate = true) {
  const firstname = (document.getElementById('vendeur-firstname')?.value || '').trim();
  const lastname  = (document.getElementById('vendeur-lastname')?.value  || '').trim();
  const brandName = (document.getElementById('vendeur-marque')?.value    || '').trim();
  const metier    = normalizeMetier(document.getElementById('vendeur-metier')?.value);
  const eventId   = parseInt(document.getElementById('vendeur-event')?.value) || null;

  if (validate) {
    if (!firstname && !lastname) {
      showToast('Nom ou prénom requis', 'error');
      return null;
    }
    if (!brandName) {
      showToast('Marque requise', 'error');
      return null;
    }
  }

  return {
    id:         editingId || undefined,
    firstname,
    lastname,
    name:       `${firstname} ${lastname}`.trim(),
    brandName,
    marque:     brandName,
    metier,
    role:       getMetierLabel(metier),
    eventId,
    brandLogo:  currentLogoSrc,
    logo:       currentLogoSrc,
    model:      VENDEUR_MODEL,
    format:     VENDEUR_MODEL,
    showQR:     document.getElementById('vendeur-show-qr')?.checked !== false,
    logoWhite:  !!document.getElementById('vendeur-logo-white')?.checked,
    logoBg:     document.getElementById('vendeur-logo-bg')?.value || 'white',
    fontName:   document.getElementById('vendeur-font-name')?.value,
    fontRole:   document.getElementById('vendeur-font-role')?.value,
    fontMarque: document.getElementById('vendeur-font-marque')?.value,
    sizes:      readSizesFromForm(),
    badgeId:    `VEND-${Date.now()}`,
    createdAt:  new Date().toISOString(),
    photo:      ''
  };
}

/* ============================================================
   SAUVEGARDE
   ============================================================ */

export async function saveVendeur() {
  const data = collectFormData(true);
  if (!data) return;

  try {
    if (editingId) {
      await store.put('badges', data);
      showToast('Vendeur modifié ✅');
    } else {
      await store.add('badges', data);
      showToast('Vendeur créé ✅');
    }

    closeVendeurModal();
    await loadVendeurs();
    document.dispatchEvent(new CustomEvent('data:refresh'));
  } catch (err) {
    console.error('Erreur saveVendeur:', err);
    showToast('Erreur lors de la sauvegarde', 'error');
  }
}

/* ============================================================
   ÉDITION
   ============================================================ */

export async function editVendeur(id) {
  try {
    const v = await store.get('badges', id);
    if (!v) { showToast('Vendeur introuvable', 'error'); return; }

    editingId = id;
    currentLogoSrc = v.brandLogo || v.logo || '';

    // Champs
    setValue('vendeur-firstname', v.firstname || '');
    setValue('vendeur-lastname',  v.lastname  || '');
    setValue('vendeur-marque',    v.brandName || v.marque || '');
    setValue('vendeur-event',     v.eventId   || '');

    // Métier
    const metierSelect = document.getElementById('vendeur-metier');
    if (metierSelect) metierSelect.innerHTML = buildMetierOptions(normalizeMetier(v.metier));

    // Cases
    setChecked('vendeur-show-qr',    v.showQR !== false);
    setChecked('vendeur-logo-white', !!v.logoWhite);
    setValue('vendeur-logo-bg',      v.logoBg || 'white');

    // Polices
    if (v.fontName)   setValue('vendeur-font-name',   v.fontName);
    if (v.fontRole)   setValue('vendeur-font-role',   v.fontRole);
    if (v.fontMarque) setValue('vendeur-font-marque', v.fontMarque);

    // Tailles
    if (v.sizes) {
      Object.entries(v.sizes).forEach(([key, val]) => {
        const el = document.getElementById(`vsl-${key}`);
        if (el) el.value = val;
      });
    }

    // Logo preview
    const lp = document.getElementById('vendeur-logo-preview');
    if (lp) {
      lp.innerHTML = currentLogoSrc
        ? `<img src="${currentLogoSrc}" style="width:100%;height:100%;object-fit:contain;background:transparent;">`
        : '<span style="font-size:1.4rem;opacity:0.3;">🏷️</span>';
    }

    // Titre
    const title = document.getElementById('vendeur-modal-title');
    if (title) title.textContent = '✏️ Modifier Vendeur';

    modal.open(MODAL_ID);
    updateVendeurPreview();

    setTimeout(() => {
      applyVendeurSizes();
      applyVendeurFonts();
    }, 100);
  } catch (err) {
    console.error('Erreur editVendeur:', err);
    showToast('Erreur chargement vendeur', 'error');
  }
}

/* ============================================================
   CHARGEMENT & RENDU DE LA LISTE
   ============================================================ */

export async function loadVendeurs() {
  try {
    const all = await store.getAll('badges');
    const vendeurs = all.filter(isVendeur);

    // Peuple le filtre marques
    populateMarqueFilter(vendeurs);

    // Peuple le filtre métiers (une seule fois)
    populateMetierFilter();

    // Applique les filtres
    const filtered = applyFilters(vendeurs);

    // MAJ stats
    updateVendeurStats(all.filter(isVendeur), filtered);

    // Rendu
    renderVendeurGrid(filtered);
  } catch (err) {
    console.error('Erreur loadVendeurs:', err);
  }
}

/**
 * Vrai si le badge est un vendeur (pas un badge standard).
 */
function isVendeur(b) {
  return b.model === VENDEUR_MODEL
      || b.model === 'brand-vendor'
      || b.role === 'Vendeur'
      || !!b.metier;
}

/**
 * Applique les filtres de recherche (search + métier + marque).
 */
function applyFilters(vendeurs) {
  const search = (document.getElementById('search-vendeurs')?.value || '').toLowerCase();
  const metierFilter = document.getElementById('filter-vendeur-metier')?.value || '';
  const marqueFilter = document.getElementById('filter-vendeur-marque')?.value || '';

  let result = vendeurs;

  if (search) {
    result = result.filter(v =>
      (v.name || '').toLowerCase().includes(search) ||
      (v.brandName || '').toLowerCase().includes(search)
    );
  }

  if (metierFilter) {
    result = result.filter(v => normalizeMetier(v.metier) === metierFilter);
  }

  if (marqueFilter) {
    result = result.filter(v => (v.brandName || v.marque) === marqueFilter);
  }

  return result;
}

/**
 * Peuple le <select id="filter-vendeur-metier">.
 */
function populateMetierFilter() {
  const sel = document.getElementById('filter-vendeur-metier');
  if (!sel || sel.dataset.populated === 'true') return;

  const current = sel.value;
  sel.innerHTML = buildMetierFilterOptions(current);
  sel.dataset.populated = 'true';
}

/**
 * Peuple le <select id="filter-vendeur-marque">.
 */
function populateMarqueFilter(vendeurs) {
  const sel = document.getElementById('filter-vendeur-marque');
  if (!sel) return;

  const current = sel.value;
  const marques = [...new Set(
    vendeurs.map(v => v.brandName || v.marque).filter(Boolean)
  )].sort();

  sel.innerHTML = '<option value="">Toutes les marques</option>' +
    marques.map(m => `<option value="${escapeHTML(m)}">${escapeHTML(m)}</option>`).join('');

  if (current && marques.includes(current)) sel.value = current;
}

/**
 * Met à jour les cartes de statistiques vendeurs.
 */
function updateVendeurStats(allVendeurs, filteredVendeurs) {
  const totalEl = document.getElementById('vendeurs-total');
  if (totalEl) totalEl.textContent = filteredVendeurs.length;

  const countEl = document.getElementById('vendeurs-count');
  if (countEl) countEl.textContent = filteredVendeurs.length;

  const statTotalEl = document.getElementById('vstat-vendeurs');
  if (statTotalEl) statTotalEl.textContent = allVendeurs.length;

  const marques = new Set(allVendeurs.map(v => v.brandName || v.marque).filter(Boolean));
  const statMarquesEl = document.getElementById('vstat-marques');
  if (statMarquesEl) statMarquesEl.textContent = marques.size;

  const statPrintEl = document.getElementById('vstat-vendeurs-print');
  if (statPrintEl) statPrintEl.textContent = allVendeurs.length;

  // Badge bottom-nav
  const bnVendeurs = document.getElementById('bn-vendeurs-count');
  if (bnVendeurs) {
    bnVendeurs.textContent = allVendeurs.length;
    bnVendeurs.style.display = allVendeurs.length > 0 ? 'block' : 'none';
  }

  // Remplissage du select event si vide
  populateEventSelect();
}

/**
 * Remplit le select événement dans le formulaire vendeur.
 */
async function populateEventSelect() {
  const sel = document.getElementById('vendeur-event');
  if (!sel) return;

  try {
    const events = await store.getAll('events');
    const current = sel.value;

    sel.innerHTML = '<option value="">-- Événement (optionnel) --</option>';
    events.forEach(ev => {
      sel.innerHTML += `<option value="${ev.id}">${escapeHTML(ev.name)}</option>`;
    });

    if (current) sel.value = current;
  } catch (err) {
    console.warn('populateEventSelect:', err);
  }
}

/* ============================================================
   RENDU DE LA GRILLE
   ============================================================ */

function renderVendeurGrid(vendeurs) {
  const grid  = document.getElementById('vendeurs-grid');
  const empty = document.getElementById('vendeurs-empty');
  if (!grid) return;

  if (!vendeurs.length) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }

  if (empty) empty.style.display = 'none';

  grid.innerHTML = vendeurs.map(v => renderVendeurCard(v)).join('');
}

/**
 * Construit une carte vendeur.
 */
function renderVendeurCard(v) {
  const isSelected = selectedVendeurs.has(v.id);
  const logo = v.brandLogo || v.logo || '';
  const marque = v.brandName || v.marque || '—';
  const metierLabel = getMetierLabel(normalizeMetier(v.metier));

  const thumb = logo
    ? `<img src="${escapeHTML(logo)}" class="vendeur-thumb" alt="logo">`
    : `<div class="vendeur-thumb-placeholder">${escapeHTML(marque.charAt(0) || '?')}</div>`;

  const badgePreview = buildVendeurBadgeHTML(v, { withQR: false });

  return `
    <div class="card vendeur-card${isSelected ? ' selected' : ''}" data-id="${v.id}">
      <div class="vendeur-card-head">
        <input type="checkbox" ${isSelected ? 'checked' : ''}
               data-action="vendeur-toggle-select" data-id="${v.id}">
        ${thumb}
        <div class="vendeur-card-info">
          <div class="vendeur-card-name">${escapeHTML(v.name || `${v.firstname} ${v.lastname}`)}</div>
          <div class="vendeur-card-meta">
            <span class="metier-badge">${escapeHTML(metierLabel)}</span>
            · <strong>${escapeHTML(marque)}</strong>
          </div>
        </div>
        <div class="vendeur-card-actions">
          <button class="btn btn-info btn-sm btn-icon"
                  data-action="vendeur-edit" data-id="${v.id}"
                  title="Modifier" aria-label="Modifier">✏️</button>
          <button class="btn btn-ghost btn-sm btn-icon"
                  data-action="vendeur-download" data-id="${v.id}"
                  title="Télécharger PNG" aria-label="Télécharger PNG">⬇️</button>
          <button class="btn btn-danger btn-sm btn-icon"
                  data-action="vendeur-delete" data-id="${v.id}"
                  title="Supprimer" aria-label="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="vendeur-card-preview">
        ${badgePreview}
      </div>
    </div>
  `;
}

/* ============================================================
   SÉLECTION MULTIPLE
   ============================================================ */

export function toggleSelect(id) {
  if (selectedVendeurs.has(id)) selectedVendeurs.delete(id);
  else selectedVendeurs.add(id);
  loadVendeurs();
}

export async function selectAllVendeurs() {
  try {
    const all = await store.getAll('badges');
    const vendeurs = all.filter(isVendeur);
    const filtered = applyFilters(vendeurs);

    filtered.forEach(v => selectedVendeurs.add(v.id));
    loadVendeurs();
  } catch (err) {
    console.error('selectAllVendeurs:', err);
  }
}

/* ============================================================
   SUPPRESSION
   ============================================================ */

export async function deleteVendeur(id) {
  const ok = await showConfirm({
    title: 'Supprimer ce vendeur ?',
    message: 'Le badge vendeur sera définitivement supprimé.',
    okText: 'Supprimer',
    type: 'danger',
    icon: '🏷️'
  });

  if (!ok) return;

  try {
    await store.delete('badges', id);
    showToast('Vendeur supprimé');
    loadVendeurs();
  } catch (err) {
    console.error('deleteVendeur:', err);
    showToast('Erreur suppression', 'error');
  }
}

export async function deleteSelectedVendeurs() {
  if (!selectedVendeurs.size) {
    showToast('Aucun vendeur sélectionné', 'info');
    return;
  }

  const ok = await showConfirm({
    title: `Supprimer ${selectedVendeurs.size} vendeur(s) ?`,
    message: 'Cette action est irréversible.',
    okText: 'Supprimer',
    type: 'danger',
    icon: '🏷️'
  });

  if (!ok) return;

  try {
    for (const id of selectedVendeurs) {
      await store.delete('badges', id);
    }
    selectedVendeurs.clear();
    showToast('Vendeurs supprimés');
    loadVendeurs();
  } catch (err) {
    console.error('deleteSelectedVendeurs:', err);
    showToast('Erreur suppression multiple', 'error');
  }
}

/* ============================================================
   DOWNLOAD PNG INDIVIDUEL
   ============================================================ */

export async function downloadVendeurBadge(id) {
  try {
    const v = await store.get('badges', id);
    if (!v) { showToast('Vendeur introuvable', 'error'); return; }

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-9999px';
    wrapper.innerHTML = buildVendeurBadgeHTML(v, { withQR: false });
    document.body.appendChild(wrapper);

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(wrapper.firstElementChild, {
      scale: 3,
      backgroundColor: '#ffffff'
    });

    const a = document.createElement('a');
    a.download = `badge-vendeur-${(v.name || 'vendeur').replace(/\s+/g, '-')}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();

    document.body.removeChild(wrapper);
    showToast('PNG généré ✅');
  } catch (err) {
    console.error('downloadVendeurBadge:', err);
    showToast('Erreur génération PNG', 'error');
  }
}

/* ============================================================
   HELPERS DOM
   ============================================================ */

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = value;
}

/* ============================================================
   API PUBLIQUE (exposée à window.BadgeMaster.vendeur)
   ============================================================ */

export const vendeurAPI = {
  // Formulaire
  open: openVendeurModal,
  close: closeVendeurModal,
  save: saveVendeur,
  edit: editVendeur,

  // Aperçu / tailles
  updatePreview: updateVendeurPreview,
  applySizes: applyVendeurSizes,
  applyFonts: applyVendeurFonts,
  resetSizes: resetVendeurSizes,

  // Logo
  uploadLogo: handleVendeurLogoUpload,
  clearLogo: clearVendeurLogo,

  // Liste
  load: loadVendeurs,
  toggleSelect,
  selectAll: selectAllVendeurs,
  remove: deleteVendeur,
  removeSelected: deleteSelectedVendeurs,

  // Export
  downloadPNG: downloadVendeurBadge
};
