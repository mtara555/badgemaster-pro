/**
 * ============================================================
 *  BADGEMASTER PRO — Module Événements
 *  ============================================================
 *  Gestion complète :
 *   - Liste + cartes d'événements
 *   - Création / modification / suppression
 *   - Alimentation des selects "Événement" partout
 *   - Compteurs de badges associés
 * ============================================================
 */

import { store }       from '../db/idb.js';
import { showToast }   from '../ui/toast.js';
import { showConfirm } from '../ui/confirm.js';
import { modal }       from '../ui/modal.js';
import { escapeHTML }  from '../ui/util.js';

/* ============================================================
   CONSTANTES
   ============================================================ */
const MODAL_NEW    = 'event-modal';
const MODAL_EDIT   = 'edit-event-modal';

let editingId = null;

/* ============================================================
   LISTE & RENDU
   ============================================================ */

/**
 * Charge tous les événements + compte les badges associés.
 */
export async function loadEvents() {
  try {
    const [events, badges] = await Promise.all([
      store.getAll('events'),
      store.getAll('badges')
    ]);

    const counts = {};
    badges.forEach(b => {
      if (b.eventId) counts[b.eventId] = (counts[b.eventId] || 0) + 1;
    });

    renderEvents(events, counts);
    populateEventSelectors(events);
    updateEventCounters(events);
  } catch (err) {
    console.error('[events] loadEvents:', err);
  }
}

/**
 * Affiche les événements sur la page + les 3 derniers sur le dashboard.
 */
function renderEvents(events, counts) {
  const container = document.getElementById('events-list');
  const dash      = document.getElementById('dashboard-events');

  if (!events.length) {
    const empty = `
      <div class="empty-state">
        <div class="empty-icon">🎪</div>
        <div class="empty-title">Aucun événement</div>
        <div class="empty-desc">Créez votre premier événement pour commencer à générer des badges.</div>
        <button class="btn btn-accent btn-sm" data-action="event-open">+ Créer le premier événement</button>
      </div>`;
    if (container) container.innerHTML = empty;
    if (dash) dash.innerHTML = empty;
    return;
  }

  // Tri décroissant par date de création
  const sorted = [...events].sort((a, b) =>
    new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  );

  // Liste complète
  if (container) {
    container.innerHTML = sorted.map(ev => renderEventCard(ev, counts[ev.id] || 0)).join('');
  }

  // 3 derniers pour le dashboard
  if (dash) {
    dash.innerHTML = sorted.slice(0, 3).map(ev => `
      <div class="event-card">
        <div class="event-icon">🎪</div>
        <div class="event-info">
          <div class="event-name">${escapeHTML(ev.name)}</div>
          <div class="event-meta">${escapeHTML(ev.location || '—')} · ${escapeHTML(ev.org || '—')}</div>
        </div>
      </div>`).join('');
  }
}

/**
 * Construit une carte événement.
 */
function renderEventCard(ev, badgeCount) {
  const status = getEventStatus(ev.date);
  const statusChip = status
    ? `<span class="chip" style="background:${status.bg};color:${status.color};border-color:${status.border};">${status.label}</span>`
    : '';

  return `
    <div class="event-card">
      <div class="event-icon">🎪</div>
      <div class="event-info">
        <div class="event-name">
          ${escapeHTML(ev.name)}
          ${statusChip}
        </div>
        <div class="event-meta">
          ${ev.date ? `📅 ${formatDate(ev.date)} · ` : ''}
          ${escapeHTML(ev.location || '—')}
          ${ev.org ? ` · 🏢 ${escapeHTML(ev.org)}` : ''}
        </div>
        <div style="margin-top:8px;">
          <span class="chip chip-green">${badgeCount} badge${badgeCount > 1 ? 's' : ''}</span>
        </div>
      </div>
      <div class="event-actions">
        <button class="btn btn-info btn-sm btn-icon"
                data-action="event-create-badge" data-id="${ev.id}"
                title="Créer un badge pour cet événement">✏️</button>
        <button class="btn btn-accent btn-sm btn-icon"
                data-action="event-import" data-id="${ev.id}"
                title="Importer Excel pour cet événement">📊</button>
        <button class="btn btn-ghost btn-sm btn-icon"
                data-action="event-edit" data-id="${ev.id}"
                title="Modifier">⚙️</button>
        <button class="btn btn-danger btn-sm btn-icon"
                data-action="event-delete" data-id="${ev.id}"
                title="Supprimer">🗑️</button>
      </div>
    </div>
  `;
}

/**
 * Retourne un statut visuel selon la date.
 */
