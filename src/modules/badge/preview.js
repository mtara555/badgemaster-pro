/**
 * ============================================================
 *  BADGEMASTER PRO — Badge Standard (Créer/Aperçu)
 *  ============================================================
 *  Gère la page "Créer un badge" :
 *   - Aperçu live (avec/sans photo, vendeur de marque)
 *   - Upload photo (fichier + caméra)
 *   - Upload logo
 *   - Upload logo marque
 *   - QR code dynamique
 *   - Formats (CR80, CR79, CR100, custom, compact)
 *   - Sauvegarde IndexedDB
 * ============================================================
 */

import { store }       from '../db/idb.js';
import { showToast }   from '../ui/toast.js';
import { modal }       from '../ui/modal.js';
import {
  escapeHTML,
  compressImage,
  compressLogo,
  fileToDataURL,
  mmToPx
} from '../ui/util.js';

/* ============================================================
   ÉTAT
   ============================================================ */
let currentFormat = 'cr80';
let currentModel  = 'with-photo';
let currentPhotoSrc = '';
let currentLogoSrc  = '';
let currentBrandLogoSrc = '';
let editingId = null;
let cameraTarget = null;
let cameraStream = null;
let cameraFacingMode = 'user';

const COMPACT_LIMITS = { wMin: 70, wMax: 80, hMin: 25, hMax: 35 };
let compactWidthMm = 75;
let compactHeightMm = 30;
let customWidthMm = 85;
let customHeightMm = 54;

/* ============================================================
   INIT
   ============================================================ */
export function initBadgePreview() {
  attachInputs();
  resetBadgeForm();
}

function attachInputs() {
  // ─── Upload Logo (listener DIRECT avec capture) ───
  attachFileInput('.logo-upload-zone[data-action="logo-upload"]', 'logo-input');
  attachFileInput('[data-action="brand-logo-upload"]', 'brand-logo-file');
  attachFileInput('[data-action="photo-upload-badge"]', 'badge-photo-file');

  // Champs texte → aperçu live
  ['badge-org', 'badge-name', 'badge-role', 'badge-id', 'badge-date', 'badge-brand-name']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', updateBadgePreview);
    });

  // Checkboxes
  ['badge-show-date', 'badge-empty-ribbon']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', updateBadgePreview);
    });

  // Sliders compact
  ['compact-width-range', 'compact-height-range']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', handleCompactSlider);
    });

  ['compact-width-mm', 'compact-height-mm']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', handleCompactNumber);
    });

  // Custom
  ['custom-width-mm', 'custom-height-mm']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', applyCustomSize);
    });

  // Photos / logos
  const badgePhoto = document.getElementById('badge-photo-file');
  if (badgePhoto) badgePhoto.addEventListener('change', e => handlePhotoUpload(e, 'badge'));

  const badgeLogo = document.getElementById('logo-input');
  if (badgeLogo) badgeLogo.addEventListener('change', handleLogoUpload);

  const brandLogo = document.getElementById('brand-logo-file');
  if (brandLogo) brandLogo.addEventListener('change', handleBrandLogoUpload);
}

/* ============================================================
   SÉLECTION MODÈLE / FORMAT
   ============================================================ */

