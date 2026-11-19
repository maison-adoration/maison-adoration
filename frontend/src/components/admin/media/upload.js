// Envoi d'un fichier par l'équipe média → URL publique (Cloudinary).
import api from "../../../utils/api";
import { resizeImage } from "../../../utils/image";

export async function uploadMediaFile(file, kind) {
  const fd = new FormData();
  fd.append("file", kind === "image" ? await resizeImage(file, 2000, 0.82) : file);
  const res = await api.post(`/media/uploads?kind=${kind}`, fd, { timeout: 10 * 60 * 1000 });
  return res.data.url;
}

/** « 2026-11-19T08:30:00Z » → valeur d'un champ datetime-local (heure locale). */
export const toLocalInput = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const formatDate = (v, withTime = false) => {
  if (!v) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T12:00:00`) : new Date(v);
  return withTime
    ? d.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })
    : d.toLocaleDateString("fr-FR", { dateStyle: "medium" });
};
