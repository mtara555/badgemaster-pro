import * as XLSX from 'xlsx';
/**
 * ============================================================
 *  BADGEMASTER PRO — Vendeur module (v2 corrigée)
 *  ============================================================
 *  Correctifs v2 :
 *   - QR généré dans l'aperçu (withQR: true)
 *   - Tailles/polices : setProperty avec priorité important
 *   - Marque : trim() + message d'erreur ciblé
 *   - Debug console pour les cas d'erreur
 * ============================================================
 */

import { store }              from '../db/idb.js';
import { showToast }          from '../ui/toast.js';
import { showConfirm }        from '../ui/confirm.js';
import { modal }              from '../ui/modal.js';
import {
  escapeHTML,
  compressLogo,
  fileToDataURL
} from '../ui/util.js';

import {
  DEFAULT_METIER,
  buildMetierOptions,
  buildMetierFilterOptions,
  normalizeMetier,
  getMetierLabel
} from './metiers.js';

import { buildVendeurBadgeHTML, buildVendeurBadgeSamsungHTML } from './vendeur-badge.js';

/* ============================================================
   ÉTAT INTERNE
   ============================================================ */
const VENDEUR_MODEL = 'vendeur-exact';
let currentBadgeModel = 'classic';  // 'classic' | 'samsung'
const MODAL_ID      = 'vendeur-modal';

const selectedVendeurs = new Set();
let currentLogoSrc = '';
let editingId = null;

const SIZE_DEFAULTS = Object.freeze({
  name: 24, role: 14, marque: 13, header: 62, logo: 46
});

/* ============================================================
   OUVERTURE / FERMETURE
   ============================================================ */

export function openVendeurModal(id = null) {
  if (id) return editVendeur(id);
  resetVendeurForm();
  modal.open(MODAL_ID);
  updateVendeurPreview();
}

export function closeVendeurModal() {
  modal.close(MODAL_ID);
}

function resetVendeurForm() {
  editingId = null;
  currentLogoSrc = '';

  ['vendeur-firstname', 'vendeur-lastname', 'vendeur-marque', 'vendeur-event']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  const metierSelect = document.getElementById('vendeur-metier');
  if (metierSelect) metierSelect.innerHTML = buildMetierOptions(DEFAULT_METIER);

  const lp = document.getElementById('vendeur-logo-preview');
  if (lp) lp.innerHTML = '<span style="font-size:1.4rem;opacity:0.3;">🏷️</span>';

  const showQR = document.getElementById('vendeur-show-qr');
  if (showQR) showQR.checked = true;

  const logoWhite = document.getElementById('vendeur-logo-white');
  if (logoWhite) logoWhite.checked = false;

  const logoBg = document.getElementById('vendeur-logo-bg');
  if (logoBg) logoBg.value = 'white';

  resetVendeurSizes();

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

  const data = collectFormData(false);

  // ✅ FIX 1 : withQR: true pour avoir le div .bv-qr dans l'aperçu
  // ✅ Choix du renderer selon le modèle
  let html;
  if (currentBadgeModel === "samsung") {
    html = buildVendeurBadgeSamsungHTML(data);
  } else {
    html = buildVendeurBadgeHTML(data, { previewMode: true, withQR: true });
  }

  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  const newPreview = wrapper.firstElementChild;
  newPreview.id = 'vendeur-badge-preview';

  container.replaceWith(newPreview);

  // Ré-applique tailles + polices après le remplacement
  applyVendeurSizes();
  applyVendeurFonts();

  // ✅ FIX 2 : QR régénéré avec un petit délai (laisse le DOM respirer)
  setTimeout(() => updateVendeurQR(data), 30);
}

