/**
 * Tests unitaires pour le module metiers.js
 * Lance avec : npm run test
 */

import { describe, it, expect } from "vitest";

import {
  METIERS,
  DEFAULT_METIER,
  getMetier,
  getMetierLabel,
  getMetierIcon,
  isValidMetier,
  normalizeMetier,
  getMetierValues,
  getMetierLabels,
  buildMetierOptions,
  buildMetierBadge,
  buildMetierFilterOptions,
  countByMetier,
  getMostFrequentMetier,
  isFeminine,
  accordMetier
} from "../src/modules/vendeur/metiers.js";

/* ============================================================
   STRUCTURE
   ============================================================ */
describe("METIERS", () => {
  it("expose exactement 5 métiers", () => {
    expect(METIERS).toHaveLength(5);
  });

  it("contient les valeurs attendues", () => {
    const values = METIERS.map((m) => m.value);
    expect(values).toEqual([
      "vendeur", "vendeuse", "animateur", "animatrice", "merchandiser"
    ]);
  });

  it("chaque métier a les propriétés requises", () => {
    METIERS.forEach((m) => {
      expect(m).toHaveProperty("value");
      expect(m).toHaveProperty("label");
      expect(m).toHaveProperty("icon");
      expect(m).toHaveProperty("genre");
    });
  });

  it("est immuable (Object.freeze)", () => {
    expect(Object.isFrozen(METIERS)).toBe(true);
  });
});

/* ============================================================
   FONCTIONS DE LECTURE
   ============================================================ */
describe("getMetier / getMetierLabel / getMetierIcon", () => {
  it("retourne le bon libellé pour chaque métier", () => {
    expect(getMetierLabel("vendeur")).toBe("Vendeur");
    expect(getMetierLabel("vendeuse")).toBe("Vendeuse");
    expect(getMetierLabel("animateur")).toBe("Animateur");
    expect(getMetierLabel("animatrice")).toBe("Animatrice");
    expect(getMetierLabel("merchandiser")).toBe("Merchandiser");
  });

  it("fallback sur Vendeur si valeur inconnue", () => {
    expect(getMetierLabel("xyz")).toBe("Vendeur");
    expect(getMetierLabel("")).toBe("Vendeur");
    expect(getMetierLabel(null)).toBe("Vendeur");
  });

  it("retourne l'icône correcte", () => {
    expect(getMetierIcon("vendeur")).toBe("🛒");
    expect(getMetierIcon("animatrice")).toBe("🎤");
    expect(getMetierIcon("merchandiser")).toBe("📦");
  });

  it("getMetier retourne null pour valeur invalide", () => {
    expect(getMetier("xyz")).toBeNull();
    expect(getMetier("vendeuse")).not.toBeNull();
  });
});

/* ============================================================
   VALIDATION
   ============================================================ */
describe("isValidMetier / normalizeMetier", () => {
  it("valide les valeurs correctes", () => {
    expect(isValidMetier("vendeur")).toBe(true);
    expect(isValidMetier("merchandiser")).toBe(true);
  });

  it("rejette les valeurs invalides", () => {
    expect(isValidMetier("xyz")).toBe(false);
    expect(isValidMetier("")).toBe(false);
    expect(isValidMetier(null)).toBe(false);
    expect(isValidMetier(undefined)).toBe(false);
  });

  it("normalise vers le défaut", () => {
    expect(normalizeMetier("xyz")).toBe(DEFAULT_METIER);
    expect(normalizeMetier("vendeuse")).toBe("vendeuse");
  });
});

/* ============================================================
   LISTES
   ============================================================ */
describe("getMetierValues / getMetierLabels", () => {
  it("retourne 5 valeurs", () => {
    expect(getMetierValues()).toHaveLength(5);
  });

  it("retourne 5 libellés", () => {
    expect(getMetierLabels()).toHaveLength(5);
    expect(getMetierLabels()).toContain("Vendeuse");
    expect(getMetierLabels()).toContain("Merchandiser");
  });
});

/* ============================================================
   GÉNÉRATION HTML
   ============================================================ */
