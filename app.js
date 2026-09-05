/* ══════════════════════════════════════════════════════════════
   Daily Quest — logique de l'application
   Données 100 % locales (localStorage), historique illimité.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ─────────────── Constantes ─────────────── */

  /* Affichée dans les réglages : permet de vérifier d'un coup d'œil quelle
     version tourne réellement sur l'appareil. À incrémenter à chaque
     déploiement, en même temps que CACHE dans sw.js. */
  const VERSION = '2026.09.05-10';

  const CLE_STOCKAGE = 'dq.v1';
  /* v2 : abandon des quantités, chaque point se répond par oui ou par non. */
  const VERSION_DONNEES = 2;
  const CLE_BROUILLON = 'dq.brouillon';
  const XP_PAR_NIVEAU = 50;

  const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin',
    'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

  /* Chaque point se répond par oui ou par non : l'objectif chiffré, quand il
     y en a un, fait partie de l'intitulé — c'est lui qui rend la réponse
     évidente au moment de valider. */
  const HABITUDES_DEFAUT = [
    { nom: "Pas d'alcool", emoji: '🚫' },
    { nom: 'Sommeil 8 h', emoji: '😴' },
    { nom: 'Trouve un mentor', emoji: '🧭' },
    { nom: 'Exercice', emoji: '💪' },
    { nom: 'Marche 10 000 pas', emoji: '👟' },
    { nom: 'Rien à manger après 22 h', emoji: '🍽️' },
    { nom: 'Zéro aliment transformé', emoji: '🥦' },
    { nom: "Pas d'écrans après 21 h", emoji: '📵' },
    { nom: 'Loin des personnes toxiques', emoji: '🛡️' },
    { nom: 'Lecture 30 min', emoji: '📚' },
    { nom: 'Eau 3 L', emoji: '💧' },
    { nom: 'Méditation 10 min', emoji: '🧘' }
  ];

  /* ─────────────── Utilitaires de date ─────────────── */

  const pad = (n) => String(n).padStart(2, '0');

  function cleDe(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function dateDe(cle) {
    const [a, m, j] = cle.split('-').map(Number);
    return new Date(a, m - 1, j);
  }
  function aujourdHui() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function ajouterJours(d, n) {
    const c = new Date(d);
    c.setDate(c.getDate() + n);
    c.setHours(0, 0, 0, 0);
    return c;
  }
  function debutSemaine(d) {
    const c = new Date(d);
    c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
    c.setHours(0, 0, 0, 0);
    return c;
  }
  function memeJour(a, b) {
    return cleDe(a) === cleDe(b);
  }
  function numeroSemaine(d) {
    const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    c.setDate(c.getDate() + 3 - ((c.getDay() + 6) % 7));
    const premier = new Date(c.getFullYear(), 0, 4);
    return 1 + Math.round(((c - premier) / 86400000 - 3 + ((premier.getDay() + 6) % 7)) / 7);
  }

  /* ─────────────── Formatage ─────────────── */

  function fmt(n) {
    if (!isFinite(n)) return '0';
    return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
  }
  function majuscule(texte) {
    return texte ? texte.charAt(0).toUpperCase() + texte.slice(1) : texte;
  }
  function fmtDateLongue(d) {
    return majuscule(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
  }

  /* ─────────────── État ─────────────── */

  let etat = null;

  function etatParDefaut() {
    return {
      version: VERSION_DONNEES,
      habitudes: HABITUDES_DEFAUT.map((h, i) => Object.assign({
        id: 'h' + (i + 1),
        type: 'bool',
        archivee: false
      }, h)),
      jours: {},
      reglages: { objectif: 80, theme: 'auto' }
    };
  }

  function charger() {
    try {
      const brut = localStorage.getItem(CLE_STOCKAGE);
      if (!brut) return etatParDefaut();
      const donnees = JSON.parse(brut);
      if (!donnees || !Array.isArray(donnees.habitudes)) return etatParDefaut();
      donnees.jours = donnees.jours || {};
      donnees.reglages = Object.assign({ objectif: 80, theme: 'auto' }, donnees.reglages);
      return migrer(donnees);
    } catch (e) {
      console.error('Lecture du stockage impossible', e);
      return etatParDefaut();
    }
  }

  /**
   * Amène une sauvegarde ancienne au format courant.
   * v1 → v2 : les habitudes « quantité » deviennent des oui / non. L'objectif
   * chiffré rejoint l'intitulé (« Eau » → « Eau 3 L ») et chaque valeur passée
   * est relue avec la règle d'alors : objectif atteint = oui, sinon non.
   */
  function migrer(donnees) {
    if (Number(donnees.version) >= VERSION_DONNEES) return donnees;

    const cibles = {};
    donnees.habitudes.forEach((h) => {
      if (h.type !== 'quant') { h.type = 'bool'; return; }
      cibles[h.id] = h.cible > 0 ? h.cible : 0;
      const suffixe = (h.cible != null ? fmt(h.cible) : '') + (h.unite ? ' ' + h.unite : '');
      if (suffixe.trim() && h.nom && h.nom.indexOf(suffixe.trim()) === -1) {
        h.nom = (h.nom + ' ' + suffixe.trim()).slice(0, 60);
      }
      h.type = 'bool';
      delete h.cible; delete h.unite; delete h.pas;
    });

    Object.keys(donnees.jours).forEach((cle) => {
      const jour = donnees.jours[cle];
      Object.keys(jour).forEach((id) => {
        const v = jour[id];
        if (typeof v === 'number') {
          const cible = cibles[id] || 0;
          jour[id] = cible > 0 ? v >= cible : v > 0;
        } else {
          jour[id] = v === true;
        }
      });
    });

    donnees.version = VERSION_DONNEES;
    return donnees;
  }

  function sauver() {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
      return true;
    } catch (e) {
      console.error('Écriture impossible', e);
      toast("Impossible d'enregistrer (stockage plein ?)", 'erreur');
      return false;
    }
  }

  function nouvelId() {
    return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /* ─────────────── Calculs métier ─────────────── */

  function habitudesActives() {
    return etat.habitudes.filter((h) => !h.archivee);
  }

  function valeursDu(cle) {
    return etat.jours[cle] || {};
  }

  /**
   * Réponse enregistrée pour une habitude : true (oui), false (non) ou
   * null (pas encore répondu). Ce troisième état est ce qui distingue
   * « j'ai raté » de « j'ai oublié de remplir ».
   */
  function reponse(h, valeurs) {
    const v = valeurs[h.id];
    return v === true ? true : v === false ? false : null;
  }

  function estFaite(h, valeurs) {
    return valeurs[h.id] === true;
  }

  /** La journée est-elle écoulée ? (clés ISO : la comparaison texte suffit) */
  function jourClos(cle) {
    return cle < cleDe(aujourdHui());
  }

  /**
   * État affiché d'un point : 'oui', 'non', 'oubli' ou 'attente'.
   * 'oubli' = journée écoulée et commencée, mais ce point n'a jamais reçu de
   * réponse. Il compte comme non accompli, sans être un « non » assumé —
   * d'où le point d'interrogation plutôt qu'une croix.
   */
  function etatPoint(h, cle) {
    const rep = reponse(h, valeursDu(cle));
    if (rep === true) return 'oui';
    if (rep === false) return 'non';
    return jourClos(cle) && jourRenseigne(cle) ? 'oubli' : 'attente';
  }

  /** Le jour contient-il au moins une réponse ? */
  function jourRenseigne(cle) {
    const v = etat.jours[cle];
    if (!v) return false;
    return Object.keys(v).some((k) => v[k] === true || v[k] === false);
  }

  function scoreJour(cle, habitudes) {
    const habs = habitudes || habitudesActives();
    const valeurs = valeursDu(cle);
    const total = habs.length;
    let faits = 0;
    habs.forEach((h) => { if (estFaite(h, valeurs)) faits++; });
    return { faits: faits, total: total, pct: total ? faits / total : 0, vide: !jourRenseigne(cle) };
  }

  function objectifAtteint(cle, habitudes) {
    const s = scoreJour(cle, habitudes);
    if (s.vide) return false;
    return s.pct * 100 >= etat.reglages.objectif;
  }

  function serieActuelle() {
    const habs = habitudesActives();
    let d = aujourdHui();
    // La journée en cours ne casse pas la série tant qu'elle n'est pas terminée.
    if (!objectifAtteint(cleDe(d), habs)) d = ajouterJours(d, -1);
    let n = 0;
    while (objectifAtteint(cleDe(d), habs)) {
      n++;
      d = ajouterJours(d, -1);
    }
    return n;
  }

  function meilleureSerie() {
    const cles = Object.keys(etat.jours).sort();
    if (!cles.length) return 0;
    const habs = habitudesActives();
    let d = dateDe(cles[0]);
    const fin = aujourdHui();
    let courante = 0;
    let record = 0;
    while (d <= fin) {
      if (objectifAtteint(cleDe(d), habs)) {
        courante++;
        if (courante > record) record = courante;
      } else {
        courante = 0;
      }
      d = ajouterJours(d, 1);
    }
    return record;
  }

  function xpTotal() {
    const habs = habitudesActives();
    return Object.keys(etat.jours).reduce((somme, cle) => somme + scoreJour(cle, habs).faits, 0);
  }

  /**
   * Agrège les données sur une liste de jours.
   * @returns {{jours:Array, moyenne:number, parfaits:number, suivis:number, points:number, parHabitude:Array}}
   */
  function agreger(cles) {
    const habs = habitudesActives();
    const jours = cles.map((c) => Object.assign({ cle: c }, scoreJour(c, habs)));
    const suivis = jours.filter((j) => !j.vide);
    const parfaits = suivis.filter((j) => j.pct >= 1).length;
    const points = jours.reduce((s, j) => s + j.faits, 0);
    const moyenne = suivis.length
      ? suivis.reduce((s, j) => s + j.pct, 0) / suivis.length
      : 0;

    const parHabitude = habs.map((h) => {
      let reussis = 0;
      let serie = 0;
      let courante = 0;
      cles.forEach((c) => {
        if (estFaite(h, valeursDu(c))) {
          reussis++;
          courante++;
          if (courante > serie) serie = courante;
        } else {
          // Tout ce qui n'est pas un oui casse la suite : non, oubli, ou
          // journée non suivie.
          courante = 0;
        }
      });
      const base = suivis.length || cles.length;
      return {
        habitude: h,
        reussis: reussis,
        serie: serie,
        base: base,
        pct: base ? reussis / base : 0
      };
    });

    return {
      jours: jours,
      moyenne: moyenne,
      parfaits: parfaits,
      suivis: suivis.length,
      points: points,
      parHabitude: parHabitude
    };
  }

  /* ─────────────── Écriture des valeurs ─────────────── */

  /**
   * Enregistre une réponse. `true` et `false` sont deux réponses distinctes
   * et toutes deux stockées ; seul `null` efface la réponse et remet
   * l'habitude en attente.
   */
  function definirValeur(cle, habitudeId, valeur) {
    const jour = etat.jours[cle] ? Object.assign({}, etat.jours[cle]) : {};
    if (valeur === null || valeur === undefined) delete jour[habitudeId];
    else jour[habitudeId] = valeur === true;
    if (Object.keys(jour).length === 0) delete etat.jours[cle];
    else etat.jours[cle] = jour;
    sauver();
  }


  /* ─────────────── Thème clair / sombre ─────────────── */

  const prefereSombre = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null;

  /** Thème réellement affiché, une fois « auto » résolu. */
  function themeEffectif() {
    const choix = etat.reglages.theme || 'auto';
    if (choix === 'clair') return 'light';
    if (choix === 'sombre') return 'dark';
    return prefereSombre && prefereSombre.matches ? 'dark' : 'light';
  }

  function appliquerTheme() {
    const choix = etat.reglages.theme || 'auto';
    const racine = document.documentElement;

    // En mode auto on retire l'attribut : la feuille de styles suit alors
    // le réglage du téléphone via prefers-color-scheme.
    if (choix === 'auto') racine.removeAttribute('data-theme');
    else racine.setAttribute('data-theme', themeEffectif());

    // La barre d'état iOS se teinte d'après cette balise.
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content',
        getComputedStyle(racine).getPropertyValue('--fond').trim() || '#f4f6f9');
    }
    const barre = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (barre) barre.setAttribute('content', themeEffectif() === 'dark' ? 'black-translucent' : 'default');
  }

  /* ─────────────── Vue : couleurs ─────────────── */

  function couleurJour(score) {
    if (score.vide) return 'var(--surface-2)';
    if (score.pct <= 0) return 'var(--surface-2)';
    const alpha = (0.18 + 0.72 * score.pct).toFixed(2);
    return 'rgba(var(--vert-rgb), ' + alpha + ')';
  }
  function texteSurJour(score) {
    return !score.vide && score.pct >= 0.6 ? 'var(--heat-fort)' : 'var(--texte-doux)';
  }

  /* ─────────────── DOM ─────────────── */

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.prototype.slice.call(document.querySelectorAll(sel));

  let jourCourant = aujourdHui();
  let suivaitAujourdHui = true;   // l'écran affiche-t-il la journée en cours ?
  let modeHistorique = 'semaine';
  let ancreHistorique = aujourdHui();

  /* ─────────────── Onglet Aujourd'hui ─────────────── */

  function rendreJour() {
    const cle = cleDe(jourCourant);
    const habs = habitudesActives();
    const valeurs = valeursDu(cle);
    const score = scoreJour(cle, habs);

    // En-tête de date
    $('#nav-titre').textContent = fmtDateLongue(jourCourant);
    const estAujourdHui = memeJour(jourCourant, aujourdHui());
    const hier = memeJour(jourCourant, ajouterJours(aujourdHui(), -1));
    $('#nav-sous-titre').textContent = estAujourdHui
      ? "Aujourd'hui · " + jourCourant.getFullYear()
      : hier ? 'Hier · ' + jourCourant.getFullYear() : String(jourCourant.getFullYear());
    $('#nav-suiv').disabled = estAujourdHui;
    suivaitAujourdHui = estAujourdHui;

    // Anneau de progression
    const circonference = 2 * Math.PI * 52;
    const jauge = $('#anneau-jauge');
    jauge.style.strokeDashoffset = String(circonference * (1 - score.pct));
    jauge.classList.toggle('complet', score.pct >= 1);
    $('#score-pct').textContent = Math.round(score.pct * 100) + '%';
    $('#score-frac').textContent = score.faits + ' / ' + score.total;

    // Statistiques
    const xp = xpTotal();
    const niveau = Math.floor(xp / XP_PAR_NIVEAU) + 1;
    const dansNiveau = xp % XP_PAR_NIVEAU;
    $('#stat-serie').textContent = serieActuelle();
    $('#stat-record').textContent = meilleureSerie();
    $('#stat-niveau').textContent = niveau;
    $('#barre-xp').style.width = (dansNiveau / XP_PAR_NIVEAU * 100) + '%';
    $('#xp-texte').textContent = dansNiveau + ' / ' + XP_PAR_NIVEAU + ' XP → niv. ' + (niveau + 1);

    // Liste des habitudes
    const liste = $('#liste-habitudes');
    liste.innerHTML = '';

    if (!habs.length) {
      const vide = document.createElement('li');
      vide.className = 'vide-message';
      vide.textContent = 'Aucune habitude active. Ajoutes-en depuis « Gérer mes habitudes ».';
      liste.appendChild(vide);
      return;
    }

    habs.forEach((h) => {
      const etatH = etatPoint(h, cle);
      const li = document.createElement('li');
      li.className = 'habitude ' + ({ oui: 'faite', non: 'ratee', oubli: 'oubliee' }[etatH] || 'attente');
      li.dataset.id = h.id;

      const emoji = document.createElement('div');
      emoji.className = 'hab-emoji';
      emoji.textContent = h.emoji || '•';
      li.appendChild(emoji);

      const nom = document.createElement('div');
      nom.className = 'hab-nom';
      nom.textContent = h.nom;
      li.appendChild(nom);

      // Journée écoulée sans réponse : un « ? » jaune. Les deux boutons
      // restent actifs, l'oubli se rattrape.
      if (etatH === 'oubli') {
        const marque = document.createElement('span');
        marque.className = 'hab-oubli';
        marque.textContent = '?';
        marque.title = 'Sans réponse — compté comme non accompli';
        li.appendChild(marque);
      }

      // Oui et non côte à côte : répondre « non » est un geste aussi
      // explicite que répondre « oui », c'est ce qui évite les oublis.
      const zone = document.createElement('div');
      zone.className = 'hab-reponse';
      zone.setAttribute('role', 'group');
      zone.setAttribute('aria-label', h.nom);
      zone.appendChild(boutonReponse(h, 'oui', etatH === 'oui'));
      zone.appendChild(boutonReponse(h, 'non', etatH === 'non'));
      li.appendChild(zone);

      liste.appendChild(li);
    });

    ajusterDensite();
  }

  function boutonReponse(h, action, actif) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hab-btn hab-' + action + (actif ? ' actif' : '');
    b.dataset.action = action;
    b.setAttribute('aria-pressed', String(actif));
    b.setAttribute('aria-label', (action === 'oui' ? 'Oui — ' : 'Non — ') + h.nom);
    b.textContent = action === 'oui' ? '✓' : '✕';
    return b;
  }


  /**
   * Règle la hauteur des lignes pour que toutes les habitudes tiennent
   * sans défilement. Sous un certain seuil on arrête de comprimer : mieux
   * vaut défiler que de rendre les lignes illisibles.
   */
  function ajusterDensite() {
    const liste = $('#liste-habitudes');
    const nb = liste.children.length;
    if (!nb) return;

    const ECART = 6;
    const haut = liste.getBoundingClientRect().top;
    const onglets = document.querySelector('.onglets').getBoundingClientRect().height;
    const dispo = window.innerHeight - haut - onglets - 10;
    const brut = Math.floor((dispo - ECART * (nb - 1)) / nb);
    const hauteur = Math.max(34, Math.min(58, brut));

    document.documentElement.style.setProperty('--h-ligne', hauteur + 'px');
  }

  function surClicHabitude(evt) {
    const li = evt.target.closest('.habitude');
    if (!li) return;

    const h = etat.habitudes.find((x) => x.id === li.dataset.id);
    if (!h) return;

    // Un appui hors des deux boutons vaut « oui » : c'est la réponse la plus
    // fréquente, et la ligne entière est une cible plus sûre au doigt.
    const bouton = evt.target.closest('[data-action]');
    const action = bouton ? bouton.dataset.action : 'oui';
    if (action !== 'oui' && action !== 'non') return;

    const cle = cleDe(jourCourant);
    const valeurs = valeursDu(cle);
    const actuelle = reponse(h, valeurs);
    const voulue = action === 'oui';

    // Réappuyer sur la réponse déjà donnée l'annule : on peut corriger
    // une erreur sans avoir à répondre l'inverse.
    definirValeur(cle, h.id, actuelle === voulue ? null : voulue);
    rendreJour();
  }

  /* ─────────────── Onglet Historique ─────────────── */

  function clesDePeriode() {
    const cles = [];
    if (modeHistorique === 'semaine') {
      const debut = debutSemaine(ancreHistorique);
      for (let i = 0; i < 7; i++) cles.push(cleDe(ajouterJours(debut, i)));
    } else if (modeHistorique === 'mois') {
      const a = ancreHistorique.getFullYear();
      const m = ancreHistorique.getMonth();
      const nb = new Date(a, m + 1, 0).getDate();
      for (let i = 1; i <= nb; i++) cles.push(cleDe(new Date(a, m, i)));
    } else {
      const a = ancreHistorique.getFullYear();
      let d = new Date(a, 0, 1);
      while (d.getFullYear() === a) {
        cles.push(cleDe(d));
        d = ajouterJours(d, 1);
      }
    }
    return cles;
  }

  function decalerPeriode(sens) {
    if (modeHistorique === 'semaine') {
      ancreHistorique = ajouterJours(ancreHistorique, 7 * sens);
    } else if (modeHistorique === 'mois') {
      ancreHistorique = new Date(ancreHistorique.getFullYear(), ancreHistorique.getMonth() + sens, 1);
    } else {
      ancreHistorique = new Date(ancreHistorique.getFullYear() + sens, 0, 1);
    }
    rendreHistorique();
  }

  function periodeEstCourante() {
    const auj = aujourdHui();
    if (modeHistorique === 'semaine') return memeJour(debutSemaine(ancreHistorique), debutSemaine(auj));
    if (modeHistorique === 'mois') {
      return ancreHistorique.getFullYear() === auj.getFullYear() &&
        ancreHistorique.getMonth() === auj.getMonth();
    }
    return ancreHistorique.getFullYear() === auj.getFullYear();
  }

  function rendreHistorique() {
    const cles = clesDePeriode();
    const donnees = agreger(cles);

    // Titre de période
    if (modeHistorique === 'semaine') {
      const debut = debutSemaine(ancreHistorique);
      const fin = ajouterJours(debut, 6);
      const memeMois = debut.getMonth() === fin.getMonth();
      $('#nav-titre').textContent = debut.getDate() + (memeMois ? '' : ' ' + MOIS_COURTS[debut.getMonth()]) +
        ' – ' + fin.getDate() + ' ' + MOIS_NOMS[fin.getMonth()];
      $('#nav-sous-titre').textContent = 'Semaine ' + numeroSemaine(debut) + ' · ' + fin.getFullYear();
    } else if (modeHistorique === 'mois') {
      $('#nav-titre').textContent = majuscule(MOIS_NOMS[ancreHistorique.getMonth()]) + ' ' + ancreHistorique.getFullYear();
      $('#nav-sous-titre').textContent = cles.length + ' jours';
    } else {
      $('#nav-titre').textContent = String(ancreHistorique.getFullYear());
      $('#nav-sous-titre').textContent = cles.length + ' jours';
    }
    $('#nav-suiv').disabled = periodeEstCourante();

    // Résumé
    $('#res-moyenne').textContent = Math.round(donnees.moyenne * 100) + '%';
    $('#res-parfaits').textContent = donnees.parfaits;
    $('#res-actifs').textContent = donnees.suivis;
    $('#res-total').textContent = fmt(donnees.points);

    // Contenu principal
    const boite = $('#hist-contenu');
    boite.innerHTML = '';
    if (modeHistorique === 'semaine') boite.appendChild(vueSemaine());
    else if (modeHistorique === 'mois') boite.appendChild(vueMois(cles));
    else boite.appendChild(vueAnnee(cles));

    // Ce qui ressort de la période
    rendreFaitsMarquants(donnees);
  }

  /**
   * Vue semaine : la colonne des libellés reste fixe, les sept jours vivent
   * dans une piste que l'on fait glisser d'une semaine à l'autre. Trois blocs
   * sont montés d'avance (précédente, affichée, suivante) pour que le
   * mouvement suive le doigt sans rien recalculer.
   */
  function vueSemaine() {
    const habs = habitudesActives();
    if (!habs.length) return messageVide('Aucune habitude active.');

    const carte = document.createElement('div');
    carte.className = 'carte semaine';

    const noms = document.createElement('div');
    noms.className = 'sem-noms';
    noms.appendChild(celluleSemaine('sem-tete', ''));
    habs.forEach((h) => {
      const ligne = celluleSemaine('sem-nom', '');
      const emoji = document.createElement('span');
      emoji.className = 'e';
      emoji.textContent = h.emoji || '•';
      ligne.appendChild(emoji);
      ligne.appendChild(document.createTextNode(h.nom));
      ligne.title = h.nom;
      noms.appendChild(ligne);
    });
    noms.appendChild(celluleSemaine('sem-total', 'Total'));
    carte.appendChild(noms);

    const fenetre = document.createElement('div');
    fenetre.className = 'sem-fenetre';
    const piste = document.createElement('div');
    piste.className = 'sem-piste';

    const debut = debutSemaine(ancreHistorique);
    piste.appendChild(blocSemaine(ajouterJours(debut, -7), habs));
    piste.appendChild(blocSemaine(debut, habs));
    // Pas de bloc pour une semaine à venir : on ne glisse pas vers le futur.
    if (!periodeEstCourante()) piste.appendChild(blocSemaine(ajouterJours(debut, 7), habs));

    fenetre.appendChild(piste);
    brancherGlisseSemaine(fenetre, piste);
    carte.appendChild(fenetre);
    return carte;
  }

  function celluleSemaine(classe, texte) {
    const el = document.createElement('div');
    el.className = classe;
    if (texte) el.textContent = texte;
    return el;
  }

  /** Les sept colonnes d'une semaine, à partir de son lundi. */
  function blocSemaine(debut, habs) {
    const bloc = document.createElement('div');
    bloc.className = 'sem-bloc';
    const auj = aujourdHui();

    for (let i = 0; i < 7; i++) {
      const d = ajouterJours(debut, i);
      const c = cleDe(d);
      const col = document.createElement('div');
      col.className = 'sem-col' + (memeJour(d, auj) ? ' aujourdhui' : '');

      const tete = celluleSemaine('sem-tete', JOURS_COURTS[i]);
      const num = document.createElement('small');
      num.textContent = d.getDate();
      tete.appendChild(num);
      col.appendChild(tete);

      habs.forEach((h) => {
        const boite = celluleSemaine('sem-case', '');
        const p = document.createElement('div');
        const etatH = etatPoint(h, c);
        if (etatH === 'oui') {
          p.className = 'pastille ok';
          p.textContent = '✓';
          p.title = h.nom + ' — oui';
        } else if (etatH === 'non') {
          p.className = 'pastille non';
          p.textContent = '✕';
          p.title = h.nom + ' — non';
        } else if (etatH === 'oubli') {
          p.className = 'pastille oubli';
          p.textContent = '?';
          p.title = h.nom + ' — sans réponse, compté comme non accompli';
        } else {
          p.className = 'pastille';
          p.title = h.nom + ' — pas encore répondu';
        }
        boite.appendChild(p);
        col.appendChild(boite);
      });

      const s = scoreJour(c, habs);
      col.appendChild(celluleSemaine('sem-total', s.vide ? '–' : s.faits + '/' + s.total));
      bloc.appendChild(col);
    }
    return bloc;
  }

  /* ─────────────── Glissement de la piste des jours ─────────────── */

  let glisseSemaine = null;

  function brancherGlisseSemaine(fenetre, piste) {
    fenetre.addEventListener('pointerdown', (evt) => {
      if (evt.pointerType === 'mouse' && evt.button !== 0) return;
      glisseSemaine = {
        fenetre: fenetre,
        piste: piste,
        x: evt.clientX,
        y: evt.clientY,
        largeur: fenetre.getBoundingClientRect().width,
        suivante: piste.children.length > 2,
        horizontal: null      // intention encore indécise
      };
    });
    fenetre.addEventListener('pointermove', surGlisseSemaine);
    fenetre.addEventListener('pointerup', finGlisseSemaine);
    fenetre.addEventListener('pointercancel', annulerGlisseSemaine);
  }

  function surGlisseSemaine(evt) {
    const g = glisseSemaine;
    if (!g) return;
    const dx = evt.clientX - g.x;
    const dy = evt.clientY - g.y;

    // Le premier mouvement décide : horizontal, on prend la main ; vertical,
    // on rend le geste à la page pour qu'elle défile normalement.
    if (g.horizontal === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      if (Math.abs(dx) <= Math.abs(dy)) { glisseSemaine = null; return; }
      g.horizontal = true;
      try { g.fenetre.setPointerCapture(evt.pointerId); } catch (e) { /* sans capture, ça marche encore */ }
      g.piste.classList.add('sans-transition');
    }
    g.piste.style.transform = 'translateX(' + (-g.largeur + retenue(dx, g)) + 'px)';
  }

  /** Vers le futur, le geste résiste au lieu d'avancer dans le vide. */
  function retenue(dx, g) {
    return dx < 0 && !g.suivante ? Math.max(dx / 4, -46) : dx;
  }

  function finGlisseSemaine(evt) {
    const g = glisseSemaine;
    glisseSemaine = null;
    if (!g || !g.horizontal) return;

    const dx = evt.clientX - g.x;
    const seuil = Math.min(70, g.largeur * 0.28);
    g.piste.classList.remove('sans-transition');

    if (dx > seuil) poserSemaine(g, 0, -1);
    else if (dx < -seuil && g.suivante) poserSemaine(g, -2 * g.largeur, 1);
    else g.piste.style.transform = '';        // retour en place
  }

  function annulerGlisseSemaine() {
    const g = glisseSemaine;
    glisseSemaine = null;
    if (!g || !g.horizontal) return;
    g.piste.classList.remove('sans-transition');
    g.piste.style.transform = '';
  }

  /** Termine le glissement, puis rebâtit la vue sur la semaine atteinte. */
  function poserSemaine(g, cible, sens) {
    g.piste.style.transform = 'translateX(' + cible + 'px)';
    setTimeout(() => decalerPeriode(sens), 190);   // durée de la transition CSS
  }

  function vueMois(cles) {
    const carte = document.createElement('div');
    carte.className = 'carte';

    const grille = document.createElement('div');
    grille.className = 'calendrier';

    JOURS_COURTS.forEach((j) => {
      const e = document.createElement('div');
      e.className = 'cal-entete';
      e.textContent = j[0];
      grille.appendChild(e);
    });

    const premier = dateDe(cles[0]);
    const decalage = (premier.getDay() + 6) % 7;
    for (let i = 0; i < decalage; i++) {
      const c = document.createElement('div');
      c.className = 'cal-jour vide';
      grille.appendChild(c);
    }

    const habs = habitudesActives();
    const auj = aujourdHui();
    cles.forEach((cle) => {
      const d = dateDe(cle);
      const s = scoreJour(cle, habs);
      const cellule = document.createElement('button');
      cellule.type = 'button';
      cellule.className = 'cal-jour' +
        (d > auj ? ' futur' : '') +
        (memeJour(d, auj) ? ' aujourdhui' : '');
      cellule.style.background = couleurJour(s);
      cellule.style.color = texteSurJour(s);
      cellule.dataset.cle = cle;
      cellule.title = fmtDateLongue(d) + ' — ' + (s.vide ? 'aucune donnée' : s.faits + '/' + s.total);

      const num = document.createElement('span');
      num.textContent = d.getDate();
      cellule.appendChild(num);
      if (!s.vide) {
        const pct = document.createElement('b');
        pct.textContent = Math.round(s.pct * 100) + '%';
        cellule.appendChild(pct);
      }
      grille.appendChild(cellule);
    });

    grille.addEventListener('click', (evt) => {
      const cellule = evt.target.closest('.cal-jour[data-cle]');
      if (!cellule) return;
      const d = dateDe(cellule.dataset.cle);
      if (d > aujourdHui()) return;
      jourCourant = d;
      basculerVue('jour');
      rendreJour();
    });

    carte.appendChild(grille);
    carte.appendChild(legende());
    return carte;
  }

  function vueAnnee(cles) {
    const fragment = document.createDocumentFragment();
    const habs = habitudesActives();
    const annee = ancreHistorique.getFullYear();

    // ── Heatmap type « contributions »
    const carte = document.createElement('div');
    carte.className = 'carte';

    const boite = document.createElement('div');
    boite.className = 'heatmap-boite';

    const debut = debutSemaine(new Date(annee, 0, 1));
    const finAnnee = new Date(annee, 11, 31);

    const ligneMois = document.createElement('div');
    ligneMois.className = 'hm-mois';
    const heatmap = document.createElement('div');
    heatmap.className = 'heatmap';

    let curseur = debut;
    let dernierMois = -1;
    while (curseur <= finAnnee) {
      const colonne = document.createElement('div');
      colonne.className = 'hm-col';

      const etiquette = document.createElement('span');
      etiquette.style.width = '12px';
      const moisColonne = ajouterJours(curseur, 6).getMonth();
      if (ajouterJours(curseur, 6).getFullYear() === annee && moisColonne !== dernierMois) {
        etiquette.textContent = MOIS_COURTS[moisColonne];
        dernierMois = moisColonne;
      }
      ligneMois.appendChild(etiquette);

      for (let i = 0; i < 7; i++) {
        const d = ajouterJours(curseur, i);
        const cel = document.createElement('div');
        if (d.getFullYear() !== annee) {
          cel.className = 'hm-cel hors';
        } else {
          const s = scoreJour(cleDe(d), habs);
          cel.className = 'hm-cel';
          cel.style.background = couleurJour(s);
          cel.title = fmtDateLongue(d) + ' — ' + (s.vide ? 'aucune donnée' : s.faits + '/' + s.total);
        }
        colonne.appendChild(cel);
      }
      heatmap.appendChild(colonne);
      curseur = ajouterJours(curseur, 7);
    }

    boite.appendChild(ligneMois);
    boite.appendChild(heatmap);
    carte.appendChild(boite);
    carte.appendChild(legende());
    fragment.appendChild(carte);

    // ── Moyenne mensuelle
    const titre = document.createElement('h2');
    titre.className = 'titre-section';
    titre.textContent = 'Moyenne par mois';
    fragment.appendChild(titre);

    const carteMois = document.createElement('div');
    carteMois.className = 'carte';
    const barres = document.createElement('div');
    barres.className = 'barres-mois';

    for (let m = 0; m < 12; m++) {
      const nb = new Date(annee, m + 1, 0).getDate();
      const clesMois = [];
      for (let i = 1; i <= nb; i++) clesMois.push(cleDe(new Date(annee, m, i)));
      const agg = agreger(clesMois);

      const ligne = document.createElement('div');
      ligne.className = 'barre-ligne';

      const lib = document.createElement('span');
      lib.className = 'barre-lib';
      lib.textContent = MOIS_COURTS[m];

      const piste = document.createElement('div');
      piste.className = 'barre-piste';
      const remplissage = document.createElement('i');
      remplissage.style.width = (agg.moyenne * 100).toFixed(1) + '%';
      piste.appendChild(remplissage);

      const val = document.createElement('span');
      val.className = 'barre-val';
      val.textContent = agg.suivis ? Math.round(agg.moyenne * 100) + '%' : '–';

      ligne.appendChild(lib);
      ligne.appendChild(piste);
      ligne.appendChild(val);
      barres.appendChild(ligne);
    }
    carteMois.appendChild(barres);
    fragment.appendChild(carteMois);

    const conteneur = document.createElement('div');
    conteneur.appendChild(fragment);
    return conteneur;
  }

  function legende() {
    const l = document.createElement('div');
    l.className = 'legende';
    l.appendChild(document.createTextNode('moins'));
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
      const i = document.createElement('i');
      i.style.background = couleurJour({ pct: p, vide: p === 0 });
      l.appendChild(i);
    });
    l.appendChild(document.createTextNode('plus'));
    return l;
  }

  /**
   * Trois enseignements sur la période affichée : l'habitude la mieux tenue,
   * la plus longue suite de « oui », et celle qui décroche. Plus lisible d'un
   * coup d'œil que la liste exhaustive qu'elle remplace.
   */
  function rendreFaitsMarquants(donnees) {
    const boite = $('#hist-detail');
    boite.innerHTML = '';

    const liste = donnees.parHabitude;
    if (!liste.length) {
      boite.appendChild(messageVide('Aucune habitude active.'));
      return;
    }
    if (!donnees.suivis) {
      boite.appendChild(messageVide('Aucune journée suivie sur cette période.'));
      return;
    }

    // reduce plutôt qu'un tri : à égalité, c'est la première dans l'ordre
    // choisi par l'utilisateur qui l'emporte, et non un ordre arbitraire.
    const meilleure = liste.reduce((m, d) => (d.pct > m.pct ? d : m));
    const constante = liste.reduce((m, d) => (d.serie > m.serie ? d : m));
    const faible = liste.reduce((m, d) => (d.pct < m.pct ? d : m));

    const carte = document.createElement('div');
    carte.className = 'carte faits';
    [
      { lib: '🥇 La mieux tenue', d: meilleure, valeur: Math.round(meilleure.pct * 100) + ' %',
        detail: meilleure.reussis + ' j sur ' + meilleure.base, ton: 'bon' },
      { lib: '🔥 Plus longue série', d: constante, valeur: constante.serie + ' j',
        detail: constante.serie > 1 ? 'jours d\u2019affilée' : 'sans suite de deux jours', ton: 'or' },
      { lib: '🐢 La moins réalisée', d: faible, valeur: Math.round(faible.pct * 100) + ' %',
        detail: faible.reussis + ' j sur ' + faible.base, ton: 'faible' }
    ].forEach((f) => carte.appendChild(ligneFait(f)));
    boite.appendChild(carte);
  }

  function ligneFait(f) {
    const ligne = document.createElement('div');
    ligne.className = 'fait';

    const gauche = document.createElement('div');
    gauche.className = 'fait-corps';
    const lib = document.createElement('span');
    lib.className = 'fait-lib';
    lib.textContent = f.lib;
    const nom = document.createElement('span');
    nom.className = 'fait-nom';
    nom.textContent = (f.d.habitude.emoji || '•') + ' ' + f.d.habitude.nom;
    gauche.appendChild(lib);
    gauche.appendChild(nom);

    const droite = document.createElement('div');
    droite.className = 'fait-mesure ' + f.ton;
    const val = document.createElement('strong');
    val.textContent = f.valeur;
    const det = document.createElement('small');
    det.textContent = f.detail;
    droite.appendChild(val);
    droite.appendChild(det);

    ligne.appendChild(gauche);
    ligne.appendChild(droite);
    return ligne;
  }

  function messageVide(texte) {
    const vide = document.createElement('div');
    vide.className = 'vide-message';
    vide.textContent = texte;
    return vide;
  }

  /* ─────────────── Navigation entre onglets ─────────────── */

  let vueActive = 'jour';

  function basculerVue(nom) {
    vueActive = nom;
    $$('.onglet').forEach((o) => o.classList.toggle('actif', o.dataset.vue === nom));
    $('#vue-jour').classList.toggle('cachee', nom !== 'jour');
    $('#vue-historique').classList.toggle('cachee', nom !== 'historique');
    window.scrollTo(0, 0);
    if (nom === 'historique') rendreHistorique();
    else rendreJour();
  }

  /** Les flèches de l'en-tête pilotent la vue affichée. */
  function reculer() {
    if (vueActive === 'jour') {
      jourCourant = ajouterJours(jourCourant, -1);
      rendreJour();
    } else {
      decalerPeriode(-1);
    }
  }

  function avancer() {
    if (vueActive === 'jour') {
      if (memeJour(jourCourant, aujourdHui())) return;
      jourCourant = ajouterJours(jourCourant, 1);
      rendreJour();
    } else {
      decalerPeriode(1);
    }
  }

  /* ─────────────── Glissement horizontal (historique) ─────────────── */

  const SEUIL_GLISSE = 55;     // px avant qu'un mouvement compte comme un balayage
  let glisseHistorique = null;

  function debutGlisseHistorique(evt) {
    // La piste des jours et la carte de chaleur gèrent déjà le geste
    // horizontal : on ne le leur prend pas.
    if (evt.target.closest('.sem-fenetre, .heatmap-boite')) return;
    if (evt.pointerType === 'mouse' && evt.button !== 0) return;
    glisseHistorique = { x: evt.clientX, y: evt.clientY };
  }

  function finGlisseHistorique(evt) {
    const depart = glisseHistorique;
    glisseHistorique = null;
    if (!depart) return;

    const dx = evt.clientX - depart.x;
    const dy = evt.clientY - depart.y;
    // Franchement horizontal, sinon c'est un défilement vertical ou un appui.
    if (Math.abs(dx) < SEUIL_GLISSE || Math.abs(dx) < Math.abs(dy) * 1.5) return;

    if (dx < 0) {
      if (periodeEstCourante()) return;   // pas de période à venir
      decalerPeriode(1);
      animerHistorique('depuis-droite');
    } else {
      decalerPeriode(-1);
      animerHistorique('depuis-gauche');
    }
  }

  /** Petit glissé du contenu : confirme que le geste a été pris en compte. */
  function animerHistorique(sens) {
    const boite = $('#hist-contenu');
    boite.classList.remove('depuis-droite', 'depuis-gauche');
    void boite.offsetWidth;              // force le redémarrage de l'animation
    boite.classList.add(sens);
  }

  /* ─────────────── Modales ─────────────── */

  function ouvrirModale(sel) {
    $('#voile').classList.remove('cachee');
    $(sel).classList.remove('cachee');
  }
  function fermerModales() {
    $$('.modale').forEach((m) => m.classList.add('cachee'));
    $('#voile').classList.add('cachee');
  }

  /**
   * Boîte de confirmation. Les autres modales sont masquées pour éviter
   * l'empilement ; `retour` est celle à rouvrir si l'utilisateur annule.
   */
  function confirmer(message, actions, retour) {
    $$('.modale').forEach((m) => m.classList.add('cachee'));
    $('#confirm-message').textContent = message;
    const boite = $('#confirm-actions');
    boite.innerHTML = '';
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = (a.classe || 'btn-secondaire') + ' pleine-largeur';
      b.textContent = a.libelle;
      b.addEventListener('click', () => {
        fermerModales();
        if (a.action) a.action();
      });
      boite.appendChild(b);
    });
    const annuler = document.createElement('button');
    annuler.type = 'button';
    annuler.className = 'btn-secondaire pleine-largeur';
    annuler.textContent = 'Annuler';
    annuler.addEventListener('click', () => {
      fermerModales();
      if (retour) ouvrirModale(retour);
    });
    boite.appendChild(annuler);
    ouvrirModale('#modale-confirm');
  }

  function toast(message, type) {
    const t = $('#toast');
    t.textContent = message;
    t.className = 'toast' + (type ? ' ' + type : '');
    clearTimeout(t._minuteur);
    t._minuteur = setTimeout(() => t.classList.add('cachee'), 2600);
  }

  /* ─────────────── Gestion des habitudes ─────────────── */

  function rendreGestion() {
    const liste = $('#liste-gestion');
    liste.innerHTML = '';

    etat.habitudes.forEach((h, index) => {
      const li = document.createElement('li');
      li.className = 'gestion-item' + (h.archivee ? ' archivee' : '');

      const emoji = document.createElement('div');
      emoji.className = 'hab-emoji';
      emoji.textContent = h.emoji || '•';
      li.appendChild(emoji);

      // Toute la zone nom + icône ouvre l'édition : cible tactile large,
      // pour ne pas dépendre d'un appui précis sur le crayon.
      const cible = document.createElement('button');
      cible.type = 'button';
      cible.className = 'gestion-cible';
      cible.setAttribute('aria-label', 'Modifier ' + h.nom);
      cible.appendChild(emoji);

      const nom = document.createElement('div');
      nom.className = 'gestion-nom';
      nom.textContent = h.nom;
      const petit = document.createElement('small');
      petit.textContent = h.archivee ? 'Archivée' : 'Validation oui / non';
      nom.appendChild(petit);
      cible.appendChild(nom);

      const chevron = document.createElement('span');
      chevron.className = 'gestion-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      cible.appendChild(chevron);

      cible.addEventListener('click', () => ouvrirEditeur(h.id));
      li.appendChild(cible);

      // Poignée de déplacement : on la maintient et on fait glisser la ligne.
      const poignee = document.createElement('button');
      poignee.type = 'button';
      poignee.className = 'gestion-poignee';
      poignee.setAttribute('aria-label', 'Déplacer ' + h.nom);
      poignee.textContent = '≡';
      poignee.addEventListener('pointerdown', (evt) => demarrerGlisse(evt, index, li, poignee));
      poignee.addEventListener('pointermove', surGlisse);
      poignee.addEventListener('pointerup', finGlisse);
      poignee.addEventListener('pointercancel', finGlisse);
      // Les flèches du clavier restent utilisables (accessibilité, bureau).
      poignee.addEventListener('keydown', (evt) => {
        if (evt.key !== 'ArrowUp' && evt.key !== 'ArrowDown') return;
        evt.preventDefault();
        deplacer(index, index + (evt.key === 'ArrowUp' ? -1 : 1));
      });
      li.appendChild(poignee);

      liste.appendChild(li);
    });
  }

  function deplacer(index, cible) {
    if (cible === index || cible < 0 || cible >= etat.habitudes.length) return;
    const copie = etat.habitudes.slice();
    const [deplacee] = copie.splice(index, 1);
    copie.splice(cible, 0, deplacee);
    etat.habitudes = copie;
    sauver();
    rendreGestion();
    rendreJour();
  }

  /* ─────────────── Réordonnancement par glisser ─────────────── */

  const ECART_GESTION = 10;   // doit correspondre au gap de .liste-gestion
  let glisse = null;

  function borne(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function demarrerGlisse(evt, index, li, poignee) {
    evt.preventDefault();
    const items = Array.prototype.slice.call($('#liste-gestion').children);
    poignee.setPointerCapture(evt.pointerId);
    glisse = {
      index: index,
      cible: index,
      li: li,
      items: items,
      pas: li.getBoundingClientRect().height + ECART_GESTION,
      departY: evt.clientY,
      dernierY: evt.clientY,
      corps: li.closest('.modale-corps')
    };
    li.classList.add('en-deplacement');
    requestAnimationFrame(boucleDefilement);
  }

  function surGlisse(evt) {
    if (!glisse) return;
    glisse.dernierY = evt.clientY;
    positionner();
  }

  function positionner() {
    const dy = glisse.dernierY - glisse.departY;
    glisse.li.style.transform = 'translateY(' + dy + 'px)';

    const cible = borne(glisse.index + Math.round(dy / glisse.pas), 0, glisse.items.length - 1);
    if (cible === glisse.cible) return;
    glisse.cible = cible;

    // Les autres lignes s'écartent pour montrer où la ligne va se poser.
    glisse.items.forEach((item, i) => {
      if (i === glisse.index) return;
      let decalage = 0;
      if (cible > glisse.index && i > glisse.index && i <= cible) decalage = -glisse.pas;
      else if (cible < glisse.index && i >= cible && i < glisse.index) decalage = glisse.pas;
      item.style.transform = decalage ? 'translateY(' + decalage + 'px)' : '';
    });
  }

  /** Fait défiler la liste quand on approche du haut ou du bas pendant un glisser. */
  function boucleDefilement() {
    if (!glisse) return;
    const corps = glisse.corps;
    if (corps) {
      const zone = corps.getBoundingClientRect();
      const marge = 60;
      let vitesse = 0;
      if (glisse.dernierY < zone.top + marge) vitesse = -9;
      else if (glisse.dernierY > zone.bottom - marge) vitesse = 9;
      if (vitesse) {
        const avant = corps.scrollTop;
        corps.scrollTop += vitesse;
        const reel = corps.scrollTop - avant;
        if (reel) {
          // La ligne défile avec le contenu : on compense pour qu'elle
          // reste sous le doigt.
          glisse.departY -= reel;
          positionner();
        }
      }
    }
    requestAnimationFrame(boucleDefilement);
  }

  function finGlisse() {
    if (!glisse) return;
    const depart = glisse.index;
    const arrivee = glisse.cible;
    glisse.items.forEach((item) => {
      item.style.transform = '';
      item.classList.remove('en-deplacement');
    });
    glisse = null;
    if (arrivee !== depart) deplacer(depart, arrivee);
    else rendreGestion();
  }

  /* ─────────────── Éditeur d'habitude ─────────────── */

  let habitudeEditee = null;   // id ou null (= création)
  let minuteurAutosave = null;
  let retourGestion = false;   // rouvrir la liste en refermant l'éditeur ?

  /** Ferme l'éditeur et revient à la liste des habitudes si on en venait. */
  function fermerEditeur() {
    fermerModales();
    habitudeEditee = null;
    if (retourGestion) {
      retourGestion = false;
      rendreGestion();
      ouvrirModale('#modale-gestion');
    }
  }

  function ouvrirEditeur(id) {
    const creation = !id;
    const h = creation
      ? lireBrouillon()
      : etat.habitudes.find((x) => x.id === id);

    // On ne touche à rien tant que l'habitude n'est pas retrouvée : la liste
    // affichée ne doit jamais pouvoir désigner une entrée disparue.
    if (!h) {
      rendreGestion();
      toast('Habitude introuvable, liste actualisée', 'erreur');
      return;
    }

    // Une saisie encore en attente appartient à l'habitude précédente :
    // on la solde avant de changer de cible.
    if (minuteurAutosave) {
      clearTimeout(minuteurAutosave);
      minuteurAutosave = null;
      appliquerAutosave();
    }

    habitudeEditee = id || null;
    retourGestion = !$('#modale-gestion').classList.contains('cachee');
    if (retourGestion) $('#modale-gestion').classList.add('cachee');

    // Le nom est repris dans le titre : on voit immédiatement ce qu'on édite.
    $('#titre-habitude').textContent = creation ? 'Nouvelle habitude' : 'Modifier · ' + h.nom;
    $('#ch-nom').value = h.nom || '';
    $('#ch-emoji').value = h.emoji || '';

    $('#btn-creer').classList.toggle('cachee', !creation);
    $('#actions-edition').classList.toggle('cachee', creation);
    majPill(creation ? 'neutre' : 'ajour');

    ouvrirModale('#modale-habitude');
  }

  function lireFormulaire() {
    return {
      nom: $('#ch-nom').value.trim(),
      emoji: $('#ch-emoji').value.trim(),
      type: 'bool'
    };
  }

  function majPill(mode) {
    const p = $('#pill-statut');
    p.className = 'pill';
    if (mode === 'modifie') { p.classList.add('modifie'); p.textContent = '• Modifié'; }
    else if (mode === 'encours') { p.textContent = '⟳ Enregistrement…'; }
    else if (mode === 'enregistre') { p.classList.add('enregistre'); p.textContent = '✓ Enregistré'; }
    else if (mode === 'erreur') { p.classList.add('erreur'); p.textContent = '⚠ Non enregistré'; }
    else if (mode === 'neutre') { p.textContent = 'Brouillon'; }
    else { p.textContent = '✓ À jour'; }
  }

  /** Auto-enregistrement débauncé : aucun bouton « Enregistrer » en édition. */
  function planifierAutosave() {
    if (!habitudeEditee) {                       // création → brouillon local seulement
      ecrireBrouillon(lireFormulaire());
      majPill('neutre');
      return;
    }
    majPill('modifie');
    clearTimeout(minuteurAutosave);
    minuteurAutosave = setTimeout(appliquerAutosave, 500);
  }

  function appliquerAutosave() {
    minuteurAutosave = null;
    if (!habitudeEditee) return;
    const donnees = lireFormulaire();
    const champNom = $('#ch-nom');
    if (!donnees.nom) {
      champNom.classList.add('erreur');
      majPill('erreur');
      return;
    }
    champNom.classList.remove('erreur');
    majPill('encours');

    const h = etat.habitudes.find((x) => x.id === habitudeEditee);
    if (!h) return;
    h.nom = donnees.nom;
    h.emoji = donnees.emoji;
    h.type = 'bool';

    $('#titre-habitude').textContent = 'Modifier · ' + h.nom;

    if (sauver()) {
      majPill('enregistre');
      setTimeout(() => { if ($('#pill-statut').textContent === '✓ Enregistré') majPill('ajour'); }, 1500);
    } else {
      majPill('erreur');
    }
    rendreGestion();
    rendreJour();
  }

  function creerHabitude() {
    const donnees = lireFormulaire();
    if (!donnees.nom) {
      $('#ch-nom').classList.add('erreur');
      toast('Donne un nom à ton habitude', 'erreur');
      return;
    }
    const h = Object.assign({ id: nouvelId(), archivee: false }, donnees);
    Object.keys(h).forEach((k) => { if (h[k] === undefined) delete h[k]; });
    etat.habitudes.push(h);
    sauver();
    localStorage.removeItem(CLE_BROUILLON);
    fermerEditeur();
    rendreJour();
    toast('Habitude ajoutée', 'succes');
  }

  function demanderSuppression() {
    const h = etat.habitudes.find((x) => x.id === habitudeEditee);
    if (!h) return;
    const actions = [];
    if (h.archivee) {
      actions.push({
        libelle: 'Réactiver', classe: 'btn-primaire', action: () => {
          h.archivee = false; sauver(); fermerEditeur(); rendreJour();
          toast('Habitude réactivée', 'succes');
        }
      });
    } else {
      actions.push({
        libelle: "Archiver (garde l'historique)", classe: 'btn-primaire', action: () => {
          h.archivee = true; sauver(); fermerEditeur(); rendreJour();
          toast('Habitude archivée', 'succes');
        }
      });
    }
    actions.push({
      libelle: 'Supprimer définitivement', classe: 'btn-danger', action: () => {
        etat.habitudes = etat.habitudes.filter((x) => x.id !== h.id);
        Object.keys(etat.jours).forEach((cle) => {
          if (etat.jours[cle][h.id] !== undefined) {
            delete etat.jours[cle][h.id];
            if (!Object.keys(etat.jours[cle]).length) delete etat.jours[cle];
          }
        });
        sauver(); fermerEditeur(); rendreJour();
        toast('Habitude supprimée', 'succes');
      }
    });
    confirmer('« ' + h.nom + " » : archiver la conserve dans l'historique, supprimer efface aussi toutes ses données passées.",
      actions, '#modale-habitude');
  }

  function lireBrouillon() {
    try {
      const brut = localStorage.getItem(CLE_BROUILLON);
      if (brut) return JSON.parse(brut);
    } catch (e) { /* brouillon illisible : on repart à neuf */ }
    return { nom: '', emoji: '', type: 'bool' };
  }
  function ecrireBrouillon(donnees) {
    try { localStorage.setItem(CLE_BROUILLON, JSON.stringify(donnees)); } catch (e) { /* ignoré */ }
  }

  /* ─────────────── Réglages / sauvegardes ─────────────── */

  function majThemeUI() {
    const choix = etat.reglages.theme || 'auto';
    $$('#ch-theme .choix-btn').forEach((b) => b.classList.toggle('actif', b.dataset.theme === choix));
    $('#aide-theme').textContent = choix === 'auto'
      ? 'Suit le réglage de ton téléphone — actuellement ' +
        (themeEffectif() === 'dark' ? 'sombre.' : 'clair.')
      : 'Forcé en ' + (choix === 'clair' ? 'clair' : 'sombre') +
        ', quel que soit le réglage du téléphone.';
  }

  function ouvrirReglages() {
    majThemeUI();
    $('#ch-objectif').value = etat.reglages.objectif;
    $('#out-objectif').textContent = etat.reglages.objectif + ' %';
    const cles = Object.keys(etat.jours).sort();
    $('#info-stockage').textContent = cles.length
      ? cles.length + ' jour(s) enregistré(s), depuis le ' + dateDe(cles[0]).toLocaleDateString('fr-FR') + '.'
      : 'Aucune donnée enregistrée pour le moment.';
    $('#info-version').textContent = 'Version ' + VERSION;
    ouvrirModale('#modale-reglages');
  }

  function exporter() {
    const contenu = JSON.stringify(etat, null, 2);
    const blob = new Blob([contenu], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'daily-quest-' + cleDe(aujourdHui()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Sauvegarde exportée', 'succes');
  }

  function importer(fichier) {
    const lecteur = new FileReader();
    lecteur.onload = () => {
      try {
        const donnees = JSON.parse(String(lecteur.result));
        if (!donnees || !Array.isArray(donnees.habitudes)) throw new Error('format');
        confirmer('Remplacer toutes les données actuelles par cette sauvegarde ?', [{
          libelle: 'Importer', classe: 'btn-primaire', action: () => {
            donnees.jours = donnees.jours || {};
            donnees.reglages = Object.assign({ objectif: 80, theme: 'auto' }, donnees.reglages);
            etat = migrer(donnees);
            sauver();
            appliquerTheme();
            rendreJour();
            rendreGestion();
            toast('Sauvegarde importée', 'succes');
          }
        }], '#modale-reglages');
      } catch (e) {
        toast('Fichier illisible', 'erreur');
      }
    };
    lecteur.readAsText(fichier);
  }

  function reinitialiser() {
    const nb = Object.keys(etat.jours).length;
    const message = 'Cela efface : ton historique complet (' + nb + ' jour(s) enregistré(s), ' +
      'donc série, record et niveau), tes habitudes personnalisées — retour aux 12 points ' +
      "d'origine — ainsi que l'objectif et le thème. Les sauvegardes déjà exportées ne sont " +
      'pas touchées. Action irréversible.';
    confirmer(message, [{
      libelle: 'Tout effacer', classe: 'btn-danger', action: () => {
        etat = etatParDefaut();
        localStorage.removeItem(CLE_BROUILLON);
        sauver();
        appliquerTheme();
        jourCourant = aujourdHui();
        rendreJour();
        rendreGestion();
        toast('Application réinitialisée', 'succes');
      }
    }], '#modale-reglages');
  }

  /* ─────────────── Branchements ─────────────── */

  function brancher() {
    // Onglets
    $$('.onglet').forEach((o) => o.addEventListener('click', () => basculerVue(o.dataset.vue)));

    // Navigation partagée (en-tête) : jour ou période selon l'onglet actif.
    $('#nav-prec').addEventListener('click', reculer);
    $('#nav-suiv').addEventListener('click', avancer);

    // Habitudes du jour
    $('#liste-habitudes').addEventListener('click', surClicHabitude);

    // La densité dépend de la hauteur utile : à recalculer si elle change.
    window.addEventListener('resize', () => { if (vueActive === 'jour') ajusterDensite(); });
    window.addEventListener('orientationchange', () => setTimeout(ajusterDensite, 200));

    // Historique : balayage horizontal pour changer de semaine, de mois ou d'année
    const vueHist = $('#vue-historique');
    vueHist.addEventListener('pointerdown', debutGlisseHistorique);
    vueHist.addEventListener('pointerup', finGlisseHistorique);
    vueHist.addEventListener('pointercancel', () => { glisseHistorique = null; });

    $$('.segment').forEach((s) => s.addEventListener('click', () => {
      modeHistorique = s.dataset.mode;
      ancreHistorique = aujourdHui();
      $$('.segment').forEach((x) => x.classList.toggle('actif', x === s));
      rendreHistorique();
    }));

    // Gestion (accessible depuis les réglages)
    $('#btn-gerer').addEventListener('click', () => {
      fermerModales();
      rendreGestion();
      ouvrirModale('#modale-gestion');
    });
    $('#btn-ajouter').addEventListener('click', () => ouvrirEditeur(null));
    $('#btn-creer').addEventListener('click', creerHabitude);
    $('#btn-supprimer').addEventListener('click', demanderSuppression);
    // Bouton vert : tout est déjà enregistré, il ne fait que refermer.
    $('#btn-termine').addEventListener('click', fermerAvecFlush);

    // Éditeur : auto-enregistrement
    ['#ch-nom', '#ch-emoji'].forEach((sel) => {
      $(sel).addEventListener('input', planifierAutosave);
    });

    // Réglages
    $('#btn-reglages').addEventListener('click', ouvrirReglages);
    $$('#ch-theme .choix-btn').forEach((b) => b.addEventListener('click', () => {
      etat.reglages.theme = b.dataset.theme;
      sauver();
      appliquerTheme();
      majThemeUI();
    }));
    // En mode auto, on suit le téléphone même si l'app reste ouverte.
    if (prefereSombre && prefereSombre.addEventListener) {
      prefereSombre.addEventListener('change', () => {
        if ((etat.reglages.theme || 'auto') !== 'auto') return;
        appliquerTheme();
        if (!$('#modale-reglages').classList.contains('cachee')) majThemeUI();
      });
    }
    $('#ch-objectif').addEventListener('input', (e) => {
      etat.reglages.objectif = Number(e.target.value);
      $('#out-objectif').textContent = etat.reglages.objectif + ' %';
      sauver();
      rendreJour();
    });
    $('#btn-export').addEventListener('click', exporter);
    $('#btn-import').addEventListener('click', () => $('#fichier-import').click());
    $('#fichier-import').addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) importer(e.target.files[0]);
      e.target.value = '';
    });
    $('#btn-reinit').addEventListener('click', reinitialiser);

    // Fermeture des modales : on vide d'abord l'auto-enregistrement en attente.
    $$('[data-fermer]').forEach((b) => b.addEventListener('click', fermerAvecFlush));
    $('#voile').addEventListener('click', fermerAvecFlush);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') fermerAvecFlush();
    });
  }

  function fermerAvecFlush() {
    if (habitudeEditee && minuteurAutosave) {
      clearTimeout(minuteurAutosave);
      minuteurAutosave = null;
      appliquerAutosave();   // rien ne se perd à la fermeture
    }
    fermerEditeur();
  }

  /* ─────────────── Démarrage ─────────────── */

  /** Purge service workers et caches, puis recharge sur une URL neuve. */
  function reparerEtRecharger() {
    const purge = [];
    if ('serviceWorker' in navigator) {
      purge.push(navigator.serviceWorker.getRegistrations()
        .then((liste) => Promise.all(liste.map((r) => r.unregister()))));
    }
    if (window.caches) {
      purge.push(caches.keys().then((cles) => Promise.all(cles.map((c) => caches.delete(c)))));
    }
    Promise.all(purge)
      .catch(() => { /* on recharge quoi qu'il arrive */ })
      .then(() => location.replace(location.pathname + '?r=' + new Date().getTime()));
  }

  /**
   * L'app installée peut se retrouver avec l'index.html d'une version et
   * l'app.js d'une autre : le rendu échoue et l'écran reste vide. On compare
   * l'estampille posée dans le HTML avec celle du script, et on répare.
   * @returns {boolean} true si une réparation est lancée (ne pas démarrer).
   */
  function verifierCoherence() {
    const attendue = document.documentElement.getAttribute('data-app');
    if (!attendue || attendue === VERSION) return false;
    // Une seule tentative par version, pour ne pas boucler indéfiniment.
    try {
      if (sessionStorage.getItem('dq.reparation') === VERSION) return false;
      sessionStorage.setItem('dq.reparation', VERSION);
    } catch (e) { /* navigation privée : on tente quand même */ }

    console.warn('Versions incohérentes (page ' + attendue + ', script ' + VERSION + ')');
    reparerEtRecharger();
    return true;
  }

  /** Dernier filet : mieux vaut un message actionnable qu'un écran vide. */
  function afficherPanne(erreur) {
    console.error(erreur);
    const zone = document.querySelector('main');
    if (!zone) return;
    zone.innerHTML = '';
    const boite = document.createElement('div');
    boite.className = 'vide-message';
    boite.textContent = "L'application n'a pas pu démarrer. Tes données sont conservées.";
    const bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'btn-primaire pleine-largeur';
    bouton.style.marginTop = '14px';
    bouton.textContent = 'Réparer et recharger';
    bouton.addEventListener('click', () => {
      try { sessionStorage.removeItem('dq.reparation'); } catch (e) { /* sans effet */ }
      reparerEtRecharger();
    });
    zone.appendChild(boite);
    zone.appendChild(bouton);
  }

  function demarrer() {
    if (verifierCoherence()) return;
    etat = charger();
    sauver();
    appliquerTheme();
    try {
      brancher();
      rendreJour();
    } catch (e) {
      afficherPanne(e);
      return;
    }

    // Si l'app reste ouverte au passage de minuit, on recale la date —
    // uniquement si l'utilisateur regardait bien la journée en cours.
    setInterval(() => {
      if (vueActive !== 'jour' || !suivaitAujourdHui) return;
      if (!memeJour(jourCourant, aujourdHui())) {
        // Passage de minuit : la journée écoulée se ferme d'elle-même, ses
        // points sans réponse basculent en « oublié ».
        jourCourant = aujourdHui();
        rendreJour();
      }
    }, 60000);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      // L'app installée sert d'abord sa copie locale. Sans ce recharegement,
      // il faut deux lancements pour voir une nouvelle version : le premier
      // télécharge, le second affiche.
      const avaitControleur = !!navigator.serviceWorker.controller;
      let rechargeFaite = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!avaitControleur || rechargeFaite) return;
        rechargeFaite = true;
        location.reload();
      });
      navigator.serviceWorker.register('sw.js')
        .then((enregistrement) => enregistrement.update())
        .catch(() => { /* hors-ligne indisponible */ });
    }
  }

  document.addEventListener('DOMContentLoaded', demarrer);
})();
