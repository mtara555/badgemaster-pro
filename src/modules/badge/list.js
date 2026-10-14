/**
 * ============================================================
 *  BADGEMASTER PRO — Liste des badges
 * ============================================================
 *  Page "Tous les badges" :
 *   - Recherche + filtres (événement, recherche texte)
 *   - Sélection multiple
 *   - Suppression individuelle et groupée
 *   - Impression A4 (grille 2 col)
 *   - Export PDF
 * ============================================================
 */

import { store }       from '../db/idb.js';
import { showToast }   from '../ui/toast.js';
import { showConfirm } from '../ui/confirm.js';
import { escapeHTML }  from '../ui/util.js';

/* ============================================================
   ÉTAT
   ============================================================ */
const selectedBadges = new Set();

/* ============================================================
   CHARGEMENT & RENDU
   ============================================================ */

export async function loadAllBadges() {
  try {
    const [badges, events] = await Promise.all([
      store.getAll('badges'),
      store.getAll('events')
    ]);

    const evtMap = {};
    events.forEach(e => evtMap[e.id] = e.name);

    // Filtre événement
    const filterEvent = document.getElementById('filter-event')?.value;
    let filtered = badges;

    if (filterEvent) {
      filtered = filtered.filter(b => b.eventId === parseInt(filterEvent));
    }

    // Filtre recherche
    const search = (document.getElementById('search-badges')?.value || '').toLowerCase();
    if (search) {
      filtered = filtered.filter(b =>
        (b.name || '').toLowerCase().includes(search) ||
        (b.org || '').toLowerCase().includes(search) ||
        (b.badgeId || '').toLowerCase().includes(search)
      );
    }

    // Tri récent
    filtered.sort((a, b) =>
      new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    );

    updateCounts(filtered.length);
    renderBadgeList(filtered, evtMap);
    populateEventFilter(events);
  } catch (err) {
    console.error('[badge/list] loadAllBadges:', err);
  }
}

function updateCounts(count) {
  setText('all-badges-count', count);
  setText('badges-count', count);

  const bnBadges = document.getElementById('bn-badges-count');
  if (bnBadges) {
    bnBadges.textContent = count;
    bnBadges.style.display = count > 0 ? 'block' : 'none';
  }
}

function populateEventFilter(events) {
  const sel = document.getElementById('filter-event');
  if (!sel) return;

  const current = sel.value;
  sel.innerHTML = '<option value="">Tous les événements</option>';
  events.forEach(ev => {
    sel.innerHTML += `<option value="${ev.id}">${escapeHTML(ev.name)}</option>`;
  });
  if (current) sel.value = current;
}

function renderBadgeList(badges, evtMap) {
  const cont = document.getElementById('all-badges-list');
  if (!cont) return;

  if (!badges.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏷</div>
        <div class="empty-title">Aucun badge trouvé</div>
        <div class="empty-desc">Créez un badge manuellement ou importez un fichier Excel.</div>
        <div class="btn-group" style="justify-content:center;">
          <button class="btn btn-primary btn-sm" data-page="create-badge">+ Nouveau badge</button>
          <button class="btn btn-ghost btn-sm" data-page="import-excel">📊 Import Excel</button>
        </div>
      </div>`;
    return;
  }

  cont.innerHTML = badges.map(b => renderBadgeItem(b, evtMap)).join('');
}

function renderBadgeItem(b, evtMap) {
  const isSelected = selectedBadges.has(b.id);

  // Thumbnail : photo ou logo marque
  let thumb;
  if (b.model === 'brand-vendor' && b.brandLogo) {
    thumb = `<img src="${escapeHTML(b.brandLogo)}" style="background:white;padding:2px;">`;
  } else if (b.photo) {
    thumb = `<img src="${escapeHTML(b.photo)}">`;
  } else {
    thumb = `<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='50' height='65'%3E%3Crect fill='%23263756' width='50' height='65'/%3E%3Ctext x='25' y='36' text-anchor='middle' fill='%234f74ff' font-size='8'%3EPHOTO%3C/text%3E%3C/svg%3E">`;
  }

  const modelTag = b.model === 'brand-vendor'
    ? ` 🏷️ ${escapeHTML(b.brandName || 'Marque')}`
    : '';

  const eventName = b.eventId && evtMap[b.eventId] ? ` · 🎪 ${escapeHTML(evtMap[b.eventId])}` : '';

  return `
    <div class="badge-list-item ${isSelected ? 'selected' : ''}">
      <input type="checkbox" ${isSelected ? 'checked' : ''}
             data-action="badge-toggle-select" data-id="${b.id}">
      ${thumb}
      <div class="info">
        <div class="name">${escapeHTML(b.name || '')}${modelTag}</div>
        <div class="meta">${escapeHTML(b.role || '')} · ${escapeHTML(b.org || '')}${eventName}</div>
      </div>
      <div class="actions">
        <button class="btn btn-info btn-sm btn-icon"
                data-action="badge-edit" data-id="${b.id}"
                title="Modifier">✏️</button>
        <button class="btn btn-danger btn-sm btn-icon"
                data-action="badge-delete" data-id="${b.id}"
                title="Supprimer">🗑️</button>
      </div>
    </div>`;
}

