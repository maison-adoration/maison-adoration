// Programme hebdomadaire de M.A.N, à l'heure de Lubumbashi (UTC+2, sans heure d'été),
// quel que soit le fuseau du visiteur.

export const SERVICES = [
  { key: "lun", days: [1, 2, 3, 4, 5], h: 6, m: 30, end: 8 * 60, short: "Lun. – ven.", dayName: "Du lundi au vendredi",
    hour: "6h30", name: "Dévotion matinale", label: "Du lundi au vendredi, de 6h30 à 8h00",
    text: "Prier et méditer la Parole avant la journée.", img: "/images/design/fideles.jpg" },
  { key: "mer", days: [3], h: 16, m: 30, end: 18 * 60 + 30, short: "Mercredi", dayName: "Mercredi",
    hour: "16h30", name: "Culte d'enseignement", label: "Mercredi, de 16h30 à 18h30",
    text: "Étudier les Écritures en profondeur.", img: "/images/design/enseignement.jpg" },
  { key: "ven", days: [5], h: 16, m: 30, end: 19 * 60, short: "Vendredi", dayName: "Vendredi",
    hour: "16h30", name: "Chambre haute", label: "Vendredi, de 16h30 à 19h00",
    text: "Intercession et présence du Saint-Esprit.", img: "/images/design/adoration.jpg" },
  { key: "dim", days: [0], h: 8, m: 30, end: 11 * 60, short: "Dimanche", dayName: "Dimanche",
    hour: "8h30", name: "Culte dominical", label: "Dimanche, de 8h30 à 11h00",
    text: "Louange, adoration et prédication, en famille.", img: "/images/design/sanctuaire.jpg" },
];

const TZ_OFFSET_MS = 2 * 3600 * 1000;

/** Prochain rassemblement (ou celui en cours) et secondes restantes. */
export function nextService(now = Date.now()) {
  const local = new Date(now + TZ_OFFSET_MS);
  const dow = local.getUTCDay();
  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  for (let off = 0; off < 8; off++) {
    const dd = (dow + off) % 7;
    const today = SERVICES.filter((x) => x.days.includes(dd)).sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    for (const sv of today) {
      const st = sv.h * 60 + sv.m;
      if (off === 0 && mins >= st && mins < sv.end) return { live: true, service: sv, seconds: 0 };
      if (off > 0 || st > mins) {
        return { live: false, service: sv, seconds: (off * 1440 + st - mins) * 60 - local.getUTCSeconds() };
      }
    }
  }
  return { live: false, service: SERVICES[3], seconds: 0 };
}

const pad = (n) => (n < 10 ? "0" : "") + n;

export function splitCountdown(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return {
    parts: [
      { v: pad(d), l: "jours" },
      { v: pad(h), l: "heures" },
      { v: pad(m), l: "minutes" },
      { v: pad(s), l: "secondes" },
    ],
    label: `Commence dans ${d} jours, ${h} heures et ${m} minutes`,
  };
}
