/**
 * Assemble index.html + styles.css + app.js en un seul fichier autonome,
 * ouvrable directement (double-clic, AirDrop, pièce jointe) sans serveur.
 * Usage : node tools/construire-fichier-unique.js
 */
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

const css = lire('styles.css');
const js = lire('app.js');
const svg = lire('icons/icon.svg');
const iconeData = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');

// Remplacement littéral : une fonction évite que « $' » ou « $& » présents
// dans le CSS/JS soient interprétés comme motifs de substitution.
const remplacer = (texte, motif, contenu) => texte.replace(motif, () => contenu);

let html = lire('index.html');
html = remplacer(html, '<link rel="manifest" href="manifest.webmanifest">\n', '');
html = remplacer(html, '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">',
  '<link rel="apple-touch-icon" href="' + iconeData + '">');
html = remplacer(html, '<link rel="icon" href="icons/icon.svg" type="image/svg+xml">',
  '<link rel="icon" href="' + iconeData + '" type="image/svg+xml">');
html = remplacer(html, '<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>');
html = remplacer(html, '<script src="app.js"></script>', '<script>\n' + js + '\n</script>');

const sortie = path.join(RACINE, 'daily-quest-autonome.html');
fs.writeFileSync(sortie, html);
console.log('✓ ' + path.basename(sortie) + ' — ' + Math.round(html.length / 1024) + ' Ko');