export function selectModel(model, btn) {
  currentModel = model;

  document.querySelectorAll('#model-group .option-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const body = document.getElementById('badge-body');
  const photoGroup = document.getElementById('photo-input-group');
  const brandGroup = document.getElementById('brand-vendor-group');

  if (!body) return;

  // ─── RE-CONSTRUCTION COMPLÈTE DU BODY ───
  const photoSrc = currentPhotoSrc || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='130'%3E%3Crect fill='%23bbdefb' width='100' height='130'/%3E%3Ctext x='50' y='70' text-anchor='middle' fill='%230d47a1' font-size='12'%3EPHOTO%3C/text%3E%3C/svg%3E";

  if (model === 'with-photo') {
    body.className = 'badge-body-with-photo';
    body.innerHTML = `
      <div class="photo-area">
        <img id="preview-img" class="preview-img" src="${photoSrc}">
      </div>
      <div class="info-area">
        <div class="info-name" id="preview-name">NOM PRÉNOM</div>
        <div class="info-sub" id="preview-role">Fonction</div>
        <div class="info-detail"><strong>ID:</strong> <span id="preview-badge-id">---</span><br><strong>Expire:</strong> <span id="preview-date">--/--/----</span></div>
      </div>`;
    if (photoGroup) photoGroup.style.display = 'block';
    if (brandGroup) brandGroup.style.display = 'none';
  } else if (model === 'no-photo') {
    body.className = 'badge-body-no-photo';
    body.innerHTML = `
      <div class="info-area">
        <div class="info-name" id="preview-name">NOM PRÉNOM</div>
        <div class="info-sub" id="preview-role">Fonction</div>
        <div class="info-detail"><strong>ID:</strong> <span id="preview-badge-id">---</span><br><strong>Expire:</strong> <span id="preview-date">--/--/----</span></div>
      </div>`;
    if (photoGroup) photoGroup.style.display = 'none';
    if (brandGroup) brandGroup.style.display = 'none';
  } else if (model === 'brand-vendor') {
    const brandLogo = currentBrandLogoSrc
      ? `<img src="${currentBrandLogoSrc}">`
      : '<span class="brand-logo-placeholder">🏷️</span>';

    body.className = 'badge-body-brand';
    body.innerHTML = `
      <div class="brand-logo-area" id="brand-preview-area">${brandLogo}</div>
      <div class="info-area">
        <div class="brand-tag" id="preview-brand-tag">★ Vendeur Marque ★</div>
        <div class="info-name" id="preview-name">NOM PRÉNOM</div>
        <div class="info-sub" id="preview-role">Fonction</div>
        <div class="info-detail"><strong>ID:</strong> <span id="preview-badge-id">---</span><br><strong class="lbl-brand">MARQUE:</strong> <span id="preview-brand-name">—</span></div>
      </div>`;
    if (photoGroup) photoGroup.style.display = 'none';
    if (brandGroup) brandGroup.style.display = 'block';
  }

  updateBadgePreview();
}

export function selectFormat(fmt, btn) {
  currentFormat = fmt;

  document.querySelectorAll('#format-group .option-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const badge = document.getElementById('badge-preview');
  if (!badge) return;

  badge.classList.remove(
    'badge-cr80', 'badge-cr79', 'badge-cr100',
    'badge-custom85x90', 'badge-custom', 'badge-compact'
  );
  badge.classList.add('badge-' + fmt);

  const customPanel = document.getElementById('custom-size-inputs');
  if (customPanel) customPanel.style.display = (fmt === 'custom') ? 'block' : 'none';

  const compactPanel = document.getElementById('compact-size-inputs');
  if (compactPanel) compactPanel.style.display = (fmt === 'compact') ? 'block' : 'none';

  if (fmt === 'custom') applyCustomSize();
  if (fmt === 'compact') applyCompactSize();

  updateFormatDisplay();
}

function updateFormatDisplay() {
  const labels = {
    cr80: 'CR80', cr79: 'CR79', cr100: 'CR100',
    custom85x90: '8.5×9cm',
    custom: `Personnalisé ${customWidthMm}×${customHeightMm}mm`,
    compact: `Compact ${compactWidthMm}×${compactHeightMm}mm`
  };
  const modelLabels = {
    'with-photo': 'Avec Photo',
    'no-photo': 'Sans Photo',
    'brand-vendor': 'Vendeur Marque'
  };
  const el = document.getElementById('format-display');
  if (el) el.textContent = `${labels[currentFormat] || currentFormat} · ${modelLabels[currentModel] || currentModel}`;
}

/* ============================================================
   TAILLES COMPACT / CUSTOM
   ============================================================ */

function clampMm(v, min, max, def) {
  const n = parseFloat(v);
  if (isNaN(n)) return def;
  return Math.round(Math.min(max, Math.max(min, n)) * 10) / 10;
}

function handleCompactSlider(e) {
  const id = e.target.id;
  if (id === 'compact-width-range') {
    compactWidthMm = parseFloat(e.target.value);
    const n = document.getElementById('compact-width-mm');
    if (n) n.value = compactWidthMm;
  } else {
    compactHeightMm = parseFloat(e.target.value);
    const n = document.getElementById('compact-height-mm');
    if (n) n.value = compactHeightMm;
  }
  applyCompactSize();
}

function handleCompactNumber(e) {
  const id = e.target.id;
  if (id === 'compact-width-mm') {
    compactWidthMm = clampMm(e.target.value, COMPACT_LIMITS.wMin, COMPACT_LIMITS.wMax, 75);
    const r = document.getElementById('compact-width-range');
    if (r) r.value = compactWidthMm;
  } else {
    compactHeightMm = clampMm(e.target.value, COMPACT_LIMITS.hMin, COMPACT_LIMITS.hMax, 30);
    const r = document.getElementById('compact-height-range');
    if (r) r.value = compactHeightMm;
  }
  applyCompactSize();
}

function applyCompactSize() {
  document.documentElement.style.setProperty('--compact-badge-w', mmToPx(compactWidthMm) + 'px');
  document.documentElement.style.setProperty('--compact-badge-h', mmToPx(compactHeightMm) + 'px');

  const d = document.getElementById('compact-size-display');
  if (d) d.textContent = `${compactWidthMm} × ${compactHeightMm} mm`;

  updateFormatDisplay();
}

function applyCustomSize() {
  const w = parseFloat(document.getElementById('custom-width-mm')?.value) || 85;
  const h = parseFloat(document.getElementById('custom-height-mm')?.value) || 54;

  customWidthMm = w;
  customHeightMm = h;

  document.documentElement.style.setProperty('--custom-badge-w', mmToPx(w) + 'px');
  document.documentElement.style.setProperty('--custom-badge-h', mmToPx(h) + 'px');

  const d = document.getElementById('custom-size-display');
  if (d) d.textContent = `${w} × ${h} mm`;

  updateFormatDisplay();
}

/* ============================================================
   APERÇU LIVE
   ============================================================ */

export function updateBadgePreview() {
  const org   = document.getElementById('badge-org')?.value || 'ORGANISATION';
  const name  = document.getElementById('badge-name')?.value || 'NOM PRÉNOM';
  const role  = document.getElementById('badge-role')?.value || 'Fonction';
  const id    = document.getElementById('badge-id')?.value || '---';
  const date  = document.getElementById('badge-date')?.value || '--/--/----';
  const brandName = document.getElementById('badge-brand-name')?.value || '';

  // Texte
  setText('preview-org', org);
  setText('preview-name', name);
  setText('preview-role', role);
  setText('preview-badge-id', id);
  setText('preview-date', date);
  setText('preview-brand-name', brandName || '—');
  setText('preview-brand-tag', `★ Vendeur Marque ${brandName} ★`);

  // Photo
  const img = document.getElementById('preview-img');
  if (img && currentModel === 'with-photo') {
    img.src = currentPhotoSrc || 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'130\'%3E%3Crect fill=\'%23bbdefb\' width=\'100\' height=\'130\'/%3E%3Ctext x=\'50\' y=\'70\' text-anchor=\'middle\' fill=\'%230d47a1\' font-size=\'12\'%3EPHOTO%3C/text%3E%3C/svg%3E';
  }

  // Logo marque (mode brand-vendor)
  if (currentModel === 'brand-vendor') {
    const area = document.getElementById('brand-preview-area');
    if (area) {
      area.innerHTML = currentBrandLogoSrc
        ? `<img src="${currentBrandLogoSrc}">`
        : '<span class="brand-logo-placeholder">🏷️</span>';
    }
  }

  // Bannière vide
  const badge = document.getElementById('badge-preview');
  const emptyRibbon = document.getElementById('badge-empty-ribbon');
  if (badge && emptyRibbon) {
    badge.classList.toggle('badge-ribbon-empty', emptyRibbon.checked);
  }

  // QR
  const qrDiv = document.getElementById('preview-qr');
  if (qrDiv) {
    qrDiv.innerHTML = '';
    const qrText = `ORG:${org}|NOM:${name}|ROLE:${role}|ID:${id}|EXP:${date}${brandName ? '|MARQUE:' + brandName : ''}`;

    import('qrcode').then(({ default: QRCode }) => {
      QRCode.toCanvas(qrText || 'BADGE', { width: 60, margin: 0, color: { dark: '#0d47a1', light: '#ffffff' } }, (err, canvas) => {
        if (err) return;
        qrDiv.innerHTML = '';
        qrDiv.appendChild(canvas);
        canvas.style.width = '100%';
        canvas.style.height = '100%';
      });
    }).catch(err => console.warn('QR module:', err));
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ============================================================
   UPLOAD PHOTO / LOGO / LOGO MARQUE
   ============================================================ */

async function handlePhotoUpload(event, target) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressImage(dataUrl, 400, 520, 0.8);

    currentPhotoSrc = compressed;
    applyPhotoToPreview(compressed);

    const thumb = document.getElementById('photo-preview-thumb');
    if (thumb) { thumb.src = compressed; thumb.classList.add('visible'); }

    setText('photo-status', '✅ Photo chargée');
    const clearBtn = document.getElementById('clear-photo-btn');
    if (clearBtn) clearBtn.style.display = 'inline-flex';

    updateBadgePreview();
    showToast('Photo chargée ✅');
  } catch (err) {
    console.error('[badge] photo upload:', err);
    showToast('Erreur chargement photo', 'error');
  }
}

function applyPhotoToPreview(src) {
  const img = document.getElementById('preview-img');
  if (img) img.src = src;
}

async function handleLogoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressLogo(dataUrl, 300);

    currentLogoSrc = compressed;

    const lp = document.getElementById('logo-preview');
    if (lp) lp.innerHTML = `<img src="${compressed}">`;

    const rl = document.getElementById('ribbon-logo');
    if (rl) rl.innerHTML = `<img src="${compressed}">`;

    showToast('Logo chargé ✅');
  } catch (err) {
    console.error('[badge] logo upload:', err);
    showToast('Erreur chargement logo', 'error');
  }
}

