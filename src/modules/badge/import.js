/**
 * ============================================================
 *  BADGEMASTER PRO — Import Excel
 * ============================================================
 *  Import en masse de badges depuis un fichier .xlsx
 *   - Drag & drop ou sélection
 *   - Parse via SheetJS
 *   - Prévisualisation modale
 *   - Création par lots + historique
 * ============================================================
 */

import { store }       from '../db/idb.js';
import { showToast }   from '../ui/toast.js';
import { modal }       from '../ui/modal.js';
import {
  escapeHTML,
  compressLogo,
  fileToDataURL
} from '../ui/util.js';

/* ============================================================
   ÉTAT
   ============================================================ */
let tempImportData = null;
let importLogoSrc = '';
let importBrandLogoSrc = '';
let importFormat = 'cr80';
let importModel = 'with-photo';

/* ============================================================
   INIT
   ============================================================ */

export function initImport() {
  const zone = document.getElementById('import-zone');
  if (!zone) return;

  // Drag & drop
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('drag-over');
  });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');

    const file = e.dataTransfer.files?.[0];
    if (file) processExcelFile(file);
  });

  // Input file
  const input = document.getElementById('excel-input');
  if (input) {
    input.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) processExcelFile(file);
    });
  }

  // Inputs logo
  attachFileInput('import-logo-input', handleImportLogoUpload);
  attachFileInput('import-brand-logo-input', handleImportBrandLogoUpload);
}

function attachFileInput(inputId, handler) {
  const input = document.getElementById(inputId);
  if (!input) return;
  input.addEventListener('change', handler);
}

/* ============================================================
   TRAITEMENT DU FICHIER
   ============================================================ */

async function processExcelFile(file) {
  // Vérifie qu'un événement est sélectionné
  const eventId = parseInt(document.getElementById('import-event')?.value);
  if (!eventId) {
    showToast("Sélectionnez un événement d'abord", "error");
    return;
  }

  // Vérifie que SheetJS est chargé
  if (typeof XLSX === 'undefined') {
    showToast("Bibliothèque XLSX non chargée", "error");
    return;
  }

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    // Ignore la ligne d'en-tête
    const rows = data.slice(1).filter((r) => r && (r[0] || r[1] || r[2]));

    if (!rows.length) {
      showToast("Aucune ligne valide dans le fichier", "error");
      return;
    }

    tempImportData = { fileName: file.name, eventId, rows };
    showPreview(rows, file.name);
  } catch (err) {
    console.error("[import] processExcelFile:", err);
    showToast("Erreur lecture Excel : " + err.message, "error");
  }
}

function showPreview(rows, fileName) {
  const body = document.getElementById("import-preview-body");
  if (!body) return;

  body.innerHTML = rows.slice(0, 50).map((r) => `
    <tr>
      <td>${escapeHTML(String(r[0] || ""))}</td>
      <td>${escapeHTML(String(r[1] || ""))}</td>
      <td>${escapeHTML(String(r[2] || ""))}</td>
      <td>${escapeHTML(String(r[3] || ""))}</td>
      <td>${escapeHTML(formatExcelDate(r[4]))}</td>
    </tr>
  `).join("");

  if (rows.length > 50) {
    body.innerHTML += `
      <tr>
        <td colspan="5" style="text-align:center;color:var(--c-text-muted);">
          ... et ${rows.length - 50} autres lignes
        </td>
      </tr>`;
  }

  const info = document.getElementById("import-preview-info");
  if (info) {
    info.textContent = `${rows.length} participants trouvés dans "${fileName}".`;
  }

  modal.open("import-preview-modal");
}

/* ============================================================
   CONFIRMATION IMPORT
   ============================================================ */

