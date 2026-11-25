// Envoi d'un fichier par l'équipe média → URL publique (Cloudinary).
import api from "../../../utils/api";
import { resizeImage } from "../../../utils/image";

/**
 * @returns {Promise<{ url: string, bytes: number|null, name: string }>}
 * onProgress(0..1) suit l'envoi (utile pour les longs fichiers audio).
 */
export async function uploadMediaFile(file, kind, onProgress) {
  const fd = new FormData();
  fd.append("file", kind === "image" ? await resizeImage(file, 2400, 0.86) : file);
  const res = await api.post(`/media/uploads?kind=${kind}`, fd, {
    timeout: 15 * 60 * 1000,
    onUploadProgress: (e) => onProgress && e.total && onProgress(e.loaded / e.total),
  });
  return { url: res.data.url, bytes: res.data.bytes ?? file.size ?? null, name: res.data.name || file.name };
}

/** Durée (secondes) d'un fichier audio choisi, lue dans le navigateur. */
export function audioDuration(file) {
  return new Promise((resolve) => {
    const a = document.createElement("audio");
    const url = URL.createObjectURL(file);
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? Math.round(a.duration) : null);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    a.src = url;
  });
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