async function handleBrandLogoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressImage(dataUrl, 300, 300, 0.85);

    currentBrandLogoSrc = compressed;

    const prev = document.getElementById('brand-logo-preview');
    if (prev) prev.innerHTML = `<img src="${compressed}" style="width:100%;height:100%;object-fit:contain;">`;

    updateBadgePreview();
    showToast('Logo marque chargé ✅');
  } catch (err) {
    console.error('[badge] brand logo upload:', err);
    showToast('Erreur chargement logo marque', 'error');
  }
}

export function clearPhoto() {
  currentPhotoSrc = '';
  const thumb = document.getElementById('photo-preview-thumb');
  if (thumb) thumb.classList.remove('visible');

  setText('photo-status', 'Aucune photo sélectionnée');
  const clearBtn = document.getElementById('clear-photo-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const img = document.getElementById('preview-img');
  if (img) img.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'130\'%3E%3Crect fill=\'%23bbdefb\' width=\'100\' height=\'130\'/%3E%3Ctext x=\'50\' y=\'70\' text-anchor=\'middle\' fill=\'%230d47a1\' font-size=\'12\'%3EPHOTO%3C/text%3E%3C/svg%3E';

  updateBadgePreview();
}

export function clearBrandLogo() {
  currentBrandLogoSrc = '';
  const prev = document.getElementById('brand-logo-preview');
  if (prev) prev.innerHTML = '<span style="font-size:1.4rem;opacity:0.3;">🏷️</span>';
  updateBadgePreview();
}

/* ============================================================
   CAMÉRA
   ============================================================ */

export async function openCamera(target) {
  cameraTarget = target;

  if (!navigator.mediaDevices?.getUserMedia) {
    showToast('Caméra non supportée', 'error');
    return;
  }

  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: cameraFacingMode, width: 1280, height: 720 }
    });

    const video = document.getElementById('camera-video');
    if (video) video.srcObject = cameraStream;

    modal.open('camera-modal');
  } catch (err) {
    console.error('[camera]', err);
    showToast('Erreur caméra — vérifiez les permissions', 'error');
  }
}

