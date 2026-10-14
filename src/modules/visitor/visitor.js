/**
 * ============================================================
 *  BADGEMASTER PRO — Module Visiteurs
 *  ============================================================
 *  Gestion des visiteurs + badges dédiés (orange) :
 *   - Formulaire modal (nom, société, dept, entrée/sortie)
 *   - Photo (fichier + caméra)
 *   - Logo hôte
 *   - Aperçu live du badge visiteur
 *   - CRUD complet + sélection multiple
 *   - Impression + PNG
 *   - Stats visiteurs (aujourd'hui, total, avec photo)
 * ============================================================
 */

import { store }       from '../db/idb.js';
import { showToast }   from '../ui/toast.js';
import { showConfirm } from '../ui/confirm.js';
import { modal }       from '../ui/modal.js';
import {
  escapeHTML,
  compressImage,
  compressLogo,
  fileToDataURL,
  getInitials,
  todayISO,
  nowHHMM
} from '../ui/util.js';

/* ============================================================
   ÉTAT
   ============================================================ */
const MODAL_ID = "visitor-modal";
const PRINT_MODAL_ID = "visitor-print-modal";

let editingId = null;
let currentPhotoSrc = "";
let currentLogoSrc = "";
let currentModel = "with-photo";

const selectedVisitors = new Set();

/* ============================================================
   INIT
   ============================================================ */

export function initVisitor() {
  attachInputs();
  attachFileInputs();
}

function attachInputs() {
  // Champs → aperçu live
  ["visitor-lastname", "visitor-firstname", "visitor-company",
   "visitor-dept", "visitor-host-org", "visitor-entry", "visitor-exit"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("input", updateVisitorPreview);
    });

  // Filtre recherche liste
  const searchEl = document.getElementById("search-visitors");
  if (searchEl) searchEl.addEventListener("input", loadAllVisitors);
}

function attachFileInputs() {
  const photoInput = document.getElementById("visitor-photo-file");
  if (photoInput) photoInput.addEventListener("change", handlePhotoUpload);

  const logoInput = document.getElementById("visitor-logo-input");
  if (logoInput) logoInput.addEventListener("change", handleLogoUpload);
}

/* ============================================================
   SÉLECTION MODÈLE
   ============================================================ */

export function selectVisitorModel(model, btn) {
  currentModel = model;

  document.querySelectorAll("#visitor-model-group .option-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const photoGroup = document.getElementById("visitor-photo-group");
  if (photoGroup) photoGroup.style.display = (model === "with-photo") ? "block" : "none";

  updateVisitorPreview();
}

/* ============================================================
   APERÇU LIVE
   ============================================================ */

export function updateVisitorPreview() {
  const lastname = document.getElementById("visitor-lastname")?.value || "NOM";
  const firstname = document.getElementById("visitor-firstname")?.value || "Prénom";
  const company = document.getElementById("visitor-company")?.value || "Société";
  const dept = document.getElementById("visitor-dept")?.value || "Département";
  const hostOrg = document.getElementById("visitor-host-org")?.value || "ORGANISATION";
  const entry = document.getElementById("visitor-entry")?.value || "--:--";
  const exit = document.getElementById("visitor-exit")?.value || "--:--";

  // Org header
  const orgEl = document.getElementById("vb-preview-org");
  if (orgEl) orgEl.textContent = hostOrg.toUpperCase();

  // Body
  const body = document.getElementById("vb-preview-body");
  if (!body) return;

  if (currentModel === "with-photo") {
    const photoSrc = currentPhotoSrc || buildPhotoPlaceholder();
    body.innerHTML = `
      <div class="vb-photo">
        <img id="vb-preview-img" src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;">
      </div>
      <div class="vb-info">
        <div class="vb-name">${escapeHTML(lastname.toUpperCase())} ${escapeHTML(firstname)}</div>
        <div class="vb-company">${escapeHTML(company)}</div>
        <div class="vb-dept">${escapeHTML(dept)}</div>
        <div class="vb-times">
          <div class="vb-time-badge entry">
            <div class="t-label">Entrée</div>
            <div class="t-value">${escapeHTML(entry)}</div>
          </div>
          <div class="vb-time-badge exit">
            <div class="t-label">Sortie</div>
            <div class="t-value">${escapeHTML(exit)}</div>
          </div>
        </div>
      </div>`;
  } else {
    body.innerHTML = `
      <div class="vb-info" style="width:100%;text-align:center;justify-content:center;align-items:center;display:flex;flex-direction:column;gap:4px;">
        <div class="vb-name">${escapeHTML(lastname.toUpperCase())} ${escapeHTML(firstname)}</div>
        <div class="vb-company" style="border-left:none;text-align:center;">${escapeHTML(company)}</div>
        <div class="vb-dept">${escapeHTML(dept)}</div>
        <div class="vb-times" style="justify-content:center;">
          <div class="vb-time-badge entry">
            <div class="t-label">Entrée</div>
            <div class="t-value">${escapeHTML(entry)}</div>
          </div>
          <div class="vb-time-badge exit">
            <div class="t-label">Sortie</div>
            <div class="t-value">${escapeHTML(exit)}</div>
          </div>
        </div>
      </div>`;
  }

  // Logo header
  const logoEl = document.getElementById("vb-preview-logo");
  if (logoEl) {
    logoEl.innerHTML = currentLogoSrc
      ? `<img src="${currentLogoSrc}">`
      : "🏢";
  }

  // QR
  updateVisitorQR();
}

function buildPhotoPlaceholder() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='76' height='96'%3E%3Crect fill='%23fff3e0' width='76' height='96'/%3E%3Ctext x='38' y='52' text-anchor='middle' fill='%23e65100' font-size='28'%3E👤%3C/text%3E%3C/svg%3E";
}

