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
  const VERSION = '2026.08.17-4';

  const CLE_STOCKAGE = 'dq.v1';
  const CLE_BROUILLON = 'dq.brouillon';
  const XP_PAR_NIVEAU = 50;

  const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  const MOIS_NOMS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MOIS_COURTS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin',
    'juil', 'août', 'sep', 'oct', 'nov', 'déc'];

  const HABITUDES_DEFAUT = [
    { nom: "Pas d'alcool", emoji: '🚫', type: 'bool' },
    { nom: 'Sommeil', emoji: '😴', type: 'quant', cible: 8, unite: 'h', pas: 0.5 },
    { nom: 'Trouve un mentor', emoji: '🧭', type: 'bool' },
    { nom: 'Exercice', emoji: '💪', type: 'bool' },
    { nom: 'Marche', emoji: '👟', type: 'quant', cible: 10000, unite: 'pas', pas: 500 },
    { nom: 'Rien à manger après 22 h', emoji: '🍽️', type: 'bool' },
    { nom: 'Zéro aliment transformé', emoji: '🥦', type: 'bool' },
    { nom: "Pas d'écrans après 21 h", emoji: '📵', type: 'bool' },
    { nom: 'Loin des personnes toxiques', emoji: '🛡️', type: 'bool' },
    { nom: 'Lecture', emoji: '📚', type: 'quant', cible: 30, unite: 'min', pas: 5 },
    { nom: 'Eau', emoji: '💧', type: 'quant', cible: 3, unite: 'L', pas: 0.25 },
    { nom: 'Méditation', emoji: '🧘', type: 'quant', cible: 10, unite: 'min', pas: 5 }
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
      version: 1,
      habitudes: HABITUDES_DEFAUT.map((h, i) => Object.assign({
        id: 'h' + (i + 1),
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
      return donnees;
    } catch (e) {
      console.error('Lecture du stockage impossible', e);
      return etatParDefaut();
    }
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

  function valeurBrute(h, valeurs) {
    const v = valeurs[h.id];
    if (h.type === 'quant') return typeof v === 'number' ? v : 0;
    return v === true;
  }

  function estFaite(h, valeurs) {
    if (h.type === 'quant') {
      const cible = h.cible || 0;
      const valeur = valeurBrute(h, valeurs);
      return cible > 0 ? valeur >= cible : valeur > 0;
    }
    return valeurs[h.id] === true;
  }

  function progression(h, valeurs) {
    if (h.type !== 'quant') return estFaite(h, valeurs) ? 1 : 0;
    const cible = h.cible || 0;
    if (cible <= 0) return valeurBrute(h, valeurs) > 0 ? 1 : 0;
    return Math.min(1, valeurBrute(h, valeurs) / cible);
  }

  /** Le jour contient-il au moins une donnée saisie ? */
  function jourRenseigne(cle) {
    const v = etat.jours[cle];
    if (!v) return false;
    return Object.keys(v).some((k) => v[k] === true || (typeof v[k] === 'number' && v[k] > 0));
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
      let somme = 0;
      cles.forEach((c) => {
        const valeurs = valeursDu(c);
        if (estFaite(h, valeurs)) reussis++;
        if (h.type === 'quant') somme += valeurBrute(h, valeurs);
      });
      return {
        habitude: h,
        reussis: reussis,
        somme: somme,
        base: suivis.length || cles.length,
        pct: (suivis.length || cles.length) ? reussis / (suivis.length || cles.length) : 0
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

  function definirValeur(cle, habitudeId, valeur) {
    const jour = etat.jours[cle] ? Object.assign({}, etat.jours[cle]) : {};
    if (valeur === false || valeur === 0 || valeur === null || valeur === undefined) {
      delete jour[habitudeId];
    } else {
      jour[habitudeId] = valeur;
    }
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
  let modeHistorique = 'semaine';
  let ancreHistorique = aujourdHui();

  /* ─────────────── Onglet Aujourd'hui ─────────────── */

  function rendreJour() {
    const cle = cleDe(jourCourant);
    const habs = habitudesActives();
    const valeurs = valeursDu(cle);
    const score = scoreJour(cle, habs);

    // En-tête de date
    $('#jour-titre').textContent = fmtDateLongue(jourCourant);
    const estAujourdHui = memeJour(jourCourant, aujourdHui());
    const hier = memeJour(jourCourant, ajouterJours(aujourdHui(), -1));
    $('#jour-sous-titre').textContent = estAujourdHui
      ? "Aujourd'hui · " + jourCourant.getFullYear()
      : hier ? 'Hier · ' + jourCourant.getFullYear() : String(jourCourant.getFullYear());
    $('#jour-suiv').disabled = estAujourdHui;

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
      const fait = estFaite(h, valeurs);
      const li = document.createElement('li');
      li.className = 'habitude' + (fait ? ' faite' : '');
      li.dataset.id = h.id;

      const emoji = document.createElement('div');
      emoji.className = 'hab-emoji';
      emoji.textContent = h.emoji || '•';
      li.appendChild(emoji);

      const infos = document.createElement('div');
      infos.className = 'hab-infos';
      const nom = document.createElement('div');
      nom.className = 'hab-nom';
      nom.textContent = h.nom;
      infos.appendChild(nom);

      if (h.type === 'quant') {
        const detail = document.createElement('div');
        detail.className = 'hab-detail';
        detail.textContent = 'Objectif ' + fmt(h.cible) + ' ' + (h.unite || '');
        infos.appendChild(detail);

        const jaugeH = document.createElement('div');
        jaugeH.className = 'hab-jauge';
        const barre = document.createElement('i');
        barre.style.width = (progression(h, valeurs) * 100) + '%';
        jaugeH.appendChild(barre);
        infos.appendChild(jaugeH);
      }
      li.appendChild(infos);

      if (h.type === 'quant') {
        const zone = document.createElement('div');
        zone.className = 'hab-quant';

        const moins = document.createElement('button');
        moins.className = 'btn-pas';
        moins.type = 'button';
        moins.dataset.action = 'moins';
        moins.setAttribute('aria-label', 'Retirer');
        moins.textContent = '−';

        const val = document.createElement('button');
        val.className = 'hab-valeur';
        val.type = 'button';
        val.dataset.action = 'saisir';
        val.textContent = fmt(valeurBrute(h, valeurs)) + (h.unite ? ' ' + h.unite : '');

        const plus = document.createElement('button');
        plus.className = 'btn-pas';
        plus.type = 'button';
        plus.dataset.action = 'plus';
        plus.setAttribute('aria-label', 'Ajouter');
        plus.textContent = '+';

        zone.appendChild(moins);
        zone.appendChild(val);
        zone.appendChild(plus);
        li.appendChild(zone);
      } else {
        const coche = document.createElement('button');
        coche.className = 'hab-coche';
        coche.type = 'button';
        coche.dataset.action = 'basculer';
        coche.setAttribute('aria-label', (fait ? 'Décocher ' : 'Cocher ') + h.nom);
        coche.setAttribute('aria-pressed', String(fait));
        coche.textContent = '✓';
        li.appendChild(coche);
      }

      liste.appendChild(li);
    });
  }

  function surClicHabitude(evt) {
    const li = evt.target.closest('.habitude');
    if (!li) return;

    const h = etat.habitudes.find((x) => x.id === li.dataset.id);
    if (!h) return;

    // Sur une habitude à cocher, toute la ligne bascule l'état : cible large,
    // plus sûre au doigt qu'une pastille de 30 px.
    const bouton = evt.target.closest('[data-action]');
    const action = bouton ? bouton.dataset.action : (h.type === 'bool' ? 'basculer' : null);
    if (!action) return;

    const cle = cleDe(jourCourant);
    const valeurs = valeursDu(cle);

    if (action === 'basculer') {
      definirValeur(cle, h.id, !(valeurs[h.id] === true));
    } else if (action === 'plus' || action === 'moins') {
      const pas = h.pas > 0 ? h.pas : 1;
      const delta = action === 'plus' ? pas : -pas;
      const brut = valeurBrute(h, valeurs) + delta;
      const arrondi = Math.max(0, Math.round(brut * 1000) / 1000);
      definirValeur(cle, h.id, arrondi);
    } else if (action === 'saisir') {
      ouvrirSaisieQuantite(h, valeurBrute(h, valeurs));
      return;
    }
    rendreJour();
  }

  /* ─────────────── Saisie manuelle d'une quantité ─────────────── */

  let habitudeEnSaisie = null;

  function ouvrirSaisieQuantite(h, valeur) {
    habitudeEnSaisie = h;
    $('#quantite-titre').textContent = h.nom;
    $('#quantite-lib').textContent = 'Valeur en ' + (h.unite || 'unités') +
      ' (objectif ' + fmt(h.cible) + ')';
    const champ = $('#ch-quantite');
    champ.value = valeur || '';
    ouvrirModale('#modale-quantite');
    setTimeout(() => { champ.focus(); champ.select(); }, 80);
  }

  function validerSaisieQuantite() {
    if (!habitudeEnSaisie) return;
    const brut = parseFloat(String($('#ch-quantite').value).replace(',', '.'));
    const valeur = isFinite(brut) && brut > 0 ? Math.round(brut * 1000) / 1000 : 0;
    definirValeur(cleDe(jourCourant), habitudeEnSaisie.id, valeur);
    habitudeEnSaisie = null;
    fermerModales();
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
      $('#periode-titre').textContent = debut.getDate() + (memeMois ? '' : ' ' + MOIS_COURTS[debut.getMonth()]) +
        ' – ' + fin.getDate() + ' ' + MOIS_NOMS[fin.getMonth()];
      $('#periode-sous-titre').textContent = 'Semaine ' + numeroSemaine(debut) + ' · ' + fin.getFullYear();
    } else if (modeHistorique === 'mois') {
      $('#periode-titre').textContent = majuscule(MOIS_NOMS[ancreHistorique.getMonth()]) + ' ' + ancreHistorique.getFullYear();
      $('#periode-sous-titre').textContent = cles.length + ' jours';
    } else {
      $('#periode-titre').textContent = String(ancreHistorique.getFullYear());
      $('#periode-sous-titre').textContent = cles.length + ' jours';
    }
    $('#periode-suiv').disabled = periodeEstCourante();

    // Résumé
    $('#res-moyenne').textContent = Math.round(donnees.moyenne * 100) + '%';
    $('#res-parfaits').textContent = donnees.parfaits;
    $('#res-actifs').textContent = donnees.suivis;
    $('#res-total').textContent = fmt(donnees.points);

    // Contenu principal
    const boite = $('#hist-contenu');
    boite.innerHTML = '';
    if (modeHistorique === 'semaine') boite.appendChild(vueSemaine(cles));
    else if (modeHistorique === 'mois') boite.appendChild(vueMois(cles));
    else boite.appendChild(vueAnnee(cles));

    // Détail par habitude
    rendreDetailHabitudes(donnees);
  }

  function vueSemaine(cles) {
    const carte = document.createElement('div');
    carte.className = 'carte grille-semaine';

    const habs = habitudesActives();
    if (!habs.length) {
      carte.className = 'vide-message';
      carte.textContent = 'Aucune habitude active.';
      return carte;
    }

    const table = document.createElement('table');
    table.className = 'tab-semaine';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');
    const vide = document.createElement('th');
    vide.className = 'col-hab';
    trh.appendChild(vide);
    cles.forEach((c, i) => {
      const d = dateDe(c);
      const th = document.createElement('th');
      if (memeJour(d, aujourdHui())) th.className = 'aujourdhui';
      th.innerHTML = JOURS_COURTS[i] + '<small>' + d.getDate() + '</small>';
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    habs.forEach((h) => {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'cel-hab';
      td.innerHTML = '<span class="e">' + (h.emoji || '•') + '</span>';
      td.appendChild(document.createTextNode(h.nom));
      tr.appendChild(td);

      cles.forEach((c) => {
        const valeurs = valeursDu(c);
        const cellule = document.createElement('td');
        const p = document.createElement('div');
        const prog = progression(h, valeurs);
        if (estFaite(h, valeurs)) {
          p.className = 'pastille ok';
          p.textContent = '✓';
          p.title = h.nom + ' — validé';
        } else if (prog > 0) {
          p.className = 'pastille partiel';
          p.textContent = Math.round(prog * 100) + '%';
          p.title = h.nom + ' — ' + Math.round(prog * 100) + ' %';
        } else {
          p.className = 'pastille';
        }
        cellule.appendChild(p);
        tr.appendChild(cellule);
      });
      tbody.appendChild(tr);
    });

    // Ligne de total par jour
    const trTotal = document.createElement('tr');
    trTotal.className = 'ligne-total';
    const tdVide = document.createElement('td');
    tdVide.className = 'cel-hab';
    tdVide.textContent = 'Total';
    trTotal.appendChild(tdVide);
    cles.forEach((c) => {
      const s = scoreJour(c, habs);
      const td = document.createElement('td');
      td.className = 'total-jour';
      td.textContent = s.vide ? '–' : s.faits + '/' + s.total;
      trTotal.appendChild(td);
    });
    tbody.appendChild(trTotal);

    table.appendChild(tbody);
    carte.appendChild(table);
    return carte;
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

  function rendreDetailHabitudes(donnees) {
    const boite = $('#hist-detail');
    boite.innerHTML = '';

    if (!donnees.parHabitude.length) {
      const vide = document.createElement('div');
      vide.className = 'vide-message';
      vide.textContent = 'Aucune habitude active.';
      boite.appendChild(vide);
      return;
    }

    donnees.parHabitude.forEach((d) => {
      const h = d.habitude;
      const item = document.createElement('div');
      item.className = 'detail-hab';

      const emoji = document.createElement('div');
      emoji.className = 'hab-emoji';
      emoji.textContent = h.emoji || '•';
      item.appendChild(emoji);

      const corps = document.createElement('div');
      corps.className = 'detail-corps';

      const haut = document.createElement('div');
      haut.className = 'detail-haut';
      const nom = document.createElement('span');
      nom.className = 'detail-nom';
      nom.textContent = h.nom;
      const chiffre = document.createElement('span');
      chiffre.className = 'detail-chiffre';
      chiffre.textContent = h.type === 'quant'
        ? fmt(d.somme) + ' ' + (h.unite || '')
        : d.reussis + ' j';
      haut.appendChild(nom);
      haut.appendChild(chiffre);
      corps.appendChild(haut);

      const sous = document.createElement('div');
      sous.className = 'detail-sous';
      const base = donnees.suivis || 0;
      if (h.type === 'quant') {
        const moyenne = base ? d.somme / base : 0;
        sous.textContent = 'Objectif atteint ' + d.reussis + '/' + base + ' j · ' +
          fmt(Math.round(moyenne * 100) / 100) + ' ' + (h.unite || '') + '/j en moyenne';
      } else {
        sous.textContent = 'Validé ' + d.reussis + '/' + base + ' j · ' +
          Math.round(d.pct * 100) + ' %';
      }
      corps.appendChild(sous);

      const jauge = document.createElement('div');
      jauge.className = 'detail-jauge';
      const rempli = document.createElement('i');
      rempli.style.width = (Math.min(1, d.pct) * 100).toFixed(1) + '%';
      if (d.pct >= 1) rempli.className = 'plein';
      jauge.appendChild(rempli);
      corps.appendChild(jauge);

      item.appendChild(corps);
      boite.appendChild(item);
    });
  }

  /* ─────────────── Navigation entre onglets ─────────────── */

  function basculerVue(nom) {
    $$('.onglet').forEach((o) => o.classList.toggle('actif', o.dataset.vue === nom));
    $('#vue-jour').classList.toggle('cachee', nom !== 'jour');
    $('#vue-historique').classList.toggle('cachee', nom !== 'historique');
    window.scrollTo(0, 0);
    if (nom === 'historique') rendreHistorique();
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
      petit.textContent = (h.type === 'quant'
        ? 'Objectif ' + fmt(h.cible) + ' ' + (h.unite || '')
        : 'À cocher') + (h.archivee ? ' · archivée' : '');
      nom.appendChild(petit);
      cible.appendChild(nom);

      const chevron = document.createElement('span');
      chevron.className = 'gestion-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.textContent = '›';
      cible.appendChild(chevron);

      cible.addEventListener('click', () => ouvrirEditeur(h.id));
      li.appendChild(cible);

      const haut = boutonMini('↑', 'Monter', index === 0, () => deplacer(index, -1));
      const bas = boutonMini('↓', 'Descendre', index === etat.habitudes.length - 1, () => deplacer(index, 1));
      li.appendChild(haut);
      li.appendChild(bas);

      liste.appendChild(li);
    });
  }

  function boutonMini(texte, libelle, desactive, action) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn-mini';
    b.textContent = texte;
    b.setAttribute('aria-label', libelle);
    b.disabled = desactive;
    b.addEventListener('click', action);
    return b;
  }

  function deplacer(index, sens) {
    const cible = index + sens;
    if (cible < 0 || cible >= etat.habitudes.length) return;
    const copie = etat.habitudes.slice();
    const tmp = copie[index];
    copie[index] = copie[cible];
    copie[cible] = tmp;
    etat.habitudes = copie;
    sauver();
    rendreGestion();
    rendreJour();
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
    $('#ch-cible').value = h.cible != null ? h.cible : 1;
    $('#ch-unite').value = h.unite || '';
    $('#ch-pas').value = h.pas != null ? h.pas : 1;
    majTypeUI(h.type || 'bool');

    $('#btn-creer').classList.toggle('cachee', !creation);
    $('#btn-supprimer').classList.toggle('cachee', creation);
    majPill(creation ? 'neutre' : 'ajour');

    ouvrirModale('#modale-habitude');
  }

  function majTypeUI(type) {
    $$('#ch-type .choix-btn').forEach((b) => b.classList.toggle('actif', b.dataset.type === type));
    $('#bloc-quant').classList.toggle('cachee', type !== 'quant');
  }

  function typeChoisi() {
    const actif = $('#ch-type .choix-btn.actif');
    return actif ? actif.dataset.type : 'bool';
  }

  function lireFormulaire() {
    const type = typeChoisi();
    const cible = parseFloat(String($('#ch-cible').value).replace(',', '.'));
    const pas = parseFloat(String($('#ch-pas').value).replace(',', '.'));
    return {
      nom: $('#ch-nom').value.trim(),
      emoji: $('#ch-emoji').value.trim(),
      type: type,
      cible: type === 'quant' ? (isFinite(cible) && cible > 0 ? cible : 1) : undefined,
      unite: type === 'quant' ? $('#ch-unite').value.trim() : undefined,
      pas: type === 'quant' ? (isFinite(pas) && pas > 0 ? pas : 1) : undefined
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
    h.type = donnees.type;
    if (donnees.type === 'quant') {
      h.cible = donnees.cible;
      h.unite = donnees.unite;
      h.pas = donnees.pas;
    } else {
      delete h.cible; delete h.unite; delete h.pas;
    }

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
    return { nom: '', emoji: '', type: 'bool', cible: 1, unite: '', pas: 1 };
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
            etat = donnees;
            etat.jours = etat.jours || {};
            etat.reglages = Object.assign({ objectif: 80, theme: 'auto' }, etat.reglages);
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
    confirmer('Effacer définitivement toutes les habitudes et tout l\'historique ?', [{
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

    // Navigation jour
    $('#jour-prec').addEventListener('click', () => {
      jourCourant = ajouterJours(jourCourant, -1);
      rendreJour();
    });
    $('#jour-suiv').addEventListener('click', () => {
      if (memeJour(jourCourant, aujourdHui())) return;
      jourCourant = ajouterJours(jourCourant, 1);
      rendreJour();
    });

    // Habitudes du jour
    $('#liste-habitudes').addEventListener('click', surClicHabitude);

    // Historique
    $$('.segment').forEach((s) => s.addEventListener('click', () => {
      modeHistorique = s.dataset.mode;
      ancreHistorique = aujourdHui();
      $$('.segment').forEach((x) => x.classList.toggle('actif', x === s));
      rendreHistorique();
    }));
    $('#periode-prec').addEventListener('click', () => decalerPeriode(-1));
    $('#periode-suiv').addEventListener('click', () => decalerPeriode(1));

    // Gestion
    $('#btn-gerer').addEventListener('click', () => { rendreGestion(); ouvrirModale('#modale-gestion'); });
    $('#btn-ajouter').addEventListener('click', () => ouvrirEditeur(null));
    $('#btn-creer').addEventListener('click', creerHabitude);
    $('#btn-supprimer').addEventListener('click', demanderSuppression);

    // Éditeur : auto-enregistrement
    ['#ch-nom', '#ch-emoji', '#ch-cible', '#ch-unite', '#ch-pas'].forEach((sel) => {
      $(sel).addEventListener('input', planifierAutosave);
    });
    $$('#ch-type .choix-btn').forEach((b) => b.addEventListener('click', () => {
      majTypeUI(b.dataset.type);
      planifierAutosave();
    }));

    // Quantité
    $('#btn-valider-quantite').addEventListener('click', validerSaisieQuantite);
    $('#ch-quantite').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') validerSaisieQuantite();
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

  function demarrer() {
    etat = charger();
    sauver();
    appliquerTheme();
    brancher();
    rendreJour();

    // Si l'app reste ouverte au passage de minuit, on recale la date.
    setInterval(() => {
      if ($('#vue-jour').classList.contains('cachee')) return;
      if ($('#jour-suiv').disabled && !memeJour(jourCourant, aujourdHui())) {
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