function updateVendeurQR(data) {
  const qrDiv = document.querySelector('#vendeur-badge-preview .bv-qr');
  if (!qrDiv) {
    // Silencieux : normal si la modale a été fermée ou si le badge
    // est rendu en mode liste (withQR: false)
    return;
  }

  if (data.showQR === false) {
    qrDiv.style.display = 'none';
    return;
  }

  qrDiv.style.display = '';
  qrDiv.innerHTML = '';

  const qrText = `NOM:${data.firstname} ${data.lastname}|METIER:${data.metier}|MARQUE:${data.brandName}`;

  import('qrcode')
    .then(({ default: QRCode }) => {
      QRCode.toCanvas(qrText || 'VENDEUR', {
        width: 44,
        margin: 0,
        color: { dark: '#1a56b0', light: '#ffffff' }
      }, (err, canvas) => {
        if (err) {
          console.error('[vendeur] Erreur QR:', err);
          return;
        }
        qrDiv.innerHTML = '';
        qrDiv.appendChild(canvas);
        canvas.style.width  = '100%';
        canvas.style.height = '100%';
        canvas.style.display = 'block';
      });
    })
    .catch(err => {
      console.error('[vendeur] Module qrcode non chargé:', err);
    });
}

/* ============================================================
   TAILLES ET POLICES — FIX 3 : setProperty avec !important
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

  // Applique aux éléments de l'aperçu — avec !important
  const pv = document.getElementById('vendeur-badge-preview');
  if (!pv) return;

  // Format [sélecteur, propriété CSS, valeur]
  const rules = [
    ['.bv-name',       'font-size',  `${sizes.name}px`],
    ['.bv-role',       'font-size',  `${sizes.role}px`],
    ['.bv-marque-box', 'font-size',  `${sizes.marque}px`],
    ['.bv-header',     'height',     `${sizes.header}px`],
    ['.bv-header img', 'max-height', `${sizes.logo}px`]
  ];

  rules.forEach(([selector, prop, value]) => {
    pv.querySelectorAll(selector).forEach(el => {
      // ✅ setProperty avec priorité 'important' → override CSS !important
      el.style.setProperty(prop, value, 'important');
    });
  });
}

export function applyVendeurFonts() {
  const fName = document.getElementById('vendeur-font-name')?.value;
  const fRole = document.getElementById('vendeur-font-role')?.value;
  const fMarq = document.getElementById('vendeur-font-marque')?.value;

  const pv = document.getElementById('vendeur-badge-preview');
  if (!pv || !fName) return;

  pv.querySelectorAll('.bv-name, .bv-header').forEach(el => {
    el.style.setProperty('font-family', fName, 'important');
  });
  pv.querySelectorAll('.bv-role').forEach(el => {
    el.style.setProperty('font-family', fRole || fName, 'important');
  });
  pv.querySelectorAll('.bv-marque-box').forEach(el => {
    el.style.setProperty('font-family', fMarq || fName, 'important');
  });
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
  const firstnameEl = document.getElementById('vendeur-firstname');
  const lastnameEl  = document.getElementById('vendeur-lastname');
  const marqueEl    = document.getElementById('vendeur-marque');
  const metierEl    = document.getElementById('vendeur-metier');
  const eventEl     = document.getElementById('vendeur-event');

  // Debug : prévient si un élément DOM est manquant
  if (validate) {
    if (!firstnameEl) console.error('[vendeur] #vendeur-firstname introuvable');
    if (!lastnameEl)  console.error('[vendeur] #vendeur-lastname introuvable');
    if (!marqueEl)    console.error('[vendeur] #vendeur-marque introuvable');
  }

  const firstname = (firstnameEl?.value || '').trim();
  const lastname  = (lastnameEl?.value  || '').trim();
  const brandName = (marqueEl?.value    || '').trim();
  const metier    = normalizeMetier(metierEl?.value);
  const eventId   = parseInt(eventEl?.value) || null;

  // ✅ FIX 3 : Validation ciblée avec message détaillé
  if (validate) {
    if (!firstname && !lastname) {
      showToast('Nom ou prénom requis', 'error');
      console.warn('[vendeur] saveVendeur — firstname & lastname vides');
      return null;
    }
    if (!brandName) {
      showToast('Marque requise — remplis le champ "MARQUE *"', 'error');
      console.warn('[vendeur] saveVendeur — marque vide. Élément:', marqueEl, 'Valeur:', marqueEl?.value);
      // Focus sur le champ manquant
      marqueEl?.focus();
      marqueEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
  }

  const data = {
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
    model:      currentBadgeModel === 'samsung' ? 'samsung' : VENDEUR_MODEL,
    format:     VENDEUR_MODEL,
    showQR:     document.getElementById('vendeur-show-qr')?.checked !== false,
    logoWhite:  !!document.getElementById('vendeur-logo-white')?.checked,
    logoBg:     document.getElementById('vendeur-logo-bg')?.value || 'white',
    fontName:   document.getElementById('vendeur-font-name')?.value,
    fontRole:   document.getElementById('vendeur-font-role')?.value,
    fontMarque: document.getElementById('vendeur-font-marque')?.value,
    sizes:      readSizesFromForm(),
    samsungW:   parseFloat(document.getElementById("samsung-width")?.value) || 54,
    samsungH:   parseFloat(document.getElementById("samsung-height")?.value) || 86,
    badgeId:    `VEND-${Date.now()}`,
    createdAt:  new Date().toISOString(),
    photo:      ''
  };

  // ✅ FIX : n'ajouter l'id QUE en mode édition
  // Sinon IndexedDB 'add' échoue sur keyPath 'id' avec valeur undefined
  if (editingId) {
    data.id = editingId;
  }

  return data;
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
    showToast('Erreur lors de la sauvegarde : ' + err.message, 'error');
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

    setValue('vendeur-firstname', v.firstname || '');
    setValue('vendeur-lastname',  v.lastname  || '');
    setValue('vendeur-marque',    v.brandName || v.marque || '');
    setValue('vendeur-event',     v.eventId   || '');

    const metierSelect = document.getElementById('vendeur-metier');
    if (metierSelect) metierSelect.innerHTML = buildMetierOptions(normalizeMetier(v.metier));

    setChecked('vendeur-show-qr',    v.showQR !== false);
    setChecked('vendeur-logo-white', !!v.logoWhite);
    setValue('vendeur-logo-bg',      v.logoBg || 'white');

    if (v.fontName)   setValue('vendeur-font-name',   v.fontName);
    if (v.fontRole)   setValue('vendeur-font-role',   v.fontRole);
    if (v.fontMarque) setValue('vendeur-font-marque', v.fontMarque);

    // Charge les dimensions Samsung si présentes
    if (v.samsungW) setValue("samsung-width", v.samsungW);
    if (v.samsungH) setValue("samsung-height", v.samsungH);

    if (v.sizes) {
      Object.entries(v.sizes).forEach(([key, val]) => {
        const el = document.getElementById(`vsl-${key}`);
        if (el) el.value = val;
      });
    }

    const lp = document.getElementById('vendeur-logo-preview');
    if (lp) {
      lp.innerHTML = currentLogoSrc
        ? `<img src="${currentLogoSrc}" style="width:100%;height:100%;object-fit:contain;background:transparent;">`
        : '<span style="font-size:1.4rem;opacity:0.3;">🏷️</span>';
    }

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
   LISTE + STATS
   ============================================================ */

