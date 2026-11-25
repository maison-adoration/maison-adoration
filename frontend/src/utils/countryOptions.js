// Liste des pays pour les formulaires : noms en français, RD Congo en tête.
// La valeur enregistrée reste le nom anglais de la liste, comme avant.
export const DRC = "Democratic Republic of the Congo";
const LOCAL = { CD: "RD Congo", CG: "Congo-Brazzaville" }; // noms d'usage à Lubumbashi

export function countryOptions(list) {
  let frName = (c) => c.name;
  try {
    const dn = new Intl.DisplayNames(["fr"], { type: "region" });
    frName = (c) => {
      try { return LOCAL[c.code] || dn.of(c.code) || c.name; } catch { return c.name; }
    };
  } catch { /* navigateur ancien : noms anglais */ }
  return [...list]
    .map((c) => ({ value: c.name, label: frName(c), prefix: c.prefix }))
    .sort((a, b) => (a.value === DRC ? -1 : b.value === DRC ? 1 : a.label.localeCompare(b.label, "fr")));
}
