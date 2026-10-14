/**
 * ============================================================
 *  BADGEMASTER PRO — Paramètres
 * ============================================================
 *  Configuration de l'application :
 *   - Nom organisation + logo par défaut
 *   - Qualité d'impression
 *   - Export / Import JSON complet
 *   - Réinitialisation des données
 *   - Info base de données
 * ============================================================
 */

import { store, STORES } from "../db/idb.js";
import { showToast }     from "../ui/toast.js";
import { showConfirm }   from "../ui/confirm.js";
import { escapeHTML }    from "../ui/util.js";

/* ============================================================
   ÉTAT
   ============================================================ */
let currentLogoSrc = "";

/* ============================================================
   INIT
   ============================================================ */

export function initSettings() {
  attachInputs();
  loadSettings();
}

function attachInputs() {
  // Champs qui marquent "dirty"
  ["settings-org-name", "settings-print-quality", "settings-badges-per-page"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => {/* peut déclencher une indication */});
    });

  // Logo upload
  const logoInput = document.getElementById("settings-logo-input");
  if (logoInput) {
    logoInput.addEventListener("change", handleLogoUpload);
  }
}

/* ============================================================
   CHARGEMENT / SAUVEGARDE
   ============================================================ */

export async function loadSettings() {
  try {
    const settings = await store.get("settings", "app");
    const s = settings?.value || {};

    setValue("settings-org-name", s.orgName || "");
    setValue("settings-print-quality", s.printQuality || "high");
    setValue("settings-badges-per-page", s.badgesPerPage || "2");

    currentLogoSrc = s.logo || "";

    const prev = document.getElementById("settings-logo-preview");
    if (prev) {
      prev.innerHTML = currentLogoSrc
        ? `<img src="${currentLogoSrc}" style="width:100%;height:100%;object-fit:contain;">`
        : '<span style="font-size:0.75rem;color:var(--c-text-muted);">Logo</span>';
    }

    updateDbInfo();
  } catch (err) {
    console.error("[settings] loadSettings:", err);
  }
}

export async function saveSettings() {
  try {
    const orgName = (document.getElementById("settings-org-name")?.value || "").trim();
    const printQuality = document.getElementById("settings-print-quality")?.value || "high";
    const badgesPerPage = document.getElementById("settings-badges-per-page")?.value || "2";

    const settings = {
      key: "app",
      value: {
        orgName,
        logo: currentLogoSrc,
        printQuality,
        badgesPerPage
      }
    };

    await store.put("settings", settings);
    showToast("Paramètres enregistrés ✅");
  } catch (err) {
    console.error("[settings] saveSettings:", err);
    showToast("Erreur lors de l'enregistrement", "error");
  }
}

/* ============================================================
   LOGO
   ============================================================ */

async function handleLogoUpload(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  try {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;

      // Compresse en gardant la transparence PNG
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(300 / img.width, 300 / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);

        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        currentLogoSrc = canvas.toDataURL("image/png");

        const prev = document.getElementById("settings-logo-preview");
        if (prev) prev.innerHTML = `<img src="${currentLogoSrc}" style="width:100%;height:100%;object-fit:contain;">`;

        showToast("Logo chargé — cliquez Enregistrer");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  } catch (err) {
    console.error("[settings] logo upload:", err);
  }
}

export function clearSettingsLogo() {
  currentLogoSrc = "";
  const prev = document.getElementById("settings-logo-preview");
  if (prev) {
    prev.innerHTML = '<span style="font-size:0.75rem;color:var(--c-text-muted);">Logo</span>';
  }
  showToast("Logo supprimé — cliquez Enregistrer");
}

/* ============================================================
   EXPORT / IMPORT JSON
   ============================================================ */

