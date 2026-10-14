/**
 * ============================================================
 *  BADGEMASTER PRO — Journal des visites
 * ============================================================
 *  Historique complet des visites :
 *   - Tableau filtrable (dates, recherche)
 *   - Stats en temps réel (jour, semaine, mois, durée moy.)
 *   - Filtres rapides (Aujourd'hui, Semaine, Mois, Tout)
 *   - Export CSV (UTF-8 BOM) et PDF
 * ============================================================
 */

import { store }      from "../db/idb.js";
import { showToast }  from "../ui/toast.js";
import { escapeHTML, calcDuration, todayISO } from "../ui/util.js";

/* ============================================================
   ÉTAT
   ============================================================ */
let currentFilter = "today";

/* ============================================================
   INIT
   ============================================================ */

export function initJournal() {
  const searchEl = document.getElementById("search-journal");
  if (searchEl) {
    searchEl.addEventListener("input", loadJournal);
  }

  ["journal-date-from", "journal-date-to"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", loadJournal);
  });
}

/* ============================================================
   FILTRES RAPIDES
   ============================================================ */

export function setJournalFilter(filter, btn) {
  currentFilter = filter;

  document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");

  const today = todayISO();
  const fromEl = document.getElementById("journal-date-from");
  const toEl = document.getElementById("journal-date-to");

  if (filter === "today") {
    if (fromEl) fromEl.value = today;
    if (toEl) toEl.value = today;
  } else if (filter === "week") {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    if (fromEl) fromEl.value = d.toISOString().split("T")[0];
    if (toEl) toEl.value = today;
  } else if (filter === "month") {
    const d = new Date();
    d.setDate(1);
    if (fromEl) fromEl.value = d.toISOString().split("T")[0];
    if (toEl) toEl.value = today;
  } else {
    if (fromEl) fromEl.value = "";
    if (toEl) toEl.value = "";
  }

  loadJournal();
}

/* ============================================================
   CHARGEMENT + RENDU
   ============================================================ */

export async function loadJournal() {
  try {
    const all = await store.getAll("visitors");

    updateJournalStats(all);

    const from = document.getElementById("journal-date-from")?.value || "";
    const to = document.getElementById("journal-date-to")?.value || "";
    const search = (document.getElementById("search-journal")?.value || "").toLowerCase();

    let visitors = all.slice();

    if (from) visitors = visitors.filter((v) => (v.visitDate || "") >= from);
    if (to) visitors = visitors.filter((v) => (v.visitDate || "") <= to);

    if (search) {
      visitors = visitors.filter((v) =>
        (`${v.lastname || ""} ${v.firstname || ""}`).toLowerCase().includes(search) ||
        (v.company || "").toLowerCase().includes(search) ||
        (v.dept || "").toLowerCase().includes(search) ||
        (v.hostOrg || "").toLowerCase().includes(search)
      );
    }

    visitors.sort((a, b) => {
      const dateCmp = (b.visitDate || "").localeCompare(a.visitDate || "");
      if (dateCmp !== 0) return dateCmp;
      return (b.entry || "").localeCompare(a.entry || "");
    });

    setText("journal-total", visitors.length);
    renderJournal(visitors);
  } catch (err) {
    console.error("[journal] loadJournal:", err);
  }
}

/* ============================================================
   STATS
   ============================================================ */

function updateJournalStats(all) {
  const today = todayISO();
  const monthPrefix = today.slice(0, 7);

  const weekStart = new Date();
  const dayOfWeek = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - dayOfWeek);
  const weekStr = weekStart.toISOString().split("T")[0];

  setText("jstat-today", all.filter((v) => v.visitDate === today).length);
  setText("jstat-week", all.filter((v) => (v.visitDate || "") >= weekStr).length);
  setText("jstat-month", all.filter((v) => (v.visitDate || "").startsWith(monthPrefix)).length);

  const durations = all.map((v) => {
    const e = (v.entry || "").split(":").map(Number);
    const x = (v.exit || "").split(":").map(Number);
    if (e.length < 2 || x.length < 2) return null;
    const m = (x[0] * 60 + x[1]) - (e[0] * 60 + e[1]);
    return m > 0 ? m : null;
  }).filter((m) => m !== null);

  if (durations.length) {
    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    setText("jstat-avg", `${Math.floor(avg / 60)}h${String(avg % 60).padStart(2, "0")}`);
  } else {
    setText("jstat-avg", "—");
  }
}

/* ============================================================
   TABLEAU
   ============================================================ */

