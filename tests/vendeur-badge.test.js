/**
 * Tests unitaires pour vendeur-badge.js
 * Vérifie le rendu HTML du badge vendeur (métier dynamique, escape, logo).
 */

import { describe, it, expect } from "vitest";

import {
  buildVendeurBadgeHTML,
  extractMetierFromHTML,
  htmlContainsMetierLabel
} from "../src/modules/vendeur/vendeur-badge.js";

/* ============================================================
   DONNÉES DE TEST
   ============================================================ */
const baseVendeur = {
  id: 1,
  firstname: "Said",
  lastname: "BOUSSOUF",
  brandName: "TCL",
  metier: "vendeuse",
  logoBg: "white",
  showQR: true
};

/* ============================================================
   STRUCTURE DE BASE
   ============================================================ */
describe("buildVendeurBadgeHTML — structure", () => {
  it("retourne une string", () => {
    expect(typeof buildVendeurBadgeHTML(baseVendeur)).toBe("string");
  });

  it("contient la classe .badge-vendeur-exact", () => {
    const html = buildVendeurBadgeHTML(baseVendeur);
    expect(html).toContain("badge-vendeur-exact");
  });

  it("contient data-metier", () => {
    const html = buildVendeurBadgeHTML(baseVendeur);
    expect(html).toContain('data-metier="vendeuse"');
  });

  it("contient le nom complet", () => {
    const html = buildVendeurBadgeHTML(baseVendeur);
    expect(html).toContain("Said BOUSSOUF");
  });

  it("contient la marque", () => {
    const html = buildVendeurBadgeHTML(baseVendeur);
    expect(html).toContain("TCL");
  });
});

/* ============================================================
   MÉTIER DYNAMIQUE ⭐
   ============================================================ */
describe("buildVendeurBadgeHTML — métier dynamique", () => {
  it("affiche 'Vendeuse' pour métier vendeuse", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "vendeuse" });
    expect(html).toContain("Vendeuse");
    expect(html).not.toMatch(/bv-role[^>]*>Vendeur(?!se)/);
  });

  it("affiche 'Vendeur' pour métier vendeur", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "vendeur" });
    expect(html).toContain("Vendeur");
    expect(html).toContain('data-metier="vendeur"');
  });

  it("affiche 'Animateur' pour métier animateur", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "animateur" });
    expect(html).toContain("Animateur");
  });

  it("affiche 'Animatrice' pour métier animatrice", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "animatrice" });
    expect(html).toContain("Animatrice");
  });

  it("affiche 'Merchandiser' pour métier merchandiser", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "merchandiser" });
    expect(html).toContain("Merchandiser");
  });

  it("teste les 5 métiers en boucle", () => {
    const metiers = [
      { value: "vendeur", label: "Vendeur" },
      { value: "vendeuse", label: "Vendeuse" },
      { value: "animateur", label: "Animateur" },
      { value: "animatrice", label: "Animatrice" },
      { value: "merchandiser", label: "Merchandiser" }
    ];

    metiers.forEach(({ value, label }) => {
      const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: value });
      expect(html).toContain(`data-metier="${value}"`);
      expect(html).toContain(label);
    });
  });

  it("fallback sur Vendeur si métier invalide", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "xyz" });
    expect(html).toContain('data-metier="vendeur"');
    expect(html).toContain("Vendeur");
  });
});

/* ============================================================
   SÉCURITÉ (XSS)
   ============================================================ */
describe("buildVendeurBadgeHTML — sécurité", () => {
  it("échappe les balises <script>", () => {
    const html = buildVendeurBadgeHTML({
      ...baseVendeur,
      firstname: "<script>alert(1)</script>",
      lastname: "XSS"
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("échappe les guillemets", () => {
    const html = buildVendeurBadgeHTML({
      ...baseVendeur,
      firstname: 'Guil"lemets',
      brandName: "'Apostrophe'"
    });
    expect(html).not.toContain('Guil"lemets');
    expect(html).toContain("Guil&quot;lemets");
  });

  it("échappe les esperluettes", () => {
    const html = buildVendeurBadgeHTML({
      ...baseVendeur,
      firstname: "A & B"
    });
    expect(html).toContain("A &amp; B");
  });
});

/* ============================================================
   QR CODE
   ============================================================ */
describe("buildVendeurBadgeHTML — QR", () => {
  it("n'inclut pas le QR par défaut", () => {
    const html = buildVendeurBadgeHTML(baseVendeur);
    expect(html).not.toContain('class="bv-qr"');
  });

  it("inclut le QR si withQR=true", () => {
    const html = buildVendeurBadgeHTML(baseVendeur, { withQR: true });
    expect(html).toContain('class="bv-qr"');
  });

  it("respecte le paramètre qrId", () => {
    const html = buildVendeurBadgeHTML(baseVendeur, { withQR: true, qrId: "custom-qr" });
    expect(html).toContain('id="custom-qr"');
  });

  it("cache le QR si showQR=false", () => {
    const html = buildVendeurBadgeHTML(
      { ...baseVendeur, showQR: false },
      { withQR: true }
    );
    expect(html).not.toContain('class="bv-qr"');
  });
});

/* ============================================================
   MODES LOGO
   ============================================================ */
describe("buildVendeurBadgeHTML — modes logo", () => {
  it("affiche le placeholder si pas de logo", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, brandLogo: "" });
    expect(html).toContain("LOGO DU MARQUE");
  });

  it("mode white entoure le logo d'un carré blanc", () => {
    const html = buildVendeurBadgeHTML({
      ...baseVendeur,
      brandLogo: "data:image/png;base64,xxxx",
      logoBg: "white"
    });
    expect(html).toContain("background:#ffffff");
  });

  it("mode forceWhite applique un filtre invert", () => {
    const html = buildVendeurBadgeHTML({
      ...baseVendeur,
      brandLogo: "data:image/png;base64,xxxx",
      logoBg: "blue",
      logoWhite: true
    });
    expect(html).toContain("invert(1)");
  });
});

/* ============================================================
   HELPERS
   ============================================================ */
describe("extractMetierFromHTML / htmlContainsMetierLabel", () => {
  it("extrait la valeur data-metier", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "animatrice" });
    expect(extractMetierFromHTML(html)).toBe("animatrice");
  });

  it("retourne null si pas de data-metier", () => {
    expect(extractMetierFromHTML("<div>test</div>")).toBeNull();
  });

  it("détecte le bon libellé", () => {
    const html = buildVendeurBadgeHTML({ ...baseVendeur, metier: "merchandiser" });
    expect(htmlContainsMetierLabel(html, "merchandiser")).toBe(true);
    expect(htmlContainsMetierLabel(html, "vendeuse")).toBe(false);
  });
});