function getEventStatus(dateStr) {
  if (!dateStr) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const evDate = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.round((evDate - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return {
      label: '🔴 En cours',
      bg: 'rgba(255,77,106,0.12)',
      color: '#ff4d6a',
      border: '#ff4d6a'
    };
  }
  if (diffDays > 0) {
    return {
      label: '🟢 À venir',
      bg: 'rgba(0,200,124,0.12)',
      color: '#00c87c',
      border: '#00c87c'
    };
  }
  return {
    label: '⚫ Passé',
    bg: 'rgba(232,236,244,0.08)',
    color: 'rgba(232,236,244,0.5)',
    border: 'rgba(232,236,244,0.3)'
  };
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
}

/**
 * Met à jour les compteurs (sidebar + page).
 */
function updateEventCounters(events) {
  const count = events.length;

  setText('events-count', count);
  setText('total-events', `${count} événement${count > 1 ? 's' : ''}`);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/**
 * Alimente tous les selects d'événements dans l'app.
 */
function populateEventSelectors(events) {
  const selectors = [
    { id: 'badge-event',  placeholder: '-- Sélectionner --' },
    { id: 'import-event', placeholder: '-- Sélectionner --' },
    { id: 'vendeur-event',placeholder: '-- Événement (optionnel) --' },
    { id: 'filter-event', placeholder: 'Tous les événements' }
  ];

  selectors.forEach(({ id, placeholder }) => {
    const sel = document.getElementById(id);
    if (!sel) return;

    const current = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>`;
    events.forEach(ev => {
      sel.innerHTML += `<option value="${ev.id}">${escapeHTML(ev.name)}</option>`;
    });
    if (current) sel.value = current;
  });
}

/* ============================================================
   CRÉATION
   ============================================================ */

/**
 * Ouvre la modale "Nouvel événement".
 */
export function openEventModal() {
  editingId = null;

  ['event-name', 'event-location', 'event-date', 'event-org', 'event-desc']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

  // Pré-remplir la date du jour
  const dateEl = document.getElementById('event-date');
  if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

  modal.open(MODAL_NEW);
}

/**
 * Sauvegarde un nouvel événement.
 */
export async function saveEvent() {
  const nameEl = document.getElementById('event-name');
  const name = (nameEl?.value || '').trim();

  if (!name) {
    showToast('Nom requis', 'error');
    nameEl?.focus();
    return;
  }

  const event = {
    name,
    location: (document.getElementById('event-location')?.value || '').trim(),
    date:     document.getElementById('event-date')?.value || '',
    org:      (document.getElementById('event-org')?.value || '').trim(),
    desc:     (document.getElementById('event-desc')?.value || '').trim(),
    createdAt: new Date().toISOString()
  };

  try {
    await store.add('events', event);
    showToast('Événement créé ✅');
    modal.close(MODAL_NEW);
    await loadEvents();
    document.dispatchEvent(new CustomEvent('data:refresh'));
  } catch (err) {
    console.error('[events] saveEvent:', err);
    showToast('Erreur lors de la création', 'error');
  }
}

/* ============================================================
   ÉDITION
   ============================================================ */

/**
 * Ouvre la modale d'édition pré-remplie.
 */
export async function editEvent(id) {
  try {
    const ev = await store.get('events', id);
    if (!ev) { showToast('Événement introuvable', 'error'); return; }

    editingId = id;

    setValue('edit-event-id', id);
    setValue('edit-event-name', ev.name || '');
    setValue('edit-event-location', ev.location || '');
    setValue('edit-event-date', ev.date || '');
    setValue('edit-event-org', ev.org || '');
    setValue('edit-event-desc', ev.desc || '');

    modal.open(MODAL_EDIT);
  } catch (err) {
    console.error('[events] editEvent:', err);
  }
}

/**
 * Sauvegarde les modifications.
 */
export async function updateEvent() {
  const id = parseInt(document.getElementById('edit-event-id')?.value);
  if (!id) { showToast('ID événement manquant', 'error'); return; }

  const name = (document.getElementById('edit-event-name')?.value || '').trim();
  if (!name) { showToast('Nom requis', 'error'); return; }

  try {
    const ev = await store.get('events', id);
    if (!ev) { showToast('Événement introuvable', 'error'); return; }

    ev.name = name;
    ev.location = (document.getElementById('edit-event-location')?.value || '').trim();
    ev.date = document.getElementById('edit-event-date')?.value || '';
    ev.org = (document.getElementById('edit-event-org')?.value || '').trim();
    ev.desc = (document.getElementById('edit-event-desc')?.value || '').trim();

    await store.put('events', ev);
    showToast('Événement modifié ✅');
    modal.close(MODAL_EDIT);
    await loadEvents();
    document.dispatchEvent(new CustomEvent('data:refresh'));
  } catch (err) {
    console.error('[events] updateEvent:', err);
    showToast('Erreur lors de la modification', 'error');
  }
}

/* ============================================================
   SUPPRESSION
   ============================================================ */

export async function deleteEvent(id) {
  const ok = await showConfirm({
    title: 'Supprimer cet événement ?',
    message: 'Tous les badges associés à cet événement seront également supprimés. Action irréversible.',
    okText: 'Supprimer',
    type: 'danger',
    icon: '🎪'
  });

  if (!ok) return;

  try {
    // Supprime aussi les badges associés
    const badges = await store.getAll('badges');
    const toDelete = badges.filter(b => b.eventId === id);

    for (const b of toDelete) {
      await store.delete('badges', b.id);
    }

    await store.delete('events', id);
    showToast(`Événement et ${toDelete.length} badge(s) supprimés`);

    await loadEvents();
    document.dispatchEvent(new CustomEvent('data:refresh'));
  } catch (err) {
    console.error('[events] deleteEvent:', err);
    showToast('Erreur lors de la suppression', 'error');
  }
}

/* ============================================================
   ACTIONS RAPIDES (depuis les cartes)
   ============================================================ */

export function createBadgeForEvent(id) {
  const sel = document.getElementById('badge-event');
  if (sel) sel.value = id;
  document.dispatchEvent(new CustomEvent('page:change', { detail: { pageId: 'create-badge' } }));
  // Force la navigation
  window.location.hash = 'create-badge';
}

export function importForEvent(id) {
  const sel = document.getElementById('import-event');
  if (sel) sel.value = id;
  window.location.hash = 'import-excel';
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

export const eventsAPI = {
  load: loadEvents,
  open: openEventModal,
  save: saveEvent,
  edit: editEvent,
  update: updateEvent,
  remove: deleteEvent,
  createBadge: createBadgeForEvent,
  importExcel: importForEvent
};