export async function exportAllData() {
  try {
    const [events, badges, imports, visitors, settings] = await Promise.all([
      store.getAll("events"),
      store.getAll("badges"),
      store.getAll("imports"),
      store.getAll("visitors"),
      store.getAll("settings")
    ]);

    const data = {
      version: "7.0.0",
      exportedAt: new Date().toISOString(),
      events,
      badges,
      imports,
      visitors,
      settings
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.download = `badgemaster-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.href = URL.createObjectURL(blob);
    a.click();

    showToast(`Export complet ✅ (${badges.length} badges, ${visitors.length} visiteurs)`);
  } catch (err) {
    console.error("[settings] exportAllData:", err);
    showToast("Erreur export", "error");
  }
}

export async function importAllData(event) {
  const file = event.target?.files?.[0];
  if (!file) return;

  const ok = await showConfirm({
    title: "Restaurer les données ?",
    message: "Les données actuelles seront complétées avec celles du fichier. Aucune donnée existante ne sera supprimée.",
    okText: "Restaurer",
    type: "info",
    icon: "📥"
  });

  if (!ok) {
    event.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    let count = 0;

    if (data.events?.length) {
      for (const ev of data.events) {
        const { id, ...rest } = ev;
        await store.add("events", rest);
        count++;
      }
    }

    if (data.badges?.length) {
      for (const b of data.badges) {
        const { id, ...rest } = b;
        await store.add("badges", rest);
        count++;
      }
    }

    if (data.visitors?.length) {
      for (const v of data.visitors) {
        const { id, ...rest } = v;
        await store.add("visitors", rest);
        count++;
      }
    }

    if (data.settings?.length) {
      for (const s of data.settings) {
        await store.put("settings", s);
      }
    }

    showToast(`Import réussi ✅ (${count} enregistrements)`);
    document.dispatchEvent(new CustomEvent("data:refresh"));
    loadSettings();
  } catch (err) {
    console.error("[settings] importAllData:", err);
    showToast("Erreur lors de l'import : " + err.message, "error");
  } finally {
    event.target.value = "";
  }
}

/* ============================================================
   RESET
   ============================================================ */

export async function clearAllData() {
  const ok = await showConfirm({
    title: "Effacer toutes les données ?",
    message: "Événements, badges, visiteurs et imports seront définitivement supprimés. Cette action est IRRÉVERSIBLE.",
    okText: "Tout effacer",
    type: "danger",
    icon: "💥"
  });

  if (!ok) return;

  const confirm2 = await showConfirm({
    title: "Confirmation finale",
    message: "Êtes-vous VRAIMENT sûr ? Aucune récupération n'est possible. Exportez d'abord une sauvegarde.",
    okText: "Je confirme",
    type: "danger",
    icon: "⚠️"
  });

  if (!confirm2) return;

  try {
    await Promise.all([
      store.clear("events"),
      store.clear("badges"),
      store.clear("imports"),
      store.clear("visitors")
    ]);

    showToast("Toutes les données ont été effacées");
    document.dispatchEvent(new CustomEvent("data:refresh"));
  } catch (err) {
    console.error("[settings] clearAllData:", err);
    showToast("Erreur lors de l'effacement", "error");
  }
}

/* ============================================================
   DB INFO
   ============================================================ */

async function updateDbInfo() {
  const el = document.getElementById("settings-db-info");
  if (!el) return;

  try {
    const [events, badges, visitors, imports] = await Promise.all([
      store.count("events"),
      store.count("badges"),
      store.count("visitors"),
      store.count("imports")
    ]);

    el.textContent = `Événements: ${events} · Badges: ${badges} · Visiteurs: ${visitors} · Imports: ${imports}`;
  } catch (err) {
    el.textContent = "Erreur lecture base";
  }
}

/* ============================================================
   HELPERS
   ============================================================ */

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

/* ============================================================
   API
   ============================================================ */

export const settingsAPI = {
  init: initSettings,
  load: loadSettings,
  save: saveSettings,
  clearLogo: clearSettingsLogo,
  exportData: exportAllData,
  importData: importAllData,
  clearAll: clearAllData
};