function updateVisitorQR() {
  const qrDiv = document.getElementById("vb-preview-qr");
  if (!qrDiv) return;

  const lastname = document.getElementById("visitor-lastname")?.value || "";
  const firstname = document.getElementById("visitor-firstname")?.value || "";
  const company = document.getElementById("visitor-company")?.value || "";
  const hostOrg = document.getElementById("visitor-host-org")?.value || "";

  qrDiv.innerHTML = "";

  const qrText = `NOM:${lastname} ${firstname}|SOC:${company}|HOTE:${hostOrg}`;

  import("qrcode").then(({ default: QRCode }) => {
    QRCode.toCanvas(qrText || "VISITEUR", { width: 46, margin: 0, color: { dark: "#e65100", light: "#ffffff" } }, (err, canvas) => {
      if (err) return;
      qrDiv.innerHTML = "";
      qrDiv.appendChild(canvas);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    });
  }).catch((err) => console.warn("[visitor] QR module:", err));
}

/* ============================================================
   UPLOAD PHOTO / LOGO
   ============================================================ */

async function handlePhotoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressImage(dataUrl, 300, 400, 0.8);

    currentPhotoSrc = compressed;

    const thumb = document.getElementById("visitor-photo-preview");
    if (thumb) { thumb.src = compressed; thumb.classList.add("visible"); }

    setText("visitor-photo-status", "✅ Photo chargée");
    const clearBtn = document.getElementById("visitor-clear-photo-btn");
    if (clearBtn) clearBtn.style.display = "inline-flex";

    updateVisitorPreview();
    showToast("Photo chargée ✅");
  } catch (err) {
    console.error("[visitor] photo upload:", err);
    showToast("Erreur chargement photo", "error");
  }
}

async function handleLogoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressLogo(dataUrl, 200);

    currentLogoSrc = compressed;

    const prev = document.getElementById("visitor-logo-preview");
    if (prev) prev.innerHTML = `<img src="${compressed}">`;

    updateVisitorPreview();
    showToast("Logo chargé ✅");
  } catch (err) {
    console.error("[visitor] logo upload:", err);
    showToast("Erreur chargement logo", "error");
  }
}