function renderJournal(visitors) {
  const tbody = document.getElementById("journal-body");
  const empty = document.getElementById("journal-empty");
  if (!tbody) return;

  if (!visitors.length) {
    tbody.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";

  tbody.innerHTML = visitors.map((v) => {
    const dur = calcDuration(v.entry, v.exit);
    const durHtml = dur
      ? `<span class="duration-badge">${escapeHTML(dur)}</span>`
      : `<span style="color:var(--c-text-muted);font-size:0.72rem;">—</span>`;

    const date = v.visitDate
      ? new Date(v.visitDate + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "—";

    return `
      <tr>
        <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--c-text-sub);white-space:nowrap;">${escapeHTML(date)}</td>
        <td><span style="color:#00c87c;font-weight:700;font-family:var(--font-mono);">${escapeHTML(v.entry || "—")}</span></td>
        <td><span style="color:#ff4d6a;font-weight:700;font-family:var(--font-mono);">${escapeHTML(v.exit || "—")}</span></td>
        <td>${durHtml}</td>
        <td style="white-space:nowrap;"><strong>${escapeHTML((v.lastname || "").toUpperCase())} ${escapeHTML(v.firstname || "")}</strong></td>
        <td style="color:var(--c-text-sub);">${escapeHTML(v.company || "—")}</td>
        <td style="color:var(--c-text-sub);">${escapeHTML(v.dept || "—")}</td>
        <td style="color:var(--c-text-sub);">${escapeHTML(v.hostOrg || "—")}</td>
        <td>
          <div style="display:flex;gap:4px;">
            <button class="btn btn-info btn-sm btn-icon"
                    data-action="visitor-edit" data-id="${v.id}"
                    title="Modifier">✏️</button>
            <button class="btn btn-warning btn-sm btn-icon"
                    data-action="visitor-print-one" data-id="${v.id}"
                    title="Imprimer" style="color:#1a0e00;">🖨️</button>
          </div>
        </td>
      </tr>`;
  }).join("");
}

/* ============================================================
   EXPORT CSV
   ============================================================ */

export async function exportJournalCSV() {
  try {
    let visitors = await store.getAll("visitors");

    const from = document.getElementById("journal-date-from")?.value || "";
    const to = document.getElementById("journal-date-to")?.value || "";
    if (from) visitors = visitors.filter((v) => (v.visitDate || "") >= from);
    if (to) visitors = visitors.filter((v) => (v.visitDate || "") <= to);

    visitors.sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));

    const header = ["Date", "Entrée", "Sortie", "Durée", "Nom", "Prénom", "Société", "Département", "Organisation hôte"];

    const rows = visitors.map((v) => {
      const date = v.visitDate
        ? new Date(v.visitDate + "T00:00:00").toLocaleDateString("fr-FR")
        : "";
      return [
        date,
        v.entry || "",
        v.exit || "",
        calcDuration(v.entry, v.exit) || "",
        v.lastname || "",
        v.firstname || "",
        v.company || "",
        v.dept || "",
        v.hostOrg || ""
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";");
    });

    const csv = "\uFEFF" + [header.join(";")].concat(rows).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.download = `journal-visites-${todayISO()}.csv`;
    a.href = URL.createObjectURL(blob);
    a.click();

    showToast(`Export CSV ✅ (${visitors.length} lignes)`);
  } catch (err) {
    console.error("[journal] exportCSV:", err);
    showToast("Erreur export CSV", "error");
  }
}

/* ============================================================
   EXPORT PDF
   ============================================================ */

export async function exportJournalPDF() {
  try {
    let visitors = await store.getAll("visitors");

    const from = document.getElementById("journal-date-from")?.value || "";
    const to = document.getElementById("journal-date-to")?.value || "";
    if (from) visitors = visitors.filter((v) => (v.visitDate || "") >= from);
    if (to) visitors = visitors.filter((v) => (v.visitDate || "") <= to);

    visitors.sort((a, b) => (b.visitDate || "").localeCompare(a.visitDate || ""));

    const periodLabel = (from || to)
      ? `${from || "début"} → ${to || "fin"}`
      : "Tous les enregistrements";

    const rows = visitors.map((v) => {
      const dur = calcDuration(v.entry, v.exit) || "—";
      const date = v.visitDate
        ? new Date(v.visitDate + "T00:00:00").toLocaleDateString("fr-FR")
        : "—";
      return `
        <tr>
          <td>${escapeHTML(date)}</td>
          <td style="color:#0a7a1e;font-weight:700;font-family:monospace;">${escapeHTML(v.entry || "—")}</td>
          <td style="color:#c00;font-weight:700;font-family:monospace;">${escapeHTML(v.exit || "—")}</td>
          <td style="font-weight:600;">${escapeHTML(dur)}</td>
          <td><strong>${escapeHTML((v.lastname || "").toUpperCase())} ${escapeHTML(v.firstname || "")}</strong></td>
          <td>${escapeHTML(v.company || "—")}</td>
          <td>${escapeHTML(v.dept || "—")}</td>
          <td>${escapeHTML(v.hostOrg || "—")}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Journal des visites</title>
      <style>
        body { font-family: Arial, sans-serif; font-size: 10px; color: #1a1a1a; margin: 20px; }
        h1 { font-size: 15px; color: #e65100; margin-bottom: 2px; }
        p.sub { font-size: 9px; color: #666; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #e65100; color: white; padding: 6px 8px; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 5px 8px; border-bottom: 1px solid #eee; }
        tr:nth-child(even) td { background: #fff7f0; }
      </style>
    </head><body>
      <h1>📋 Journal des visites</h1>
      <p class="sub">Période : ${escapeHTML(periodLabel)} &nbsp;|&nbsp; ${visitors.length} visite(s) &nbsp;|&nbsp; Généré le ${new Date().toLocaleDateString("fr-FR")}</p>
      <table>
        <thead>
          <tr>
            <th>Date</th><th>Entrée</th><th>Sortie</th><th>Durée</th>
            <th>Visiteur</th><th>Société</th><th>Département</th><th>Hôte</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </body></html>`;

    const win = window.open("", "_blank", "width=950,height=650");
    if (!win) { showToast("Autorisez les popups pour exporter en PDF", "error"); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
  } catch (err) {
    console.error("[journal] exportPDF:", err);
    showToast("Erreur export PDF", "error");
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

export const journalAPI = {
  init: initJournal,
  load: loadJournal,
  setFilter: setJournalFilter,
  exportCSV: exportJournalCSV,
  exportPDF: exportJournalPDF
};