export async function loadVendeurs() {
  try {
    const all = await store.getAll('badges');
    const vendeurs = all.filter(isVendeur);

    populateMarqueFilter(vendeurs);
    populateMetierFilter();

    const filtered = applyFilters(vendeurs);
    updateVendeurStats(all.filter(isVendeur), filtered);
    renderVendeurGrid(filtered);
  } catch (err) {
    console.error('Erreur loadVendeurs:', err);
  }
}

function isVendeur(b) {
  return b.model === VENDEUR_MODEL
      || b.model === 'brand-vendor'
      || b.role === 'Vendeur'
      || !!b.metier;
}

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

function populateMetierFilter() {
  const sel = document.getElementById('filter-vendeur-metier');
  if (!sel || sel.dataset.populated === 'true') return;
  const current = sel.value;
  sel.innerHTML = buildMetierFilterOptions(current);
  sel.dataset.populated = 'true';
}

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

function updateVendeurStats(allVendeurs, filteredVendeurs) {
  setText('vendeurs-total', filteredVendeurs.length);
  setText('vendeurs-count', filteredVendeurs.length);
  setText('vstat-vendeurs', allVendeurs.length);

  const marques = new Set(allVendeurs.map(v => v.brandName || v.marque).filter(Boolean));
  setText('vstat-marques', marques.size);
  setText('vstat-vendeurs-print', allVendeurs.length);

  const bnVendeurs = document.getElementById('bn-vendeurs-count');
  if (bnVendeurs) {
    bnVendeurs.textContent = allVendeurs.length;
    bnVendeurs.style.display = allVendeurs.length > 0 ? 'block' : 'none';
  }

  populateEventSelect();
}

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