export async function confirmImport() {
  if (!tempImportData) return;

  modal.close("import-preview-modal");

  const { fileName, eventId, rows } = tempImportData;

  const progressWrap = document.getElementById("import-progress");
  const fill = document.getElementById("import-progress-fill");
  const txt = document.getElementById("import-progress-text");

  if (progressWrap) progressWrap.style.display = "block";
  if (fill) fill.style.width = "0%";
  if (txt) txt.textContent = "Importation en cours...";

  // Enregistre l'import dans l'historique
  const importEntry = {
    fileName,
    eventId,
    totalRows: rows.length,
    createdAt: new Date().toISOString()
  };

  try {
    const importId = await store.add("imports", importEntry);

    let imported = 0;
    const badgeData = rows.map((r, i) => ({
      eventId,
      importId,
      org: String(r[0] || "").trim(),
      name: String(r[1] || "").trim(),
      role: String(r[2] || "").trim(),
      badgeId: String(r[3] || `AUTO-${Date.now()}-${i}`).trim(),
      date: formatExcelDate(r[4]),
      photo: "",
      logo: importLogoSrc,
      brandLogo: importModel === "brand-vendor" ? importBrandLogoSrc : "",
      brandName: importModel === "brand-vendor"
        ? (String(r[5] || "").trim() || (document.getElementById("import-brand-name")?.value || "").trim())
        : "",
      format: importFormat,
      model: importModel,
      createdAt: new Date().toISOString()
    }));

    // Insère par batch
    for (const badge of badgeData) {
      await store.add("badges", badge);
      imported++;

      if (fill) fill.style.width = `${Math.round((imported / rows.length) * 100)}%`;
      if (txt) txt.textContent = `${imported} / ${rows.length} badges...`;
    }

    if (progressWrap) progressWrap.style.display = "none";

    const result = document.getElementById("import-result");
    if (result) {
      result.style.display = "block";
      result.innerHTML = `
        <div style="background:var(--c-accent-dim);border:1px solid rgba(0,212,170,0.3);border-radius:8px;padding:15px;color:var(--c-accent);margin-top:12px;">
          ✅ <strong>${imported} badges importés</strong> depuis ${escapeHTML(fileName)}
        </div>`;
    }

    showToast(`${imported} badges importés ✅`);

    tempImportData = null;
    const input = document.getElementById("excel-input");
    if (input) input.value = "";

    document.dispatchEvent(new CustomEvent("data:refresh"));
    loadImportsHistory();
  } catch (err) {
    console.error("[import] confirmImport:", err);
    showToast("Erreur import : " + err.message, "error");
    if (progressWrap) progressWrap.style.display = "none";
  }
}

/* ============================================================
   HISTORIQUE
   ============================================================ */

export async function loadImportsHistory() {
  try {
    const [imports, events] = await Promise.all([
      store.getAll("imports"),
      store.getAll("events")
    ]);

    const evtMap = {};
    events.forEach((e) => { evtMap[e.id] = e.name; });

    renderImportsHistory(imports, evtMap);
  } catch (err) {
    console.error("[import] loadHistory:", err);
  }
}

function renderImportsHistory(imports, evtMap) {
  const cont = document.getElementById("import-history-list");
  if (!cont) return;

  if (!imports.length) {
    cont.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <div class="empty-title">Aucun import</div>
        <div class="empty-desc">Importez un fichier Excel pour créer des badges en masse.</div>
      </div>`;
    return;
  }

  imports.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  cont.innerHTML = `
    <table class="journal-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Fichier</th>
          <th>Événement</th>
          <th>Badges</th>
        </tr>
      </thead>
      <tbody>
        ${imports.map((imp) => {
          const date = new Date(imp.createdAt).toLocaleString("fr-FR");
          return `
            <tr>
              <td style="font-family:var(--font-mono);font-size:0.75rem;">${escapeHTML(date)}</td>
              <td><strong>${escapeHTML(imp.fileName || "")}</strong></td>
              <td>${escapeHTML(evtMap[imp.eventId] || "Événement inconnu")}</td>
              <td><span class="chip chip-green">${imp.totalRows}</span></td>
            </tr>`;
        }).join("")}
      </tbody>
    </table>`;
}

/* ============================================================
   UPLOAD LOGOS
   ============================================================ */

async function handleImportLogoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressLogo(dataUrl, 300);
    importLogoSrc = compressed;

    const prev = document.getElementById("import-logo-preview");
    if (prev) prev.innerHTML = `<img src="${compressed}">`;

    showToast("Logo chargé ✅");
  } catch (err) {
    console.error("[import] logo upload:", err);
  }
}

async function handleImportBrandLogoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const dataUrl = await fileToDataURL(file);
    const compressed = await compressLogo(dataUrl, 300);
    importBrandLogoSrc = compressed;

    const prev = document.getElementById("import-brand-logo-preview");
    if (prev) prev.innerHTML = `<img src="${compressed}">`;

    showToast("Logo marque chargé ✅");
  } catch (err) {
    console.error("[import] brand logo upload:", err);
  }
}

/* ============================================================
   SELECTEURS MODÈLE / FORMAT
   ============================================================ */

export function selectImportModel(model, btn) {
  importModel = model;
  document.querySelectorAll("#import-model-group .option-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const brandGroup = document.getElementById("import-brand-group");
  if (brandGroup) brandGroup.style.display = (model === "brand-vendor") ? "block" : "none";
}

export function selectImportFormat(format, btn) {
  importFormat = format;
  document.querySelectorAll("#import-format-group .option-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const compactPanel = document.getElementById("import-compact-inputs");
  if (compactPanel) compactPanel.style.display = (format === "compact") ? "flex" : "none";
}

/* ============================================================
   HELPERS
   ============================================================ */

function formatExcelDate(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") {
    // Excel epoch : 25569 jours depuis 1970-01-01
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  return "";
}

/* ============================================================
   API PUBLIQUE
   ============================================================ */

export const importAPI = {
  init: initImport,
  confirm: confirmImport,
  loadHistory: loadImportsHistory,
  selectModel: selectImportModel,
  selectFormat: selectImportFormat
};
