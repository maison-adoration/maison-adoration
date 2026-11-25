// Passages bibliques : « Jean 3:16-18 ; Rom 8 ; 1 Co 13:4 » → références normalisées
// et livres, pour l'affichage et le filtre « par livre » de la médiathèque.

// Ordre canonique protestant (66 livres), noms Louis Segond, puis abréviations courantes.
const BOOKS = [
  ['Genèse', 'gn', 'ge', 'gen', 'genese'], ['Exode', 'ex', 'exo'], ['Lévitique', 'lv', 'le', 'lev', 'levitique'],
  ['Nombres', 'nb', 'no', 'nom'], ['Deutéronome', 'dt', 'de', 'deut', 'deuteronome'], ['Josué', 'jos', 'josue'],
  ['Juges', 'jg', 'jug'], ['Ruth', 'rt', 'ru'], ['1 Samuel', '1s', '1sa', '1sam'], ['2 Samuel', '2s', '2sa', '2sam'],
  ['1 Rois', '1r', '1ro'], ['2 Rois', '2r', '2ro'], ['1 Chroniques', '1ch', '1chr'], ['2 Chroniques', '2ch', '2chr'],
  ['Esdras', 'esd'], ['Néhémie', 'ne', 'neh', 'nehemie'], ['Esther', 'est'], ['Job', 'jb'],
  ['Psaumes', 'ps', 'psa', 'psaume'], ['Proverbes', 'pr', 'pro', 'prov', 'proverbe'], ['Ecclésiaste', 'ec', 'ecc', 'eccl', 'ecclesiaste'],
  ['Cantique des cantiques', 'ct', 'cant', 'cantique'], ['Ésaïe', 'es', 'esa', 'esaie', 'isaie', 'is'], ['Jérémie', 'jr', 'jer', 'jeremie'],
  ['Lamentations', 'lm', 'la', 'lam'], ['Ézéchiel', 'ez', 'eze', 'ezechiel'], ['Daniel', 'dn', 'da', 'dan'],
  ['Osée', 'os', 'osee'], ['Joël', 'jl', 'joel'], ['Amos', 'am'], ['Abdias', 'ab', 'abd'], ['Jonas', 'jon'],
  ['Michée', 'mi', 'mic', 'michee'], ['Nahum', 'na', 'nah'], ['Habacuc', 'ha', 'hab'], ['Sophonie', 'so', 'soph'],
  ['Aggée', 'ag', 'agg', 'aggee'], ['Zacharie', 'za', 'zac', 'zach'], ['Malachie', 'ml', 'mal'],
  ['Matthieu', 'mt', 'mat', 'matt'], ['Marc', 'mc', 'mr', 'mar'], ['Luc', 'lc', 'lu'], ['Jean', 'jn', 'jea'],
  ['Actes', 'ac', 'act', 'actes des apotres'], ['Romains', 'rm', 'ro', 'rom'], ['1 Corinthiens', '1co', '1cor'],
  ['2 Corinthiens', '2co', '2cor'], ['Galates', 'ga', 'gal'], ['Éphésiens', 'ep', 'eph', 'ephesiens'],
  ['Philippiens', 'ph', 'phi', 'phil'], ['Colossiens', 'col'], ['1 Thessaloniciens', '1th', '1thes'],
  ['2 Thessaloniciens', '2th', '2thes'], ['1 Timothée', '1tm', '1ti', '1tim', '1 timothee'], ['2 Timothée', '2tm', '2ti', '2tim', '2 timothee'],
  ['Tite', 'tt', 'tit'], ['Philémon', 'phm', 'philemon'], ['Hébreux', 'he', 'heb', 'hebreux'], ['Jacques', 'jc', 'ja', 'jac'],
  ['1 Pierre', '1p', '1pi', '1pie'], ['2 Pierre', '2p', '2pi', '2pie'], ['1 Jean', '1jn', '1j', '1jea'], ['2 Jean', '2jn', '2j'],
  ['3 Jean', '3jn', '3j'], ['Jude', 'jd', 'jud'], ['Apocalypse', 'ap', 'apo', 'apoc', 'ap'],
];

const fold = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/(\d)\s*e?r?\s+/, '$1').replace(/[\s.]+/g, '');

const INDEX = new Map();
for (const [name, ...aliases] of BOOKS) {
  for (const a of [name, ...aliases]) INDEX.set(fold(a), name);
  // « 1er Corinthiens », « I Corinthiens »
  if (/^[123] /.test(name)) {
    const n = name[0];
    const rest = name.slice(2);
    INDEX.set(fold(`${'I'.repeat(Number(n)).toLowerCase()}${rest}`), name);
    INDEX.set(fold(`${n}er ${rest}`), name);
    INDEX.set(fold(`${n}e ${rest}`), name);
  }
}

const ORDER = BOOKS.map((b) => b[0]);

/**
 * @param {string} input « Jean 3:16-18 ; Rom 8 »
 * @returns {{ refs: string[], books: string[], unknown: string[] }}
 */
function parseScriptures(input = '') {
  const refs = [];
  const books = [];
  const unknown = [];
  // « ; » sépare toujours ; « , » sépare seulement s'il est suivi d'un nom de livre
  // (« Jean 3:16,18 » reste un seul passage).
  for (const raw of String(input).split(/[;\n]+|,\s*(?=(?:[1-3]|i{1,3})?(?:er|e)?\s*[^\d\s,;])/i)) {
    const part = raw.trim();
    if (!part) continue;
    // livre (éventuellement précédé d'un chiffre) + reste « 3:16-18 » ou « 3.16 » ou « 8 »
    const m = part.match(/^((?:[1-3]|i{1,3})(?:er|e)?\s*)?([^\d]+?)\s*(\d[\d\s:.,\-–]*)?$/i);
    if (!m) { unknown.push(part); continue; }
    const key = fold(`${(m[1] || '').trim()}${m[1] ? ' ' : ''}${m[2]}`);
    const book = INDEX.get(key);
    if (!book) { unknown.push(part); continue; }
    const loc = (m[3] || '').trim().replace(/\s+/g, '').replace(/\./g, ':').replace(/–/g, '-');
    refs.push(loc ? `${book} ${loc}` : book);
    if (!books.includes(book)) books.push(book);
  }
  books.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  return { refs, books, unknown };
}

module.exports = { parseScriptures, BOOK_ORDER: ORDER };