function renderVendeurCard(v) {
  const isSelected = selectedVendeurs.has(v.id);
  const logo = v.brandLogo || v.logo || '';
  const marque = v.brandName || v.marque || '—';
  const metierLabel = getMetierLabel(normalizeMetier(v.metier));

  const thumb = logo
    ? `<img src="${escapeHTML(logo)}" class="vendeur-thumb" alt="logo">`
    : `<div class="vendeur-thumb-placeholder">${escapeHTML(marque.charAt(0) || '?')}</div>`;

  // ✅ Renderer dynamique selon le modèle sauvegardé
  let badgePreview;
  if (v.model === 'samsung') {
    badgePreview = buildVendeurBadgeSamsungHTML(v);
  } else {
    badgePreview = buildVendeurBadgeHTML(v, { withQR: false });
  }

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
                  data-action="vendeur-edit" data-id="${v.id}" title="Modifier">✏️</button>
          <button class="btn btn-ghost btn-sm btn-icon"
                  data-action="vendeur-download" data-id="${v.id}" title="PNG">⬇️</button>
          <button class="btn btn-danger btn-sm btn-icon"
                  data-action="vendeur-delete" data-id="${v.id}" title="Supprimer">🗑️</button>
        </div>
      </div>
      <div class="vendeur-card-preview">${badgePreview}</div>
    </div>
  `;
}

/* ============================================================
   SÉLECTION / SUPPRESSION
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

export async function deleteVendeur(id) {
  const ok = await showConfirm({
    title: 'Supprimer ce vendeur ?',
    message: 'Le badge vendeur sera définitivement supprimé.',
    okText: 'Supprimer', type: 'danger', icon: '🏷️'
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
    okText: 'Supprimer', type: 'danger', icon: '🏷️'
  });
  if (!ok) return;

  try {
    for (const id of selectedVendeurs) await store.delete('badges', id);
    selectedVendeurs.clear();
    showToast('Vendeurs supprimés');
    loadVendeurs();
  } catch (err) {
    console.error('deleteSelectedVendeurs:', err);
    showToast('Erreur suppression multiple', 'error');
  }
}

/* ============================================================
   EXPORT PNG
   ============================================================ */

/* ============================================================
   IMPRESSION DES BADGES VENDEURS
   ============================================================ */

/**
 * Imprime les vendeurs sélectionnés dans la modale vendeur-print-modal.
 */
export async function printSelectedVendeurs() {
  if (!selectedVendeurs.size) {
    showToast("Aucun vendeur sélectionné", "info");
    return;
  }

  try {
    const vendeurs = [];
    for (const id of selectedVendeurs) {
      const v = await store.get("badges", id);
      if (v) vendeurs.push(v);
    }

    modal.open("vendeur-print-modal");

    const countEl = document.getElementById("vendeur-print-count");
    if (countEl) countEl.textContent = `${vendeurs.length} vendeur(s)`;

    await generateVendeurPrintContent(vendeurs, "vendeur-print-content");
  } catch (err) {
    console.error("[vendeur] printSelected:", err);
    showToast("Erreur impression", "error");
  }
}

/**
 * Imprime tous les vendeurs (planche A4).
 */
export async function printAllVendeursA4() {
  try {
    const all = await store.getAll("badges");
    const vendeurs = all.filter(isVendeur);

    if (!vendeurs.length) {
      showToast("Aucun vendeur à imprimer", "error");
      return;
    }

    modal.open("vendeur-print-modal");

    const countEl = document.getElementById("vendeur-print-count");
    if (countEl) countEl.textContent = `${vendeurs.length} vendeur(s)`;

    await generateVendeurPrintContent(vendeurs, "vendeur-print-content");
  } catch (err) {
    console.error("[vendeur] printAllA4:", err);
    showToast("Erreur impression", "error");
  }
}

/**
 * Génère le contenu A4 (8 badges par page).
 */
async function generateVendeurPrintContent(vendeurs, containerId) {
  const content = document.getElementById(containerId);
  if (!content) return;

  content.innerHTML = "";

  // ✅ 6 badges par page (Samsung ou Classique)
  const PER_PAGE = 6;
  const totalPages = Math.ceil(vendeurs.length / PER_PAGE);

  console.log(`🖨️ Génération : ${vendeurs.length} vendeurs → ${totalPages} page(s) de 6`);

  for (let p = 0; p < totalPages; p++) {
    const page = document.createElement("div");
    page.className = "a4-page";

    // ✅ Grid 2 colonnes × 3 rangées
    page.style.cssText = [
      "width:210mm",
      "height:297mm",
      "padding:10mm",
      "background:#ffffff",
      "box-sizing:border-box",
      "display:grid",
      "grid-template-columns:repeat(2, 54mm)",     // ← 2 colonnes de 54mm
      "grid-template-rows:repeat(3, 86mm)",         // ← 3 rangées de 86mm
      "gap:8mm 8mm",                                // ← gap 8mm horizontal et vertical
      "justify-content:center",                     // ← centre la grille horizontalement
      "align-content:start",                        // ← aligne en haut
      "justify-items:center",
      "align-items:start",
      p < totalPages - 1 ? "page-break-after:always" : "page-break-after:auto",
      "page-break-inside:avoid"
    ].join(";");

    for (let i = 0; i < PER_PAGE; i++) {
      const idx = p * PER_PAGE + i;
      if (idx >= vendeurs.length) {
        // ✅ Cellule vide pour maintenir la grille
        const emptyCell = document.createElement("div");
        emptyCell.style.cssText = "width:54mm;height:86mm;";
        page.appendChild(emptyCell);
        continue;
      }

      const v = vendeurs[idx];
      const isSamsung = v.model === 'samsung';

      // ✅ Dimensions Samsung (54×86 mm par défaut)
      let widthMm = 54, heightMm = 86;
      if (isSamsung) {
        widthMm = parseFloat(v.samsungW) || 54;
        heightMm = parseFloat(v.samsungH) || 86;
      }

      // ✅ Wrapper avec dimensions exactes + page-break-inside
      const cell = document.createElement("div");
      cell.style.cssText = [
        `width:${widthMm}mm`,
        `height:${heightMm}mm`,
        "position:relative",
        "overflow:hidden",
        "display:block",
        "box-sizing:border-box",
        "page-break-inside:avoid",
        "break-inside:avoid"
      ].join(";");

      // ✅ Renderer dynamique selon le modèle sauvegardé
      let badgeHtml;
      if (isSamsung) {
        badgeHtml = buildVendeurBadgeSamsungHTML(v);
      } else {
        badgeHtml = buildVendeurBadgeHTML(v, { withQR: true, qrId: `vqr-${v.id}` });
      }

      cell.innerHTML = badgeHtml;
      page.appendChild(cell);
    }

    content.appendChild(page);
  }

  // ✅ Génère les QR codes (uniquement pour classiques)
  if (vendeurs.some(v => v.model !== 'samsung')) {
    setTimeout(() => generateVendeurQRs(vendeurs), 200);
  }
}

async function generateVendeurQRs(vendeurs) {
  try {
    const { default: QRCode } = await import("qrcode");

    for (const v of vendeurs) {
      const div = document.getElementById(`vqr-${v.id}`);
      if (!div) continue;

      const metierLabel = getMetierLabel(normalizeMetier(v.metier));
      const text = `NOM:${v.name || ""}|METIER:${metierLabel}|MARQUE:${v.brandName || v.marque || ""}`;

      div.innerHTML = "";
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, text || "VENDEUR", {
        width: 44,
        margin: 0,
        color: { dark: "#1a56b0", light: "#ffffff" }
      });
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      div.appendChild(canvas);
    }
  } catch (err) {
    console.warn("[vendeur] QR gen:", err);
  }
}

/* ============================================================
   EXPORT PDF DES VENDEURS
   ============================================================ */

export async function exportVendeursPDF() {
  const pages = document.querySelectorAll("#vendeur-print-content .a4-page");
  if (!pages.length) {
    showToast("Rien à exporter", "error");
    return;
  }

  try {
    showToast("Génération PDF… ⏳", "info", 2000);

    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import("html2canvas")).default;

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 3,
        backgroundColor: "#fff",
        useCORS: true,
        imageTimeout: 0
      });

      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, 210, 297);
    }

    pdf.save(`badges-vendeurs-${new Date().toISOString().split("T")[0]}.pdf`);
    showToast("PDF exporté ✅");
  } catch (err) {
    console.error("[vendeur] exportPDF:", err);
    showToast("Erreur PDF", "error");
  }
}

/* ============================================================
   EXPORT EXCEL DES VENDEURS
   ============================================================ */

export async function exportVendeursExcel() {
  try {
    const all = await store.getAll("badges");
    const vendeurs = all.filter(isVendeur);

    if (!vendeurs.length) {
      showToast("Aucun vendeur à exporter", "error");
      return;
    }

    const data = [["Nom", "Prénom", "Métier", "Marque", "Événement", "Logo?"]];

    vendeurs.forEach((v) => {
      data.push([
        v.lastname || "",
        v.firstname || "",
        getMetierLabel(normalizeMetier(v.metier)),
        v.brandName || v.marque || "",
        v.eventId || "",
        v.brandLogo ? "oui" : "non"
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendeurs");
    XLSX.writeFile(wb, `vendeurs-${new Date().toISOString().split("T")[0]}.xlsx`);

    showToast(`Export Excel ✅ (${vendeurs.length} vendeurs)`);
  } catch (err) {
    console.error("[vendeur] exportExcel:", err);
    showToast("Erreur Excel", "error");
  }
}

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
      scale: 3, backgroundColor: '#ffffff'
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
   HELPERS
   ============================================================ */

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = value;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}


/* ============================================================
   SÉLECTION DU MODÈLE DE BADGE
   ============================================================ */
export function selectBadgeModel(model, btn) {
  currentBadgeModel = model;
  document.querySelectorAll("#vendeur-model-group .option-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  // Affiche le bloc dimensions uniquement pour Samsung
  const dimBlock = document.getElementById("samsung-dimensions");
  if (dimBlock) {
    dimBlock.style.display = (model === "samsung") ? "block" : "none";
  }

  updateVendeurPreview();
  console.log(`🎨 Modèle : ${model}`);
}

/* ============================================================
   API PUBLIQUE
   ============================================================ */


/* ============================================================
   TAILLE PERSONNALISÉE SAMSUNG
   ============================================================ */
export function setSamsungSize() {
  const w = parseFloat(document.getElementById("samsung-width")?.value) || 54;
  const h = parseFloat(document.getElementById("samsung-height")?.value) || 86;
  updateVendeurPreview();
}

export function getSamsungDimensions() {
  const w = parseFloat(document.getElementById("samsung-width")?.value) || 54;
  const h = parseFloat(document.getElementById("samsung-height")?.value) || 86;
  return { w, h };
}

export const vendeurAPI = {
  open: openVendeurModal,
  close: closeVendeurModal,
  save: saveVendeur,
  edit: editVendeur,
  updatePreview: updateVendeurPreview,
  selectModel: selectBadgeModel,
  setSamsungSize,
  applySizes: applyVendeurSizes,
  applyFonts: applyVendeurFonts,
  resetSizes: resetVendeurSizes,
  uploadLogo: handleVendeurLogoUpload,
  clearLogo: clearVendeurLogo,
  load: loadVendeurs,
  toggleSelect,
  selectAll: selectAllVendeurs,
  remove: deleteVendeur,
  removeSelected: deleteSelectedVendeurs,
  downloadPNG: downloadVendeurBadge
};
