# Daily Quest

Application de gamification du quotidien : une liste de points à valider chaque jour,
et un historique illimité consultable par semaine, mois ou année.

Aucune dépendance, aucun serveur, aucun compte : trois fichiers statiques et un stockage
local (`localStorage`). Elle s'installe sur l'écran d'accueil d'un iPhone et fonctionne
hors-ligne.

---

## Les deux onglets

### 1. Aujourd'hui

- La journée en cours ; les flèches `‹` / `›` de l'en-tête servent les deux onglets
  (jour ici, période dans l'historique). Impossible d'aller au-delà d'aujourd'hui.
- Un anneau de progression (`8 / 12`, `67 %`) et trois indicateurs de jeu :
  **série** (🔥 jours consécutifs au-dessus de l'objectif), **record** (meilleure série
  historique) et **niveau** (1 XP par point validé, un niveau tous les 50 XP).
- **Un seul type de point : oui ou non.** Chaque ligne porte deux boutons, `✓` et `✕` ;
  un appui ailleurs sur la ligne vaut `✓`. Réappuyer sur la réponse déjà donnée
  l'annule et remet le point en attente. Un objectif chiffré se met simplement dans
  l'intitulé (« Eau 3 L », « Marche 10 000 pas »).
- Quatre états, donc, et non deux : **oui** (ligne verte), **non** (ligne rouge),
  **en attente** (bordure pointillée, sur la journée en cours) et **oublié**
  (ligne jaune marquée d'un `?`).
- **À la fin de la journée, ce qui n'a pas été répondu devient un `?` jaune.** Ce n'est
  pas un « non » assumé, mais **c'est compté comme non accompli** dans tous les calculs :
  score du jour, moyennes, séries, XP. Rien n'est écrit dans les données — l'état se
  déduit de la date, si bien qu'un oubli reste rattrapable en revenant sur le jour.
  Une journée jamais ouverte n'est pas concernée : elle reste « non suivie » et ne
  pénalise ni la moyenne ni la série.
- Les lignes sont **compactées automatiquement** pour que toutes les habitudes tiennent
  à l'écran sans défilement (voir `ajusterDensite`), jusqu'à un plancher de 34 px.
- **Gérer mes habitudes** se trouve dans les réglages ⚙ : ajouter, renommer, archiver
  ou supprimer. L'ordre se change en **maintenant la poignée `≡`** et en faisant glisser
  la ligne ; la liste défile toute seule quand on approche du bord. L'éditeur enregistre en continu ; le bouton vert **Terminé** ne
  fait que refermer la fenêtre.

### 2. Historique

Trois modes, avec navigation vers les périodes passées — par les flèches `‹` / `›`
de l'en-tête ou en **balayant l'écran horizontalement** (vers la droite pour reculer,
vers la gauche pour revenir). Impossible d'aller au-delà de la période en cours : le
geste résiste au lieu d'avancer dans le vide.

En mode semaine, ce sont les **sept colonnes de jours qui coulissent sous le doigt**,
la colonne des libellés restant fixe comme repère. Les semaines voisines sont montées
d'avance, si bien que le mouvement suit le doigt ; au relâcher, la semaine atteinte se
pose et tout se recalcule — résumé, totaux par jour et « ce qui ressort ». La carte de
chaleur de l'année garde, elle, son propre défilement horizontal.

| Mode | Affichage |
|---|---|
| **Semaine** | Grille habitudes × 7 jours, les jours coulissant d'une semaine à l'autre : `✓` oui, `✕` non, `?` oublié, case vide sans réponse, plus le total par jour. |
| **Mois** | Calendrier coloré par taux de réussite ; un appui sur un jour l'ouvre dans l'onglet Aujourd'hui. |
| **Année** | Carte de chaleur des 365 jours (défilement horizontal) + moyenne par mois. |

Au-dessus, un **résumé** de la période (moyenne, jours à 100 %, jours suivis, points
validés). En dessous, **ce qui ressort** — trois enseignements calculés sur la période
affichée, et sur elle seule :

| | |
|---|---|
| 🥇 **La mieux tenue** | meilleur pourcentage de « oui » sur les jours suivis |
| 🔥 **Plus longue série** | plus grand nombre de jours consécutifs à « oui » |
| 🐢 **La moins réalisée** | pourcentage le plus faible |

À égalité, c'est la première habitude dans ton ordre d'affichage qui l'emporte.

---

## Les 12 points par défaut

Repris de la liste de départ, ajustés pour un suivi quotidien :

Tous se répondent par oui ou par non ; les objectifs chiffrés font partie de l'intitulé.

| | Point |
|---|---|
| 🚫 | Pas d'alcool |
| 😴 | Sommeil 8 h |
| 🧭 | Trouve un mentor |
| 💪 | Exercice |
| 👟 | Marche 10 000 pas |
| 🍽️ | Rien à manger après 22 h |
| 🥦 | Zéro aliment transformé |
| 📵 | Pas d'écrans après 21 h |
| 🛡️ | Loin des personnes toxiques |
| 📚 | Lecture 30 min |
| 💧 | Eau 3 L |
| 🧘 | Méditation 10 min |

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

- **Gérer mes habitudes** → ajout, renommage, ordre (glisser-déposer), archivage, suppression ;
- **Apparence** → `Auto` (suit le réglage du téléphone), `Clair` ou `Sombre` ;
- **Objectif** → pourcentage requis pour qu'une journée compte dans la série 🔥 ;
- **Exporter une sauvegarde** → fichier `daily-quest-AAAA-MM-JJ.json` ;
- **Importer une sauvegarde** → restaure l'ensemble (habitudes + historique) ;
- **Tout réinitialiser** → efface l'historique complet, les habitudes personnalisées
  (retour aux 12 points d'origine), l'objectif et le thème. Sans effet sur les fichiers
  déjà exportés. Irréversible.

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

### Publier une modification

Après toute modification de `index.html`, `styles.css` ou `app.js`, **trois valeurs
doivent porter le même numéro**, sans quoi l'app installée reste sur son ancienne copie :

1. `VERSION` dans `app.js` (affichée en bas des réglages) ;
2. `data-app` sur la balise `<html>` d'`index.html` ;
3. `CACHE` dans `sw.js`.

Puis `node tools/construire-fichier-unique.js` pour régénérer le fichier autonome.

Le service worker sert **une génération entière depuis un seul cache** : un `index.html`
ne peut donc jamais être servi avec l'`app.js` d'une autre version — ce panachage laissait
l'écran vide. Si une incohérence survient malgré tout, `verifierCoherence()` compare
`data-app` à `VERSION` au démarrage, purge caches et service worker, et recharge une fois ;
en dernier recours, un message avec un bouton « Réparer et recharger » remplace l'écran vide.

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
  "version": 2,
  "habitudes": [
    { "id": "h1", "nom": "Pas d'alcool", "emoji": "🚫", "type": "bool", "archivee": false },
    { "id": "h11", "nom": "Eau 3 L", "emoji": "💧", "type": "bool", "archivee": false }
  ],
  "jours": {
    // true = oui, false = non, clé absente = sans réponse
    "2026-08-17": { "h1": true, "h11": false }
  },
  "reglages": { "objectif": 80, "theme": "auto" } // % pour la série, apparence
}
```

Une journée absente de `jours` est considérée comme **non suivie** (grise dans l'historique),
et non comme un échec — elle ne pénalise pas les moyennes. Dès qu'une réponse y est
enregistrée, la journée est suivie.

Une clé absente se lit différemment selon la date : « pas encore répondu » sur la journée
en cours, « oublié » (`?`) sur une journée écoulée et suivie. Rien n'est écrit à la
clôture, l'état se déduit du calendrier — c'est ce qui permet de revenir corriger un
oubli sans avoir à distinguer un « non » automatique d'un « non » voulu.

Les sauvegardes en `version: 1` (habitudes de type `quant`) sont migrées au chargement
comme à l'import : l'objectif chiffré rejoint l'intitulé et chaque valeur passée est relue
avec la règle d'alors — objectif atteint = `true`, sinon `false`.

Archiver une habitude la retire de la journée en cours **en conservant** ses données passées ;
la supprimer efface aussi son historique.