/* ============================================================
   SÉLECTION
   ============================================================ */

export function toggleSelect(id) {
  if (selectedBadges.has(id)) selectedBadges.delete(id);
  else selectedBadges.add(id);
  loadAllBadges();
}

export async function selectAllBadges() {
  try {
    const badges = await store.getAll('badges');
    badges.forEach(b => selectedBadges.add(b.id));
    loadAllBadges();
    showToast(`${badges.length} badge(s) sélectionné(s)`, 'info');
  } catch (err) {
    console.error('[badge/list] selectAll:', err);
  }
}

/* ============================================================
   SUPPRESSION
   ============================================================ */

export async function deleteBadge(id) {
  const ok = await showConfirm({
    title: 'Supprimer ce badge ?',
    message: 'Le badge sera définitivement supprimé.',
    okText: 'Supprimer', type: 'danger', icon: '🏷'
  });
  if (!ok) return;

  try {
    await store.delete('badges', id);
    showToast('Badge supprimé');
    await loadAllBadges();
    document.dispatchEvent(new CustomEvent('data:refresh'));
  } catch (err) {
    console.error('[badge/list] deleteBadge:', err);
  }
}

export async function deleteSelectedBadges() {
  if (!selectedBadges.size) {
    showToast('Aucun badge sélectionné', 'info');
    return;
  }

  const ok = await showConfirm({
    title: `Supprimer ${selectedBadges.size} badge(s) ?`,
    message: 'Cette action est irréversible.',
    okText: 'Supprimer', type: 'danger', icon: '🏷'
  });
  if (!ok) return;

  try {
    for (const id of selectedBadges) {
      await store.delete('badges', id);
    }
    const count = selectedBadges.size;
    selectedBadges.clear();
    showToast(`${count} badge(s) supprimé(s)`);
    await loadAllBadges();
    document.dispatchEvent(new CustomEvent('data:refresh'));
  } catch (err) {
    console.error('[badge/list] deleteSelected:', err);
  }
}

/* ============================================================
   IMPRESSION A4
   ============================================================ */

export async function openPrintModal(mode = 'print') {
  if (!selectedBadges.size) {
    showToast("Sélectionnez des badges d'abord", "info");
    return;
  }

  try {
    const badges = [];
    for (const id of selectedBadges) {
      const b = await store.get('badges', id);
      if (b) badges.push(b);
    }

    const modal = document.getElementById('print-modal');
    if (modal) modal.classList.add('show');

    const countEl = document.getElementById('print-badge-count');
    if (countEl) countEl.textContent = `${badges.length} badge(s) sélectionné(s)`;

    await generatePrintContent(badges);

    if (mode === 'pdf') {
      // Petit délai pour laisser le QR se générer
      setTimeout(() => exportBadgesPDF(), 800);
    }
  } catch (err) {
    console.error('[badge/list] openPrintModal:', err);
  }
}

async function generatePrintContent(badges) {
  const content = document.getElementById('print-content');
  if (!content) return;

  content.innerHTML = '';

  const perPage = parseInt(document.getElementById('badges-per-page')?.value) || 6;
  const individualQR = document.getElementById('individual-qr-check')?.checked || false;

  for (let p = 0; p < Math.ceil(badges.length / perPage); p++) {
    const page = document.createElement('div');
    page.className = 'a4-page';

    const grid = document.createElement('div');
    grid.className = 'badges-grid';

    for (let i = p * perPage; i < Math.min((p + 1) * perPage, badges.length); i++) {
      grid.innerHTML += createPrintBadgeHTML(badges[i], i);
    }

    page.appendChild(grid);
    content.appendChild(page);
  }

  // Générer les QR après le rendu
  setTimeout(() => generatePrintQRs(badges, individualQR), 100);
}