export function closeCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  modal.close('camera-modal');
}

export async function takeSnapshot() {
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('camera-canvas');
  if (!video || !canvas) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
  const compressed = await compressImage(dataUrl, 400, 520, 0.8);

  currentPhotoSrc = compressed;
  applyPhotoToPreview(compressed);

  const thumb = document.getElementById('photo-preview-thumb');
  if (thumb) { thumb.src = compressed; thumb.classList.add('visible'); }

  setText('photo-status', '✅ Photo prise');
  const clearBtn = document.getElementById('clear-photo-btn');
  if (clearBtn) clearBtn.style.display = 'inline-flex';

  closeCamera();
  updateBadgePreview();
  showToast('Photo prise ✅');
}

export function switchCamera() {
  cameraFacingMode = cameraFacingMode === 'user' ? 'environment' : 'user';
  openCamera(cameraTarget);
}

/* ============================================================
   SAUVEGARDE
   ============================================================ */

export async function saveBadge() {
  const nameEl = document.getElementById('badge-name');
  const name = (nameEl?.value || '').trim();

  if (!name) {
    showToast('Nom requis', 'error');
    nameEl?.focus();
    return;
  }

  const data = {
    eventId: parseInt(document.getElementById('badge-event')?.value) || null,
    org: document.getElementById('badge-org')?.value.trim() || 'Sans organisation',
    name,
    role: document.getElementById('badge-role')?.value.trim() || '',
    badgeId: document.getElementById('badge-id')?.value.trim() || 'AUTO-' + Date.now(),
    date: document.getElementById('badge-date')?.value || '',
    showDate: document.getElementById('badge-show-date')?.checked !== false,
    emptyRibbon: !!document.getElementById('badge-empty-ribbon')?.checked,
    photo: currentPhotoSrc,
    logo: currentLogoSrc,
    brandLogo: currentBrandLogoSrc,
    brandName: document.getElementById('badge-brand-name')?.value.trim() || '',
    format: currentFormat,
    model: currentModel,
    customW: currentFormat === 'custom' ? customWidthMm : (currentFormat === 'compact' ? compactWidthMm : null),
    customH: currentFormat === 'custom' ? customHeightMm : (currentFormat === 'compact' ? compactHeightMm : null),
    createdAt: new Date().toISOString()
  };

  try {
    if (editingId) {
      data.id = editingId;
      await store.put('badges', data);
      showToast('Badge modifié ✅');
    } else {
      await store.add('badges', data);
      showToast('Badge créé ✅');
    }

    editingId = null;
    resetBadgeForm();
    document.dispatchEvent(new CustomEvent('data:refresh'));
  } catch (err) {
    console.error('[badge] saveBadge:', err);
    showToast('Erreur enregistrement : ' + err.message, 'error');
  }
}