export function clearVisitorPhoto() {
  currentPhotoSrc = "";

  const thumb = document.getElementById("visitor-photo-preview");
  if (thumb) thumb.classList.remove("visible");

  setText("visitor-photo-status", "Aucune photo sélectionnée");
  const clearBtn = document.getElementById("visitor-clear-photo-btn");
  if (clearBtn) clearBtn.style.display = "none";

  updateVisitorPreview();
}

/* ============================================================
   OUVERTURE / FERMETURE FORMULAIRE
   ============================================================ */

export function openVisitorModal(id = null) {
  if (id) return editVisitor(id);

  resetVisitorForm();
  modal.open(MODAL_ID);
  updateVisitorPreview();
}

export function closeVisitorModal() {
  modal.close(MODAL_ID);
}

function resetVisitorForm() {
  editingId = null;
  currentPhotoSrc = "";
  currentLogoSrc = "";
  currentModel = "with-photo";

  ["visitor-lastname", "visitor-firstname", "visitor-company",
   "visitor-dept", "visitor-host-org", "visitor-entry", "visitor-exit"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  // Heure d'entrée par défaut
  const entryEl = document.getElementById("visitor-entry");
  if (entryEl) entryEl.value = nowHHMM();

  // Reset photo
  const thumb = document.getElementById("visitor-photo-preview");
  if (thumb) thumb.classList.remove("visible");
  setText("visitor-photo-status", "Aucune photo sélectionnée");
  const clearBtn = document.getElementById("visitor-clear-photo-btn");
  if (clearBtn) clearBtn.style.display = "none";

  // Reset logo
  const logoPrev = document.getElementById("visitor-logo-preview");
  if (logoPrev) logoPrev.innerHTML = '<span style="font-size:0.65rem;">Logo</span>';
  const vbLogo = document.getElementById("vb-preview-logo");
  if (vbLogo) vbLogo.textContent = "🏢";

  // Reset modèle
  document.querySelectorAll("#visitor-model-group .option-btn").forEach((b, i) => {
    b.classList.toggle("active", i === 0);
  });
  const photoGroup = document.getElementById("visitor-photo-group");
  if (photoGroup) photoGroup.style.display = "block";

  // Titre
  const title = document.getElementById("visitor-modal-title");
  if (title) title.textContent = "🪪 Nouveau visiteur";

  const editId = document.getElementById("visitor-edit-id");
  if (editId) editId.value = "";
}

/* ============================================================
   SAUVEGARDE
   ============================================================ */

export async function saveVisitor() {
  const lastname = (document.getElementById("visitor-lastname")?.value || "").trim();
  const firstname = (document.getElementById("visitor-firstname")?.value || "").trim();

  if (!lastname && !firstname) {
    showToast("Nom et prénom requis", "error");
    return;
  }
  if (!lastname) {
    showToast("Nom requis", "error");
    document.getElementById("visitor-lastname")?.focus();
    return;
  }
  if (!firstname) {
    showToast("Prénom requis", "error");
    document.getElementById("visitor-firstname")?.focus();
    return;
  }

  const data = {
    lastname,
    firstname,
    company: document.getElementById("visitor-company")?.value.trim() || "",
    dept: document.getElementById("visitor-dept")?.value.trim() || "",
    hostOrg: document.getElementById("visitor-host-org")?.value.trim() || "",
    entry: document.getElementById("visitor-entry")?.value || "",
    exit: document.getElementById("visitor-exit")?.value || "",
    model: currentModel,
    logo: currentLogoSrc,
    photo: currentModel === "with-photo" ? currentPhotoSrc : "",
    visitDate: todayISO(),
    createdAt: new Date().toISOString()
  };

  try {
    if (editingId) {
      data.id = editingId;
      await store.put("visitors", data);
      showToast("Visiteur modifié ✅");
    } else {
      await store.add("visitors", data);
      showToast("Visiteur enregistré ✅");
    }

    editingId = null;
    closeVisitorModal();
    await loadAllVisitors();
    updateVisitorStats();
    document.dispatchEvent(new CustomEvent("data:refresh"));
  } catch (err) {
    console.error("[visitor] saveVisitor:", err);
    showToast("Erreur lors de la sauvegarde : " + err.message, "error");
  }
}

/* ============================================================
   ÉDITION
   ============================================================ */

export async function editVisitor(id) {
  try {
    const v = await store.get("visitors", id);
    if (!v) { showToast("Visiteur introuvable", "error"); return; }

    editingId = id;
    currentPhotoSrc = v.photo || "";
    currentLogoSrc = v.logo || "";
    currentModel = v.model || "with-photo";

    setValue("visitor-edit-id", id);
    setValue("visitor-lastname", v.lastname || "");
    setValue("visitor-firstname", v.firstname || "");
    setValue("visitor-company", v.company || "");
    setValue("visitor-dept", v.dept || "");
    setValue("visitor-host-org", v.hostOrg || "");
    setValue("visitor-entry", v.entry || "");
    setValue("visitor-exit", v.exit || "");

    const title = document.getElementById("visitor-modal-title");
    if (title) title.textContent = "✏️ Modifier visiteur";

    // Photo
    const thumb = document.getElementById("visitor-photo-preview");
    if (v.photo) {
      if (thumb) { thumb.src = v.photo; thumb.classList.add("visible"); }
      setText("visitor-photo-status", "✅ Photo chargée");
      const clearBtn = document.getElementById("visitor-clear-photo-btn");
      if (clearBtn) clearBtn.style.display = "inline-flex";
    } else {
      if (thumb) thumb.classList.remove("visible");
      setText("visitor-photo-status", "Aucune photo");
      const clearBtn = document.getElementById("visitor-clear-photo-btn");
      if (clearBtn) clearBtn.style.display = "none";
    }

    // Logo
    if (v.logo) {
      const logoPrev = document.getElementById("visitor-logo-preview");
      if (logoPrev) logoPrev.innerHTML = `<img src="${v.logo}">`;
      const vbLogo = document.getElementById("vb-preview-logo");
      if (vbLogo) vbLogo.innerHTML = `<img src="${v.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }

    // Modèle
    document.querySelectorAll("#visitor-model-group .option-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.visitorModel === currentModel);
    });
    const photoGroup = document.getElementById("visitor-photo-group");
    if (photoGroup) photoGroup.style.display = currentModel === "with-photo" ? "block" : "none";

    modal.open(MODAL_ID);
    updateVisitorPreview();
  } catch (err) {
    console.error("[visitor] editVisitor:", err);
  }
}

/* ============================================================
   LISTE
   ============================================================ */

export async function loadAllVisitors() {
  try {
    const all = await store.getAll("visitors");

    const search = (document.getElementById("search-visitors")?.value || "").toLowerCase();
    let visitors = all;

    if (search) {
      visitors = visitors.filter((v) =>
        (`${v.lastname} ${v.firstname}`).toLowerCase().includes(search) ||
        (v.company || "").toLowerCase().includes(search) ||
        (v.dept || "").toLowerCase().includes(search) ||
        (v.hostOrg || "").toLowerCase().includes(search)
      );
    }

    visitors.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const totalEl = document.getElementById("visitors-total");
    if (totalEl) totalEl.textContent = visitors.length;

    renderVisitors(visitors);
  } catch (err) {
    console.error("[visitor] loadAllVisitors:", err);
  }
}

function renderVisitors(visitors) {
  const cont = document.getElementById("visitors-list");
  if (!cont) return;

  if (!visitors.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🪪</div>
        <div class="empty-title">Aucun visiteur enregistré</div>
        <div class="empty-desc">Enregistrez les entrées et sorties de vos visiteurs.</div>
        <button class="btn btn-warning btn-sm" style="color:#1a0e00;" data-action="visitor-open">+ Enregistrer le premier visiteur</button>
      </div>`;
    return;
  }

  cont.innerHTML = visitors.map((v) => renderVisitorItem(v)).join("");
}

function renderVisitorItem(v) {
  const isSelected = selectedVisitors.has(v.id);
  const initials = getInitials(v.firstname, v.lastname);
  const avatarHtml = v.photo
    ? `<img src="${v.photo}">`
    : initials;

  const modelBadge = v.model === "no-photo"
    ? `<span style="font-size:0.62rem;background:rgba(255,143,0,0.15);color:#ff8f00;border:1px solid #ff8f00;border-radius:8px;padding:1px 6px;font-weight:700;margin-left:4px;">Sans photo</span>`
    : "";

  return `
    <div class="visitor-list-item ${isSelected ? "selected" : ""}">
      <input type="checkbox" ${isSelected ? "checked" : ""}
             data-action="visitor-toggle-select" data-id="${v.id}"
             style="accent-color:#ff8f00;width:16px;height:16px;flex-shrink:0;cursor:pointer;">
      <div class="v-avatar">${avatarHtml}</div>
      <div class="v-info">
        <div class="v-name">${escapeHTML((v.lastname || "").toUpperCase())} ${escapeHTML(v.firstname || "")}${modelBadge}</div>
        <div class="v-meta">${escapeHTML(v.company || "—")} · ${escapeHTML(v.dept || "—")}</div>
        <div class="v-meta" style="font-family:var(--font-mono);font-size:0.7rem;">
          🟢 ${escapeHTML(v.entry || "--:--")}  🔴 ${escapeHTML(v.exit || "--:--")}  📅 ${escapeHTML(v.visitDate || "")}
        </div>
      </div>
      <div class="v-actions">
        <button class="btn btn-info btn-sm btn-icon"
                data-action="visitor-edit" data-id="${v.id}"
                title="Modifier">✏️</button>
        <button class="btn btn-warning btn-sm btn-icon"
                data-action="visitor-print-one" data-id="${v.id}"
                title="Imprimer" style="color:#1a0e00;">🖨️</button>
        <button class="btn btn-danger btn-sm btn-icon"
                data-action="visitor-delete" data-id="${v.id}"
                title="Supprimer">🗑️</button>
      </div>
    </div>`;
}

/* ============================================================
   STATS
   ============================================================ */

export async function updateVisitorStats() {
  try {
    const all = await store.getAll("visitors");
    const today = todayISO();

    setText("vstat-total", all.length);
    setText("vstat-today", all.filter((v) => v.visitDate === today).length);
    setText("vstat-photos", all.filter((v) => v.photo).length);

    setText("visitors-count", all.length);
    setText("stat-visitors", all.length);
  } catch (err) {
    console.error("[visitor] updateVisitorStats:", err);
  }
}

/* ============================================================
   SÉLECTION
   ============================================================ */

export function toggleSelect(id) {
  if (selectedVisitors.has(id)) selectedVisitors.delete(id);
  else selectedVisitors.add(id);
  loadAllVisitors();
}

export async function selectAllVisitors() {
  try {
    const all = await store.getAll("visitors");
    all.forEach((v) => selectedVisitors.add(v.id));
    loadAllVisitors();
  } catch (err) {
    console.error("[visitor] selectAll:", err);
  }
}

/* ============================================================
   SUPPRESSION
   ============================================================ */

export async function deleteVisitor(id) {
  const ok = await showConfirm({
    title: "Supprimer ce visiteur ?",
    message: "L'enregistrement sera définitivement supprimé.",
    okText: "Supprimer", type: "danger", icon: "🪪"
  });
  if (!ok) return;

  try {
    await store.delete("visitors", id);
    showToast("Visiteur supprimé");
    loadAllVisitors();
    updateVisitorStats();
  } catch (err) {
    console.error("[visitor] deleteVisitor:", err);
  }
}

export async function deleteSelectedVisitors() {
  if (!selectedVisitors.size) {
    showToast("Aucun visiteur sélectionné", "info");
    return;
  }

  const ok = await showConfirm({
    title: `Supprimer ${selectedVisitors.size} visiteur(s) ?`,
    message: "Action irréversible.",
    okText: "Supprimer", type: "danger", icon: "🪪"
  });
  if (!ok) return;

  try {
    for (const id of selectedVisitors) {
      await store.delete("visitors", id);
    }
    const count = selectedVisitors.size;
    selectedVisitors.clear();
    showToast(`${count} visiteur(s) supprimé(s)`);
    loadAllVisitors();
    updateVisitorStats();
  } catch (err) {
    console.error("[visitor] deleteSelected:", err);
  }
}

/* ============================================================
   IMPRESSION
   ============================================================ */

export async function printOneVisitor(id) {
  try {
    const v = await store.get("visitors", id);
    if (!v) return;

    modal.open(PRINT_MODAL_ID);

    const countEl = document.getElementById("visitor-print-count");
    if (countEl) countEl.textContent = "1 visiteur";

    await generateVisitorPrintContent([v], "visitor-print-content");
  } catch (err) {
    console.error("[visitor] printOne:", err);
  }
}

export async function printSelectedVisitors() {
  if (!selectedVisitors.size) {
    showToast("Sélectionnez des visiteurs", "info");
    return;
  }

  try {
    const visitors = [];
    for (const id of selectedVisitors) {
      const v = await store.get("visitors", id);
      if (v) visitors.push(v);
    }

    modal.open(PRINT_MODAL_ID);

    const countEl = document.getElementById("visitor-print-count");
    if (countEl) countEl.textContent = `${visitors.length} visiteur(s)`;

    await generateVisitorPrintContent(visitors, "visitor-print-content");
  } catch (err) {
    console.error("[visitor] printSelected:", err);
  }
}

async function generateVisitorPrintContent(visitors, containerId) {
  const content = document.getElementById(containerId);
  if (!content) return;

  content.innerHTML = "";
  const perPage = 6;

  for (let p = 0; p < Math.ceil(visitors.length / perPage); p++) {
    const page = document.createElement("div");
    page.className = "a4-page";

    const grid = document.createElement("div");
    grid.className = "badges-grid";

    for (let i = p * perPage; i < Math.min((p + 1) * perPage, visitors.length); i++) {
      grid.innerHTML += buildVisitorBadgeHTML(visitors[i], `vqr-${i}`);
    }

    page.appendChild(grid);
    content.appendChild(page);
  }

  // Génère les QR
  if (visitors.length) {
    setTimeout(() => generateVisitorQRs(visitors), 200);
  }
}

function buildVisitorBadgeHTML(v, qrId) {
  const logoHtml = v.logo
    ? `<img src="${v.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : "🏢";

  const photoSrc = v.photo || buildPhotoPlaceholder();

  let bodyHtml;
  if ((v.model || "with-photo") === "with-photo") {
    bodyHtml = `
      <div class="vb-body">
        <div class="vb-photo">
          <img src="${photoSrc}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div class="vb-info">
          <div class="vb-name">${escapeHTML((v.lastname || "").toUpperCase())} ${escapeHTML(v.firstname || "")}</div>
          <div class="vb-company">${escapeHTML(v.company || "—")}</div>
          <div class="vb-dept">${escapeHTML(v.dept || "—")}</div>
          <div class="vb-times">
            <div class="vb-time-badge entry">
              <div class="t-label">Entrée</div>
              <div class="t-value">${escapeHTML(v.entry || "--:--")}</div>
            </div>
            <div class="vb-time-badge exit">
              <div class="t-label">Sortie</div>
              <div class="t-value">${escapeHTML(v.exit || "--:--")}</div>
            </div>
          </div>
        </div>
      </div>`;
  } else {
    bodyHtml = `
      <div class="vb-body">
        <div class="vb-info" style="width:100%;text-align:center;justify-content:center;align-items:center;display:flex;flex-direction:column;gap:4px;">
          <div class="vb-name">${escapeHTML((v.lastname || "").toUpperCase())} ${escapeHTML(v.firstname || "")}</div>
          <div class="vb-company" style="border-left:none;">${escapeHTML(v.company || "—")}</div>
          <div class="vb-dept">${escapeHTML(v.dept || "—")}</div>
          <div class="vb-times" style="justify-content:center;">
            <div class="vb-time-badge entry">
              <div class="t-label">Entrée</div>
              <div class="t-value">${escapeHTML(v.entry || "--:--")}</div>
            </div>
            <div class="vb-time-badge exit">
              <div class="t-label">Sortie</div>
              <div class="t-value">${escapeHTML(v.exit || "--:--")}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  return `
    <div class="visitor-badge" style="width:342px;height:216px;background:white;border-radius:12px;position:relative;overflow:hidden;border:1px solid rgba(0,0,0,0.15);font-family:Segoe UI,Arial,sans-serif;">
      <div class="vb-top-stripe"></div>
      <div class="vb-header">
        <div class="vb-header-logo">${logoHtml}</div>
        <div class="vb-header-title">
          <div class="vb-label-visiteur">★ Visiteur ★</div>
          <div class="vb-org-name">${escapeHTML((v.hostOrg || "ORGANISATION").toUpperCase())}</div>
        </div>
      </div>
      ${bodyHtml}
      <div class="vb-qr" id="${qrId}"></div>
      <div class="vb-bottom-bar"></div>
    </div>`;
}

async function generateVisitorQRs(visitors) {
  try {
    const { default: QRCode } = await import("qrcode");

    for (let i = 0; i < visitors.length; i++) {
      const div = document.getElementById(`vqr-${i}`);
      if (!div) continue;

      const v = visitors[i];
      const text = `NOM:${v.lastname} ${v.firstname}|SOC:${v.company || ""}|DEPT:${v.dept || ""}|ENTREE:${v.entry || ""}|SORTIE:${v.exit || ""}|HOTE:${v.hostOrg || ""}`;

      div.innerHTML = "";
      const canvas = document.createElement("canvas");
      await QRCode.toCanvas(canvas, text || "VISITEUR", { width: 46, margin: 0, color: { dark: "#e65100", light: "#ffffff" } });
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      div.appendChild(canvas);
    }
  } catch (err) {
    console.warn("[visitor] QR gen:", err);
  }
}

/* ============================================================
   DOWNLOAD PNG
   ============================================================ */

export async function downloadVisitorBadge() {
  try {
    const target = document.getElementById("visitor-badge-preview");
    if (!target) return;

    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(target, { scale: 3, backgroundColor: "#fff" });

    const a = document.createElement("a");
    a.download = "badge-visiteur.png";
    a.href = canvas.toDataURL("image/png");
    a.click();
    showToast("PNG généré ✅");
  } catch (err) {
    console.error("[visitor] downloadPNG:", err);
    showToast("Erreur PNG", "error");
  }
}

/* ============================================================
   EXPORT PDF
   ============================================================ */

export async function exportVisitorPDF() {
  const pages = document.querySelectorAll("#visitor-print-content .a4-page");
  if (!pages.length) { showToast("Rien à exporter", "error"); return; }

  try {
    showToast("Génération PDF… ⏳", "info", 2000);

    const { jsPDF } = window.jspdf;
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

    pdf.save(`badges-visiteurs-${todayISO()}.pdf`);
    showToast("PDF exporté ✅");
  } catch (err) {
    console.error("[visitor] exportPDF:", err);
    showToast("Erreur PDF", "error");
  }
}

/* ============================================================
   HELPERS
   ============================================================ */

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

/* ============================================================
   API
   ============================================================ */

export const visitorAPI = {
  init: initVisitor,
  open: openVisitorModal,
  close: closeVisitorModal,
  save: saveVisitor,
  edit: editVisitor,
  load: loadAllVisitors,
  updatePreview: updateVisitorPreview,
  selectModel: selectVisitorModel,
  clearPhoto: clearVisitorPhoto,
  toggleSelect,
  selectAll: selectAllVisitors,
  remove: deleteVisitor,
  removeSelected: deleteSelectedVisitors,
  printOne: printOneVisitor,
  printSelected: printSelectedVisitors,
  updateStats: updateVisitorStats,
  downloadPNG: downloadVisitorBadge,
  exportPDF: exportVisitorPDF
};
