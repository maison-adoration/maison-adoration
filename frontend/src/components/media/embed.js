import getVideoId from "get-video-id";

/** Adresse intégrable (iframe) d'un lien vidéo, ou null si on ne sait pas l'intégrer. */
export function embedUrl(url) {
  if (!url) return null;
  try {
    const v = getVideoId(url);
    if (v && v.id && v.service === "youtube") return `https://www.youtube-nocookie.com/embed/${v.id}?rel=0`;
    if (v && v.id && v.service === "vimeo") return `https://player.vimeo.com/video/${v.id}`;
  } catch (e) {
    /* lien non reconnu */
  }
  if (/facebook\.com|fb\.watch/.test(url)) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
  }
  return null;
}

/** Miniature YouTube automatique quand aucune image n'a été fournie. */
export function thumbnailFor(url) {
  try {
    const v = getVideoId(url || "");
    if (v && v.id && v.service === "youtube") return `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`;
  } catch (e) {
    /* ignoré */
  }
  return null;
}