export async function editBadge(id) {
  try {
    const b = await store.get('badges', id);
    if (!b) { showToast('Badge introuvable', 'error'); return; }

    editingId = id;
    currentPhotoSrc = b.photo || '';
    currentLogoSrc = b.logo || '';
    currentBrandLogoSrc = b.brandLogo || '';

    setValue('badge-event', b.eventId || '');
    setValue('badge-org', b.org || '');
    setValue('badge-name', b.name || '');
    setValue('badge-role', b.role || '');
    setValue('badge-id', b.badgeId || '');
    setValue('badge-date', b.date || '');
    setValue('badge-brand-name', b.brandName || '');

    const showDateEl = document.getElementById('badge-show-date');
    if (showDateEl) showDateEl.checked = b.showDate !== false;

    const emptyRibbonEl = document.getElementById('badge-empty-ribbon');
    if (emptyRibbonEl) emptyRibbonEl.checked = !!b.emptyRibbon;

    // Modèle
    const modelBtn = document.querySelector(`#model-group [data-model="${b.model || 'with-photo'}"]`);
    selectModel(b.model || 'with-photo', modelBtn);

    // Format
    const formatBtn = document.querySelector(`#format-group [data-format="${b.format || 'cr80'}"]`);
    selectFormat(b.format || 'cr80', formatBtn);

    // Photo
    if (b.photo) {
      const thumb = document.getElementById('photo-preview-thumb');
      if (thumb) { thumb.src = b.photo; thumb.classList.add('visible'); }
      setText('photo-status', '✅ Photo chargée');
      const clearBtn = document.getElementById('clear-photo-btn');
      if (clearBtn) clearBtn.style.display = 'inline-flex';
    }

    // Logo
    if (b.logo) {
      const lp = document.getElementById('logo-preview');
      if (lp) lp.innerHTML = `<img src="${b.logo}">`;
      const rl = document.getElementById('ribbon-logo');
      if (rl) rl.innerHTML = `<img src="${b.logo}">`;
    }

    // Logo marque
    if (b.brandLogo) {
      const prev = document.getElementById('brand-logo-preview');
      if (prev) prev.innerHTML = `<img src="${b.brandLogo}" style="width:100%;height:100%;object-fit:contain;">`;
    }

    updateBadgePreview();
    window.location.hash = 'create-badge';
  } catch (err) {
    console.error('[badge] editBadge:', err);
    showToast('Erreur chargement badge', 'error');
  }
}