describe("buildMetierOptions", () => {
  it("génère 5 options sans option vide", () => {
    const html = buildMetierOptions();
    const count = (html.match(/<option/g) || []).length;
    expect(count).toBe(5);
  });

  it("marque la bonne option comme sélectionnée", () => {
    const html = buildMetierOptions("animatrice");
    expect(html).toContain('value="animatrice" selected');
  });

  it("ajoute une option vide si demandé", () => {
    const html = buildMetierOptions("", { withEmpty: true });
    const count = (html.match(/<option/g) || []).length;
    expect(count).toBe(6);
  });

  it("affiche l'icône par défaut", () => {
    const html = buildMetierOptions("vendeur");
    expect(html).toContain("🛒 Vendeur");
  });

  it("n'affiche pas l'icône si withIcon=false", () => {
    const html = buildMetierOptions("vendeur", { withIcon: false });
    expect(html).toContain(">Vendeur<");
    expect(html).not.toContain("🛒");
  });
});

describe("buildMetierBadge", () => {
  it("génère un badge avec la bonne classe", () => {
    const html = buildMetierBadge("animatrice");
    expect(html).toContain("metier-animatrice");
    expect(html).toContain("Animatrice");
  });

  it("accepte withIcon=false", () => {
    const html = buildMetierBadge("vendeur", { withIcon: false });
    expect(html).not.toContain("🛒");
    expect(html).toContain("Vendeur");
  });
});

describe("buildMetierFilterOptions", () => {
  it("ajoute 'Tous les métiers' par défaut", () => {
    const html = buildMetierFilterOptions();
    expect(html).toContain("Tous les métiers");
    const count = (html.match(/<option/g) || []).length;
    expect(count).toBe(6);
  });

  it("marque la sélection courante", () => {
    const html = buildMetierFilterOptions("vendeuse");
    expect(html).toContain('value="vendeuse" selected');
  });
});

/* ============================================================
   STATISTIQUES
   ============================================================ */
describe("countByMetier", () => {
  it("compte correctement", () => {
    const vendeurs = [
      { metier: "vendeur" }, { metier: "vendeur" }, { metier: "vendeuse" },
      { metier: "animateur" }, { metier: "merchandiser" }, { metier: "vendeur" }
    ];
    const counts = countByMetier(vendeurs);
    expect(counts.vendeur).toBe(3);
    expect(counts.vendeuse).toBe(1);
    expect(counts.animateur).toBe(1);
    expect(counts.animatrice).toBe(0);
    expect(counts.merchandiser).toBe(1);
  });

  it("gère les métiers invalides (fallback vendeur)", () => {
    const counts = countByMetier([{ metier: "xyz" }]);
    expect(counts.vendeur).toBe(1);
  });

  it("retourne zéro partout si liste vide", () => {
    const counts = countByMetier([]);
    expect(Object.values(counts).every((v) => v === 0)).toBe(true);
  });
});

describe("getMostFrequentMetier", () => {
  it("retourne le plus fréquent", () => {
    const vendeurs = [
      { metier: "vendeuse" }, { metier: "vendeuse" },
      { metier: "vendeuse" }, { metier: "animateur" }
    ];
    expect(getMostFrequentMetier(vendeurs)).toBe("vendeuse");
  });

  it("retourne null si vide", () => {
    expect(getMostFrequentMetier([])).toBeNull();
  });
});

/* ============================================================
   GENRE
   ============================================================ */
describe("isFeminine", () => {
  it("identifie les métiers féminins", () => {
    expect(isFeminine("vendeuse")).toBe(true);
    expect(isFeminine("animatrice")).toBe(true);
  });

  it("identifie les métiers masculins/neutres", () => {
    expect(isFeminine("vendeur")).toBe(false);
    expect(isFeminine("animateur")).toBe(false);
    expect(isFeminine("merchandiser")).toBe(false);
  });
});

describe("accordMetier", () => {
  it("accorde correctement", () => {
    expect(accordMetier("vendeuse", "Expérimenté", "Expérimentée")).toBe("Expérimentée");
    expect(accordMetier("vendeur", "Expérimenté", "Expérimentée")).toBe("Expérimenté");
  });
});