function createPrintBadgeHTML(badge, idx) {
  const fmt = 'badge-' + (badge.format || 'cr80');
  const isBrand = badge.model === 'brand-vendor';

  const logo = badge.logo
    ? `<div class="badge-logo"><img src="${badge.logo}"></div>`
    : `<div class="badge-logo"><span class="badge-logo-placeholder">${escapeHTML((badge.org || '?').charAt(0).toUpperCase())}</span></div>`;

  const expStr = badge.showDate === false ? '' :
    `<br><strong>Expire:</strong> ${escapeHTML(badge.date || 'N/A')}`;

  let body;
  if (isBrand) {
    const brandImg = badge.brandLogo
      ? `<img src="${badge.brandLogo}">`
      : '<span class="brand-logo-placeholder">🏷️</span>';

    body = `
      <div class="badge-body-brand">
        <div class="brand-logo-area">${brandImg}</div>
        <div class="info-area">
          <div class="brand-tag">★ Vendeur Marque ${escapeHTML(badge.brandName || '')} ★</div>
          <div class="info-name">${escapeHTML(badge.name)}</div>
          <div class="info-sub">${escapeHTML(badge.role)}</div>
          <div class="info-detail">
            <strong>ID:</strong> ${escapeHTML(badge.badgeId)}${expStr}<br>
            <strong>MARQUE:</strong> ${escapeHTML(badge.brandName || '—')}
          </div>
        </div>
      </div>`;
  } else if (badge.model === 'with-photo') {
    const photoSrc = badge.photo || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='130'%3E%3Crect fill='%23bbdefb' width='100' height='130'/%3E%3Ctext x='50' y='70' text-anchor='middle' fill='%230d47a1' font-size='12'%3EPHOTO%3C/text%3E%3C/svg%3E";
    body = `
      <div class="badge-body-with-photo">
        <div class="photo-area"><img src="${photoSrc}"></div>
        <div class="info-area">
          <div class="info-name">${escapeHTML(badge.name)}</div>
          <div class="info-sub">${escapeHTML(badge.role)}</div>
          <div class="info-detail"><strong>ID:</strong> ${escapeHTML(badge.badgeId)}${expStr}</div>
        </div>
      </div>`;
  } else {
    body = `
      <div class="badge-body-no-photo">
        <div class="info-area">
          <div class="info-name">${escapeHTML(badge.name)}</div>
          <div class="info-sub">${escapeHTML(badge.role)}</div>
          <div class="info-detail"><strong>ID:</strong> ${escapeHTML(badge.badgeId)}${expStr}</div>
        </div>
      </div>`;
  }

  return `
    <div class="badge-template ${fmt}${isBrand ? ' badge-brand-model' : ''}${badge.emptyRibbon ? ' badge-ribbon-empty' : ''}">
      <div class="badge-top-banner">À VOTRE SERVICE</div>
      <div class="badge-ribbon">
        <div class="badge-ribbon-content">
          ${logo}
          <div class="badge-org-name">${escapeHTML(badge.org)}</div>
        </div>
      </div>
      ${body}
      <div class="qr-area" id="pqr-${idx}"></div>
    </div>`;
}

async function generatePrintQRs(badges, individual) {
  try {
    const { default: QRCode } = await import('qrcode');

    for (let i = 0; i < badges.length; i++) {
      const div = document.getElementById(`pqr-${i}`);
      if (!div) continue;

      const b = badges[i];
      let text;

      if (individual) {
        text = `ORG:${b.org}|NOM:${b.name}|ROLE:${b.role}|ID:${b.badgeId}`;
      } else {
        // QR par groupe de 5
        if (i % 5 !== 0) {
          div.innerHTML = `<div class="qr-message">QR groupe ${Math.floor(i / 5) + 1}</div>`;
          continue;
        }
        const group = badges.slice(i, i + 5)
          .map(x => `ORG:${x.org}|NOM:${x.name}|ID:${x.badgeId}`)
          .join('||');
        text = group;
      }

      div.innerHTML = '';
      const canvas = document.createElement('canvas');
      await QRCode.toCanvas(canvas, text || 'BADGE', { width: 60, margin: 0, color: { dark: '#0d47a1', light: '#fff' } });
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      div.appendChild(canvas);
    }
  } catch (err) {
    console.warn('[badge/list] QR gen:', err);
  }
}

/* ============================================================
   EXPORT PDF
   ============================================================ */

export async function exportBadgesPDF() {
  const pages = document.querySelectorAll('#print-content .a4-page');
  if (!pages.length) { showToast('Rien à exporter', 'error'); return; }

  try {
    showToast('Génération PDF… ⏳', 'info', 2000);

    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    for (let i = 0; i < pages.length; i++) {
      const canvas = await html2canvas(pages[i], {
        scale: 3,
        backgroundColor: '#fff',
        useCORS: true,
        imageTimeout: 0
      });

      if (i > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', 0, 0, 210, 297);
    }

    pdf.save(`badges-${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('PDF exporté ✅');
  } catch (err) {
    console.error('[badge/list] exportPDF:', err);
    showToast('Erreur PDF', 'error');
  }
}

/* ============================================================
   HELPERS
   ============================================================ */

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ============================================================
   API
   ============================================================ */

export const badgeListAPI = {
  load: loadAllBadges,
  toggleSelect,
  selectAll: selectAllBadges,
  remove: deleteBadge,
  removeSelected: deleteSelectedBadges,
  openPrint: openPrintModal,
  exportPDF: exportBadgesPDF
};