export function resetBadgeForm() {
  editingId = null;
  currentPhotoSrc = '';
  currentLogoSrc = '';
  currentBrandLogoSrc = '';
  currentModel = 'with-photo';
  currentFormat = 'cr80';

  ['badge-name', 'badge-role', 'badge-id', 'badge-date', 'badge-brand-name', 'badge-org']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  const showDateEl = document.getElementById('badge-show-date');
  if (showDateEl) showDateEl.checked = true;

  const emptyRibbonEl = document.getElementById('badge-empty-ribbon');
  if (emptyRibbonEl) emptyRibbonEl.checked = false;

  // Reset previews
  const photoThumb = document.getElementById('photo-preview-thumb');
  if (photoThumb) photoThumb.classList.remove('visible');

  setText('photo-status', 'Aucune photo sélectionnée');
  const clearBtn = document.getElementById('clear-photo-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  const lp = document.getElementById('logo-preview');
  if (lp) lp.innerHTML = '<span>Logo</span>';

  const rl = document.getElementById('ribbon-logo');
  if (rl) rl.innerHTML = '<span class="badge-logo-placeholder">🏢</span>';

  const blp = document.getElementById('brand-logo-preview');
  if (blp) blp.innerHTML = '<span style="font-size:1.4rem;opacity:0.3;">🏷️</span>';

  const cp = document.getElementById('custom-size-inputs');
  if (cp) cp.style.display = 'none';

  const comp = document.getElementById('compact-size-inputs');
  if (comp) comp.style.display = 'none';

  const modelBtn = document.querySelector('#model-group [data-model="with-photo"]');
  selectModel('with-photo', modelBtn);

  const formatBtn = document.querySelector('#format-group [data-format="cr80"]');
  selectFormat('cr80', formatBtn);

  updateBadgePreview();
}

export async function downloadBadge() {
  try {
    const target = document.getElementById('badge-preview');
    if (!target) return;

    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(target, { scale: 3, backgroundColor: '#fff' });

    const a = document.createElement('a');
    a.download = 'badge.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('PNG généré ✅');
  } catch (err) {
    console.error('[badge] downloadBadge:', err);
    showToast('Erreur génération PNG', 'error');
  }
}

/* ============================================================
   UPLOAD DE FICHIERS — Listener direct (mode capture)
   ============================================================ */

function attachFileInput(zoneSelector, inputId) {
  const zone = document.querySelector(zoneSelector);
  const input = document.getElementById(inputId);

  if (!zone || !input) {
    console.warn(`[badge] attachFileInput échoué : "${zoneSelector}" ou "#${inputId}" introuvable`);
    return;
  }

  // Clic direct sur la zone → ouvre le sélecteur de fichiers
  zone.addEventListener('click', (e) => {
    // Évite la boucle infinie : si le clic vient de l'input lui-même
    if (e.target === input) return;

    // Stoppe la propagation AVANT que la délégation data-action ne s'en mêle
    e.stopPropagation();
    e.preventDefault();

    input.click();
  }, true); // ← mode capture : on intercepte avant les autres handlers

  console.log(`✅ [badge] Upload lié : "${zoneSelector}" → #${inputId}`);
}

/* ============================================================
   HELPERS
   ============================================================ */

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/* ============================================================
   API PUBLIQUE
   ============================================================ */

export const badgeAPI = {
  init: initBadgePreview,
  selectModel,
  selectFormat,
  updatePreview: updateBadgePreview,
  save: saveBadge,
  edit: editBadge,
  reset: resetBadgeForm,
  downloadPNG: downloadBadge,
  openCamera,
  closeCamera,
  takeSnapshot,
  switchCamera,
  clearPhoto,
  clearBrandLogo
};
