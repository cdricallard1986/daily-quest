/**
 * Génère les icônes PNG de l'application (aucune dépendance externe).
 * Usage : node tools/generer-icones.js
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SORTIE = path.join(__dirname, '..', 'icons');

/* ---------- Encodage PNG minimal ---------- */

const TABLE_CRC = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = TABLE_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function morceau(type, donnees) {
  const nom = Buffer.from(type, 'ascii');
  const longueur = Buffer.alloc(4);
  longueur.writeUInt32BE(donnees.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([nom, donnees])), 0);
  return Buffer.concat([longueur, nom, donnees, crc]);
}

function encoderPng(largeur, hauteur, pixels) {
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(largeur, 0);
  entete.writeUInt32BE(hauteur, 4);
  entete[8] = 8;    // profondeur
  entete[9] = 6;    // RGBA
  const brut = Buffer.alloc((largeur * 4 + 1) * hauteur);
  for (let y = 0; y < hauteur; y++) {
    brut[y * (largeur * 4 + 1)] = 0; // filtre « none »
    pixels.copy(brut, y * (largeur * 4 + 1) + 1, y * largeur * 4, (y + 1) * largeur * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', entete),
    morceau('IDAT', zlib.deflateSync(brut, { level: 9 })),
    morceau('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- Dessin ---------- */

const borne = (v, min, max) => Math.max(min, Math.min(max, v));

function distanceSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = borne(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance signée à un rectangle arrondi centré. */
function distanceRectArrondi(px, py, demiL, demiH, rayon) {
  const qx = Math.abs(px) - demiL + rayon;
  const qy = Math.abs(py) - demiH + rayon;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rayon;
}

function melange(fond, dessus, alpha) {
  return [
    Math.round(fond[0] + (dessus[0] - fond[0]) * alpha),
    Math.round(fond[1] + (dessus[1] - fond[1]) * alpha),
    Math.round(fond[2] + (dessus[2] - fond[2]) * alpha)
  ];
}

function dessiner(taille, arrondi) {
  const pixels = Buffer.alloc(taille * taille * 4);
  const c = taille / 2;
  // iOS applique lui-même son masque : l'icône Apple reste un carré plein.
  const rayon = arrondi ? taille * 0.23 : 0;
  const epaisseur = taille * 0.105;

  // Coche : trois points, coordonnées relatives à la taille.
  const pts = [
    [0.27 * taille, 0.53 * taille],
    [0.43 * taille, 0.69 * taille],
    [0.75 * taille, 0.32 * taille]
  ];

  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const px = x + 0.5;
      const py = y + 0.5;

      // Fond : dégradé doré, découpé par un carré arrondi.
      const dFond = distanceRectArrondi(px - c, py - c, c, c, rayon);
      const alphaFond = borne(0.5 - dFond, 0, 1);
      const t = py / taille;
      let couleur = melange([255, 190, 68], [246, 138, 12], t);

      // Coche sombre par-dessus.
      const d = Math.min(
        distanceSegment(px, py, pts[0][0], pts[0][1], pts[1][0], pts[1][1]),
        distanceSegment(px, py, pts[1][0], pts[1][1], pts[2][0], pts[2][1])
      );
      const alphaCoche = borne(epaisseur / 2 - d + 0.5, 0, 1);
      couleur = melange(couleur, [20, 15, 4], alphaCoche);

      const i = (y * taille + x) * 4;
      pixels[i] = couleur[0];
      pixels[i + 1] = couleur[1];
      pixels[i + 2] = couleur[2];
      pixels[i + 3] = Math.round(alphaFond * 255);
    }
  }
  return encoderPng(taille, taille, pixels);
}

fs.mkdirSync(SORTIE, { recursive: true });
[
  ['icon-192.png', 192, true],
  ['icon-512.png', 512, true],
  ['apple-touch-icon.png', 180, false]
].forEach(([nom, taille, arrondi]) => {
  fs.writeFileSync(path.join(SORTIE, nom), dessiner(taille, arrondi));
  console.log('✓ ' + nom + ' (' + taille + 'px)');
});
