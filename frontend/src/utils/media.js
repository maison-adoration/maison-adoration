// Outils partagés de la médiathèque : durées, partage, téléchargements.
import { API_URL } from "./api";

/** 754 → « 12:34 », 3725 → « 1:02:05 ». */
export function clock(sec) {
  const n = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = String(n % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** 3725 → « 1 h 02 », 900 → « 15 min ». */
export function duration(sec) {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

/** « 12:34 », « 1:02:05 » ou « 754 » → secondes (null si illisible). */
export function parseClock(text) {
  const parts = String(text || "").trim().split(":").map((p) => p.trim());
  if (!parts.length || parts.some((p) => !/^\d+$/.test(p)) || parts.length > 3) return null;
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0);
}

/** Page d'un message sur le site. */
export const messagePath = (s) => `/message?m=${encodeURIComponent(s.slug || s.id)}`;

/** Lien de partage : aperçu riche (titre, image) puis ouverture au moment choisi. */
export const shareLink = (slug, t = 0) => `${API_URL}/partage/m/${encodeURIComponent(slug)}${t > 0 ? `?t=${Math.floor(t)}` : ""}`;

export const whatsappUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`;

/** Flux du podcast (Apple Podcasts, Spotify, toute application de podcast). */
export const PODCAST_FEED = `${API_URL}/podcast.xml`;

/**
 * Lien de téléchargement direct : Cloudinary renvoie le fichier en pièce jointe
 * avec fl_attachment (l'attribut download est ignoré pour un autre domaine).
 */
export function downloadUrl(url, name = "") {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  const flag = name ? `fl_attachment:${slugify(name).slice(0, 60) || "fichier"}` : "fl_attachment";
  return url.replace(/\/(image|video|raw)\/upload\//, (m) => `${m}${flag}/`);
}

export const slugify = (s) =>
  String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Partage natif (téléphone) ou copie du lien ; renvoie « shared » ou « copied ». */
export async function shareOrCopy({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return null;
    }
  }
  await navigator.clipboard.writeText(url);
  return "copied";
}

/** Charge l'API du lecteur YouTube une seule fois. */
let ytReady;
export function loadYouTube() {
  if (typeof window === "undefined") return Promise.reject(new Error("navigateur requis"));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (!ytReady) {
    ytReady = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev && prev();
        resolve(window.YT);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => {
        ytReady = null;
        reject(new Error("YouTube indisponible"));
      };
      document.head.appendChild(s);
    });
  }
  return ytReady;
}
