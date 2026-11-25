// Pages publiques servies par l'API (hors JSON) :
//  - /partage/m/:slug : aperçu riche (WhatsApp, Facebook) d'un message, puis
//    redirection vers sa page sur le site, au moment choisi (?t=secondes) ;
//  - /podcast.xml : flux RSS du podcast, à soumettre une fois à Apple Podcasts
//    et Spotify ; les nouveaux épisodes y apparaissent ensuite d'eux-mêmes.
const express = require('express');
const db = require('../db');
const config = require('../config');
const { asyncHandler } = require('../utils/http-error');
const youtube = require('../services/youtube');

const router = express.Router();

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s || '');

router.get(
  '/partage/m/:slug',
  asyncHandler(async (req, res) => {
    const slug = String(req.params.slug).slice(0, 200);
    const t = Math.max(0, Math.min(86400, parseInt(req.query.t, 10) || 0));
    const { rows } = await db.query(
      `SELECT slug, title, description, preacher, thumbnail_url, video_url FROM sermons
       WHERE is_published AND published_at <= now() AND (slug = $1 OR id = $1)`,
      [slug],
    );
    const s = rows[0];
    const target = s
      ? `${config.siteUrl}/message?m=${encodeURIComponent(s.slug)}${t ? `&t=${t}` : ''}`
      : `${config.siteUrl}/mediatheque`;
    if (!s) return res.redirect(302, target);
    const vid = youtube.videoId(s.video_url);
    const image = s.thumbnail_url || (vid ? youtube.thumb(vid) : `${config.siteUrl}/podcast-cover.jpg`);
    const desc = clip([s.preacher, s.description].filter(Boolean).join(' — ') || 'Un message de la Maison d\'Adoration pour les Nations.', 200);
    res.set('Cache-Control', 'public, max-age=300');
    res.type('html').send(`<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${esc(s.title)} | M.A.N</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="Maison d'Adoration pour les Nations">
<meta property="og:title" content="${esc(s.title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(target)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="${esc(target)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><p><a href="${esc(target)}">Ouvrir le message</a></p>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`);
  }),
);

const audioType = (u) => (/\.m4a(\?|$)/i.test(u) ? 'audio/x-m4a' : /\.(ogg|oga)(\?|$)/i.test(u) ? 'audio/ogg' : /\.wav(\?|$)/i.test(u) ? 'audio/wav' : 'audio/mpeg');
const hms = (sec) => {
  const n = Math.max(0, Math.round(sec || 0));
  return [Math.floor(n / 3600), Math.floor((n % 3600) / 60), n % 60].map((v) => String(v).padStart(2, '0')).join(':');
};

router.get(
  '/podcast.xml',
  asyncHandler(async (req, res) => {
    const [sermons, podcasts] = await Promise.all([
      db.query(
        `SELECT id, slug, title, description, preacher, audio_url, audio_bytes, duration_seconds, thumbnail_url, published_at
         FROM sermons WHERE is_published AND published_at <= now() AND coalesce(audio_url, '') <> ''
         ORDER BY published_at DESC LIMIT 300`,
      ),
      db.query(
        `SELECT id, title, description, audio_url, audio_bytes, duration_seconds, thumbnail_url, season_number, episode_number, published_at
         FROM podcasts WHERE is_published AND published_at <= now() ORDER BY published_at DESC LIMIT 300`,
      ),
    ]);
    const site = config.siteUrl;
    const cover = `${site}/podcast-cover.jpg`;
    const items = [
      ...sermons.rows.map((s) => ({
        guid: `sermon-${s.id}`, title: s.title, author: s.preacher, description: s.description, url: s.audio_url,
        bytes: s.audio_bytes, duration: s.duration_seconds, image: s.thumbnail_url, date: s.published_at,
        link: `${site}/message?m=${encodeURIComponent(s.slug)}`,
      })),
      ...podcasts.rows.map((p) => ({
        guid: `podcast-${p.id}`, title: p.title, description: p.description, url: p.audio_url, bytes: p.audio_bytes,
        duration: p.duration_seconds, image: p.thumbnail_url, date: p.published_at, season: p.season_number,
        episode: p.episode_number, link: `${site}/mediatheque`,
      })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    const self = `${config.apiPublicUrl || `${req.protocol}://${req.get('host')}`}/podcast.xml`;
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
<title>Maison d'Adoration pour les Nations</title>
<link>${esc(site)}</link>
<atom:link href="${esc(self)}" rel="self" type="application/rss+xml"/>
<language>fr</language>
<copyright>© ${new Date().getFullYear()} Maison d'Adoration pour les Nations</copyright>
<description>Prédications, enseignements et moments de prière de la Maison d'Adoration pour les Nations (M.A.N), Lubumbashi.</description>
<itunes:author>Maison d'Adoration pour les Nations</itunes:author>
<itunes:summary>Prédications, enseignements et moments de prière de la M.A.N, Lubumbashi.</itunes:summary>
<itunes:type>episodic</itunes:type>
<itunes:owner><itunes:name>Maison d'Adoration pour les Nations</itunes:name><itunes:email>maisondadoration@gmail.com</itunes:email></itunes:owner>
<itunes:image href="${esc(cover)}"/>
<image><url>${esc(cover)}</url><title>Maison d'Adoration pour les Nations</title><link>${esc(site)}</link></image>
<itunes:category text="Religion &amp; Spirituality"><itunes:category text="Christianity"/></itunes:category>
<itunes:explicit>false</itunes:explicit>
${items
    .map(
      (i) => `<item>
<title>${esc(i.title)}</title>
<guid isPermaLink="false">${esc(i.guid)}</guid>
<link>${esc(i.link)}</link>
<pubDate>${new Date(i.date).toUTCString()}</pubDate>
<description>${esc(i.description || i.title)}</description>
<enclosure url="${esc(i.url)}" length="${Number(i.bytes) || 0}" type="${audioType(i.url)}"/>
${i.author ? `<itunes:author>${esc(i.author)}</itunes:author>\n` : ''}${i.duration ? `<itunes:duration>${hms(i.duration)}</itunes:duration>\n` : ''}${i.image ? `<itunes:image href="${esc(i.image)}"/>\n` : ''}${i.season ? `<itunes:season>${i.season}</itunes:season>\n` : ''}${i.episode ? `<itunes:episode>${i.episode}</itunes:episode>\n` : ''}<itunes:explicit>false</itunes:explicit>
</item>`,
    )
    .join('\n')}
</channel>
</rss>`;
    res.set('Cache-Control', 'public, max-age=600');
    res.type('application/rss+xml; charset=utf-8').send(xml);
  }),
);

module.exports = router;
