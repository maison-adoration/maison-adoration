// Import depuis YouTube : à partir d'un lien, retrouver titre, miniature, date et durée.
// Sans clé API : oEmbed public (titre, chaîne, miniature). Avec YOUTUBE_API_KEY : en plus
// la date de publication, la durée et la description (API YouTube Data v3).
const config = require('../config');
const { HttpError } = require('../utils/http-error');

/** Identifiant de vidéo à partir de toutes les formes de lien YouTube courantes. */
function videoId(link = '') {
  let u;
  try {
    u = new URL(String(link).trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let id = null;
  if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else {
      const m = u.pathname.match(/^\/(?:embed|live|shorts|v)\/([^/?#]+)/);
      if (m) id = m[1];
    }
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

/** Durée ISO 8601 (PT1H2M3S) → secondes. */
function isoDuration(s = '') {
  const m = s.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return null;
  const [, d, h, mi, se] = m.map((x) => Number(x || 0));
  return d * 86400 + h * 3600 + mi * 60 + se;
}

const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

async function getJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'MAN-site' } });
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/**
 * @returns {Promise<{ videoId, videoUrl, title, channel, description, publishedAt, durationSeconds, thumbnailUrl, source }>}
 */
async function lookup(link) {
  const id = videoId(link);
  if (!id) throw HttpError.badRequest("Ce lien n'est pas une vidéo YouTube. Copiez l'adresse de la vidéo (youtube.com/watch?v=… ou youtu.be/…).");
  const base = { videoId: id, videoUrl: `https://www.youtube.com/watch?v=${id}`, thumbnailUrl: thumb(id) };

  if (config.youtube.apiKey) {
    try {
      const data = await getJson(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${id}&key=${encodeURIComponent(config.youtube.apiKey)}`,
      );
      const v = data.items && data.items[0];
      if (!v) throw HttpError.notFound('Vidéo introuvable ou privée sur YouTube.');
      const t = v.snippet.thumbnails || {};
      return {
        ...base,
        title: v.snippet.title,
        channel: v.snippet.channelTitle,
        description: v.snippet.description || '',
        publishedAt: v.snippet.publishedAt,
        durationSeconds: isoDuration(v.contentDetails.duration),
        thumbnailUrl: (t.maxres || t.standard || t.high || {}).url || base.thumbnailUrl,
        source: 'api',
      };
    } catch (err) {
      if (err instanceof HttpError) throw err;
      // Clé refusée ou quota dépassé : on se rabat sur oEmbed ci-dessous.
    }
  }
  try {
    const o = await getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(base.videoUrl)}`);
    return { ...base, title: o.title, channel: o.author_name, description: '', publishedAt: null, durationSeconds: null, source: 'oembed' };
  } catch (err) {
    if (err.status === 401 || err.status === 403 || err.status === 404) {
      throw HttpError.notFound('Vidéo introuvable, privée ou non intégrable sur YouTube.');
    }
    throw new HttpError(502, "YouTube ne répond pas pour l'instant. Réessayez, ou remplissez les champs à la main.");
  }
}

module.exports = { videoId, lookup, isoDuration, thumb };
