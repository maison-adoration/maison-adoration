// Mise en forme des dates d'événements, à l'heure de Lubumbashi.
const TZ = "Africa/Lubumbashi";

export const dayNum = (d) => new Date(d).toLocaleDateString("fr-FR", { day: "numeric", timeZone: TZ });
export const monthShort = (d) => new Date(d).toLocaleDateString("fr-FR", { month: "short", timeZone: TZ }).replace(".", "");
export const weekday = (d) => new Date(d).toLocaleDateString("fr-FR", { weekday: "long", timeZone: TZ });
export const hour = (d) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).replace(":", "h");

/** « samedi 6 décembre, 18h00 – 22h00 » */
export function when(e) {
  const start = new Date(e.startsAt);
  const date = start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  if (!e.endsAt) return `${date}, ${hour(start)}`;
  const sameDay =
    new Date(e.endsAt).toLocaleDateString("fr-FR", { timeZone: TZ }) === start.toLocaleDateString("fr-FR", { timeZone: TZ });
  if (sameDay) return `${date}, ${hour(start)} – ${hour(e.endsAt)}`;
  const end = new Date(e.endsAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ });
  return `du ${date}, ${hour(start)} au ${end}, ${hour(e.endsAt)}`;
}

/** Ce que l'annonce dit de l'inscription. */
export function registrationLabel(e) {
  if (e.registrationMode !== "required") return "Entrée libre";
  if (e.closedReason === "full") return "Complet";
  if (e.closedReason === "deadline") return "Inscriptions closes";
  if (e.closedReason === "started") return "En cours";
  if (e.seatsLeft != null && e.seatsLeft <= 20) return `Sur inscription, ${e.seatsLeft} place${e.seatsLeft > 1 ? "s" : ""} restante${e.seatsLeft > 1 ? "s" : ""}`;
  if (e.registrationDeadline) {
    const d = new Date(e.registrationDeadline).toLocaleDateString("fr-FR", { day: "numeric", month: "long", timeZone: TZ });
    return `Sur inscription, avant le ${d}`;
  }
  return "Sur inscription";
}

export const FALLBACK_IMAGE = "/images/design/assemblee-large.jpg";
