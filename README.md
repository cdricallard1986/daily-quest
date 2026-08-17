# Daily Quest

Application de gamification du quotidien : une liste de points à valider chaque jour,
et un historique illimité consultable par semaine, mois ou année.

Aucune dépendance, aucun serveur, aucun compte : trois fichiers statiques et un stockage
local (`localStorage`). Elle s'installe sur l'écran d'accueil d'un iPhone et fonctionne
hors-ligne.

---

## Les deux onglets

### 1. Aujourd'hui

- La journée en cours, avec navigation vers les jours précédents (`‹` / `›`) pour rattraper
  un oubli. Impossible d'aller au-delà d'aujourd'hui.
- Un anneau de progression (`8 / 12`, `67 %`) et trois indicateurs de jeu :
  **série** (🔥 jours consécutifs au-dessus de l'objectif), **record** (meilleure série
  historique) et **niveau** (1 XP par point validé, un niveau tous les 50 XP).
- Deux types de points :
  - **à cocher** — une pastille, on tape dessus (ex. « Pas d'alcool ») ;
  - **quantité** — un compteur `− / +` avec un objectif chiffré (ex. `10 000 pas`,
    `3 L`, `30 min`). Le point est validé dès que l'objectif est atteint, et une jauge
    montre la progression partielle. Un appui sur la valeur permet de saisir un chiffre exact.
- **Gérer mes habitudes** : ajouter, renommer, réordonner, archiver ou supprimer.

### 2. Historique

Trois modes, avec navigation vers les périodes passées :

| Mode | Affichage |
|---|---|
| **Semaine** | Grille habitudes × 7 jours : `✓` validé, `%` partiel, vide non fait, plus le total par jour. |
| **Mois** | Calendrier coloré par taux de réussite ; un appui sur un jour l'ouvre dans l'onglet Aujourd'hui. |
| **Année** | Carte de chaleur des 365 jours (défilement horizontal) + moyenne par mois. |

Chaque mode affiche en dessous un **résumé** (moyenne, jours à 100 %, jours suivis, points
validés) et le **détail par habitude** : nombre de jours validés, et pour les quantités le
**cumul** de la période et la **moyenne par jour** (ex. `1 144 064 pas` · `8 800 pas/j`).

---

## Les 12 points par défaut

Repris de la liste de départ, ajustés pour un suivi quotidien :

| | Point | Type |
|---|---|---|
| 🚫 | Pas d'alcool | à cocher |
| 😴 | Sommeil | 8 h |
| 🧭 | Trouve un mentor | à cocher |
| 💪 | Exercice | à cocher |
| 👟 | Marche | 10 000 pas |
| 🍽️ | Rien à manger après 22 h | à cocher |
| 🥦 | Zéro aliment transformé | à cocher |
| 📵 | Pas d'écrans après 21 h | à cocher |
| 🛡️ | Loin des personnes toxiques | à cocher |
| 📚 | Lecture | 30 min |
| 💧 | Eau | 3 L |
| 🧘 | Méditation | 10 min |

Tout est modifiable depuis l'app : le nombre de points n'est pas limité à 12.

---

## Installation

### Sur iPhone (recommandé)

1. Publier le dossier en HTTPS — le plus simple : **GitHub Pages**
   (`Settings → Pages → Deploy from a branch`, branche `main`, dossier `/ (root)`).
2. Ouvrir l'URL dans **Safari**.
3. Bouton **Partager** → **Sur l'écran d'accueil**.

L'app s'ouvre alors en plein écran, sans barre d'adresse, et fonctionne sans réseau.

### En local

```bash
npx http-server -p 8080 .
# puis http://localhost:8080
```

Ouvrir `index.html` directement en `file://` fonctionne aussi, sans le mode hors-ligne.

---

## Sauvegarde des données

Les données vivent **sur l'appareil**, dans le `localStorage` du navigateur. Elles survivent
aux redémarrages, mais pas à une suppression des données de Safari ni à un changement de
téléphone.

Dans **Réglages ⚙** :

- **Apparence** → `Auto` (suit le réglage du téléphone), `Clair` ou `Sombre` ;
- **Objectif** → pourcentage requis pour qu'une journée compte dans la série 🔥 ;
- **Exporter une sauvegarde** → fichier `daily-quest-AAAA-MM-JJ.json` ;
- **Importer une sauvegarde** → restaure l'ensemble (habitudes + historique) ;
- **Tout réinitialiser** → repart des 12 points par défaut.

Le même export permet de passer d'un appareil à l'autre.

---

## Structure du projet

```
index.html                          structure et modales
styles.css                          thèmes clair / sombre, mobile-first
app.js                              état, calculs et rendu (aucune dépendance)
manifest.webmanifest                métadonnées PWA
sw.js                               service worker (hors-ligne)
daily-quest-autonome.html           l'app en un seul fichier (généré)
icons/                              icônes générées
tools/generer-icones.js             régénère les PNG
tools/construire-fichier-unique.js  régénère le fichier autonome
```

Après toute modification de `index.html`, `styles.css` ou `app.js` : incrémenter
`VERSION` dans `app.js` (affichée dans les réglages) et `CACHE` dans `sw.js`, puis
lancer `node tools/construire-fichier-unique.js`. Sans ces bumps, les appareils déjà
installés continuent de servir leur copie locale.

### Thème clair / sombre

`styles.css` n'utilise aucune couleur en dur hors des palettes : tout passe par
des variables définies dans trois blocs — `:root` (clair, défaut),
`@media (prefers-color-scheme: dark)` (mode Auto) et `:root[data-theme="dark"]`
(sombre forcé depuis l'app). **Les deux blocs sombres doivent rester
synchronisés.** Les jetons `--or-texte`, `--vert-texte` et `--rouge-texte` sont
des variantes assombries réservées aux libellés, les teintes vives manquant de
contraste sur fond blanc.

Le choix (`auto` / `clair` / `sombre`) vit dans `reglages.theme`. Un court script
en `<head>` l'applique avant le premier rendu pour éviter un flash blanc au
lancement en mode sombre.

### Format des données

```jsonc
{
  "version": 1,
  "habitudes": [
    { "id": "h1", "nom": "Pas d'alcool", "emoji": "🚫", "type": "bool", "archivee": false },
    { "id": "h11", "nom": "Eau", "emoji": "💧", "type": "quant",
      "cible": 3, "unite": "L", "pas": 0.25, "archivee": false }
  ],
  "jours": {
    "2026-08-17": { "h1": true, "h11": 2.5 }   // booléen ou nombre selon le type
  },
  "reglages": { "objectif": 80, "theme": "auto" } // % pour la série, apparence
}
```

Une journée absente de `jours` est considérée comme **non suivie** (grise dans l'historique),
et non comme un échec — elle ne pénalise pas les moyennes.

Archiver une habitude la retire de la journée en cours **en conservant** ses données passées ;
la supprimer efface aussi son historique.
