# 🏷️ BadgeMaster Pro — v7.0

Application web professionnelle de création et gestion de badges d'identification.
Fonctionne entièrement dans le navigateur (PWA), sans serveur.

## ✨ Modules

| Module | Description |
|--------|-------------|
| 🏠 Tableau de bord | Statistiques temps réel (badges, événements, visiteurs) |
| 🎪 Événements | Création / édition / suppression + compteurs de badges |
| ✏️ Créer un badge | Aperçu live, photo, QR code, formats CR80/CR79/CR100/compact/custom |
| 📊 Import Excel | Création en masse via .xlsx (drag & drop + prévisualisation) |
| 📋 Tous les badges | Recherche, filtres, sélection multiple, impression A4, PDF |
| 🪪 Visiteurs | Enregistrement entrée/sortie + badge orange dédié |
| 🏷️ Vendeurs | Badge marque avec choix de **métier** (5 options) |
| 📋 Journal des visites | Stats temps réel, filtres date, export CSV / PDF |
| ⚙️ Paramètres | Organisation, logo, export/import JSON |

## 🎯 Nouveauté v7.0 — Métiers Vendeurs

La page **Badges Vendeurs** propose un **choix de métier** :

- 🛒 **Vendeur** / **Vendeuse**
- 🎤 **Animateur** / **Animatrice**
- 📦 **Merchandiser**

Le métier sélectionné s'affiche dynamiquement sur le badge (aperçu + impression + PNG).

**Source unique de vérité** : `src/modules/vendeur/metiers.js`

## 🚀 Installation

```bash
# 1. Cloner
git clone https://github.com/mtara555/badgemaster-pro.git
cd badgemaster-pro

# 2. Installer
npm install

# 3. Développement
npm run dev
# → http://localhost:5173/

# 4. Tests
npm run test

# 5. Build production
npm run build
```

## 🏗️ Architecture

```
badgemaster-pro/
├── index.html                    Point d'entrée HTML
├── manifest.json                 PWA manifest
├── sw.js                         Service Worker
├── vite.config.js                Config Vite + Vitest
├── package.json
│
├── src/
│   ├── main.js                   Point d'entrée JS
│   │
│   ├── modules/
│   │   ├── db/
│   │   │   ├── idb.js            Wrapper IndexedDB promisifié
│   │   │   └── schema.js         Migrations v1 → v4
│   │   ├── ui/
│   │   │   ├── util.js           Helpers
│   │   │   ├── toast.js          Notifications
│   │   │   ├── confirm.js        Dialogues de confirmation
│   │   │   ├── modal.js          Gestion modales
│   │   │   └── router.js         Navigation + hash
│   │   ├── events/events.js      Événements
│   │   ├── badge/
│   │   │   ├── preview.js        Aperçu + upload + QR
│   │   │   ├── list.js           Liste + impression A4
│   │   │   └── import.js         Import Excel
│   │   ├── visitor/visitor.js    Visiteurs
│   │   ├── vendeur/
│   │   │   ├── metiers.js        Source unique des métiers
│   │   │   ├── vendeur-badge.js  Renderer HTML badge
│   │   │   └── vendeur.js        Module complet
│   │   ├── journal/journal.js    Journal des visites
│   │   └── settings/settings.js  Paramètres
│   │
│   └── styles/
│       ├── tokens.css            Variables design
│       ├── base.css              Reset + layout
│       └── components/
│           ├── buttons.css
│           ├── cards.css
│           ├── forms.css
│           ├── modal.css
│           └── badges.css
│
└── tests/
    ├── metiers.test.js           30 tests métiers
    └── vendeur-badge.test.js     25 tests badge vendeur
```

## 💾 Stockage

Toutes les données sont stockées **localement** dans le navigateur via **IndexedDB** :

| Store | Contenu |
|-------|---------|
| `events` | Événements créés |
| `badges` | Badges standards + vendeurs |
| `imports` | Historique des imports Excel |
| `visitors` | Visiteurs (entrée/sortie) |
| `settings` | Préférences de l'application |

⚠️ **Exportez régulièrement une sauvegarde** depuis Paramètres → Export JSON.

## 🛠️ Technologies

| Dépendance | Usage |
|---|---|
| [Vite](https://vitejs.dev/) | Build + HMR |
| [Vitest](https://vitest.dev/) | Tests unitaires |
| [QRCode](https://github.com/soldair/node-qrcode) | Génération QR codes |
| [html2canvas](https://html2canvas.hertzen.com/) | Capture image |
| [jsPDF](https://github.com/parallax/jsPDF) | Génération PDF |
| [SheetJS](https://sheetjs.com/) | Import/Export Excel |
| **IndexedDB** | Base de données locale |
| **Service Worker** | Mode hors-ligne (PWA) |

## 📱 PWA

Installable sur mobile et desktop :
- **Desktop** : icône d'installation dans la barre d'adresse Chrome/Edge
- **iOS** : Partager → Sur l'écran d'accueil
- **Android** : Menu → Installer l'application

Fonctionne **hors-ligne** après le premier chargement.

## 🧪 Tests

```bash
npm run test          # Lance tous les tests
npm run test:watch    # Mode watch
npm run coverage      # Rapport de couverture
```

**55 tests unitaires** couvrant les modules critiques.

## 📄 Licence

MIT — Voir [LICENSE](./LICENSE)

---

**BadgeMaster Pro v7.0** — Édition professionnelle