// Module média (réécrit d'après le rôle « média » de MAN Platform).
//
// /media/...         → équipe média (rôles media, admin, super-admin) : tout voir, créer, publier
// /media/public/...  → visiteurs : uniquement ce qui est publié
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { requireMedia } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { uploadMedia, storage } = require('../services/storage');
const notifier = require('../services/notifier');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const youtube = require('../services/youtube');
const { parseScriptures, BOOK_ORDER } = require('../utils/bible');
const { optionalAuth } = require('../middlewares/auth');

const router = express.Router();

// ---------------------------------------------------------------------------
// Outils communs
// ---------------------------------------------------------------------------

const id = z.string().trim().min(1).max(64);
const idParam = z.object({ id });
const url = z.string().trim().url('Lien invalide').max(1000);
const optUrl = url.nullable().optional().or(z.literal('').transform(() => null));
const text = (max) => z.string().trim().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ');
const isoDateTime = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Date et heure invalides')
  .transform((v) => new Date(v).toISOString());

/** Construit un UPDATE ne touchant que les champs envoyés (noms de colonnes en liste blanche). */
async function updateRow(table, rowId, body, columns) {
  const sets = [];
  const values = [];
  for (const [key, column] of Object.entries(columns)) {
    if (body[key] === undefined) continue;
    values.push(body[key]);
    sets.push(`${column} = $${values.length}`);
  }
  if (!sets.length) throw HttpError.badRequest('Aucune modification envoyée');
  values.push(rowId);
  const { rows } = await db.query(
    `UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
    values,
  );
  if (!rows[0]) throw HttpError.notFound();
  return rows[0];
}

/** Routes publier / dépublier / supprimer, identiques pour chaque type de contenu. */
function lifecycle(path, table, { onPublish } = {}) {
  router.post(
    `${path}/:id/publish`,
    requireMedia,
    validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      // Sans date : maintenant. Avec une date future : publication programmée.
      const at = req.body && req.body.publishAt ? new Date(req.body.publishAt) : null;
      if (at && Number.isNaN(at.getTime())) throw HttpError.badRequest('Date de publication invalide');
      const { rows } = await db.query(
        `UPDATE ${table} SET is_published = true,
           published_at = CASE WHEN $2::timestamptz IS NOT NULL THEN $2::timestamptz
                               WHEN published_at IS NULL OR published_at > now() THEN now()
                               ELSE published_at END
         WHERE id = $1 RETURNING *`,
        [req.params.id, at ? at.toISOString() : null],
      );
      if (!rows[0]) throw HttpError.notFound();
      const scheduled = new Date(rows[0].published_at) > new Date();
      if (onPublish && !scheduled) onPublish(rows[0]).catch(() => {}); // une notification en échec n'annule pas la publication
      res.json(rows[0]);
    }),
  );
  router.post(
    `${path}/:id/unpublish`,
    requireMedia,
    validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      const { rows } = await db.query(`UPDATE ${table} SET is_published = false WHERE id = $1 RETURNING *`, [
        req.params.id,
      ]);
      if (!rows[0]) throw HttpError.notFound();
      res.json(rows[0]);
    }),
  );
  router.delete(
    `${path}/:id`,
    requireMedia,
    validate({ params: idParam }),
    asyncHandler(async (req, res) => {
      const result = await db.query(`DELETE FROM ${table} WHERE id = $1`, [req.params.id]);
      if (result.rowCount === 0) throw HttpError.notFound();
      res.json({ ok: true });
    }),
  );
}

const announce = (title, body, link) => notifier.pushMessage({ title, body, url: link });

// ---------------------------------------------------------------------------
// Envoi de fichiers (image, audio, PDF) → URL Cloudinary
// ---------------------------------------------------------------------------

router.post(
  '/uploads',
  requireMedia,
  uploadMedia.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw HttpError.badRequest('Aucun fichier reçu');
    const fileUrl = await storage.uploadFile(req.file, req.query.kind === 'image' ? 'media' : req.query.kind);
    res.status(201).json({ url: fileUrl, bytes: req.file.size, name: req.file.originalname });
  }),
);

// ---------------------------------------------------------------------------
// Tableau de bord
// ---------------------------------------------------------------------------

router.get(
  '/dashboard',
  requireMedia,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(`
      SELECT
        (SELECT count(*) FROM sermons)::int AS "totalSermons",
        (SELECT count(*) FROM sermons WHERE is_published)::int AS "publishedSermons",
        (SELECT count(*) FROM sermons WHERE is_published AND published_at > now())::int AS "scheduledSermons",
        (SELECT count(*) FROM sermons WHERE is_published AND coalesce(audio_url, '') = '')::int AS "sermonsWithoutAudio",
        (SELECT coalesce(sum(views_count), 0) FROM sermons)::int AS "totalViews",
        (SELECT count(*) FROM sermons WHERE coalesce(thumbnail_url, '') = ''
            OR (coalesce(video_url, '') = '' AND coalesce(audio_url, '') = ''))::int AS "incompleteSermons",
        (SELECT count(*) FROM sermon_series WHERE is_active)::int AS "activeSeries",
        (SELECT count(*) FROM gallery_albums)::int AS "totalAlbums",
        (SELECT count(*) FROM gallery_albums WHERE is_published)::int AS "publishedAlbums",
        (SELECT count(*) FROM gallery_photos)::int AS "totalPhotos",
        (SELECT count(*) FROM podcasts)::int AS "totalPodcasts",
        (SELECT count(*) FROM podcasts WHERE is_published)::int AS "publishedPodcasts",
        (SELECT coalesce(sum(plays_count), 0) FROM podcasts)::int AS "totalPlays",
        (SELECT count(*) FROM press_releases WHERE is_published)::int AS "publishedPress",
        (SELECT count(*) FROM live_streams WHERE is_live)::int AS "liveStreams",
        (SELECT count(*) FROM live_streams WHERE NOT is_live AND ended_at IS NULL AND scheduled_at >= now())::int AS "scheduledStreams"`);
    const recent = await db.query(
      `SELECT s.*, ss.name AS series_name FROM sermons s LEFT JOIN sermon_series ss ON ss.id = s.series_id
       ORDER BY s.created_at DESC LIMIT 5`,
    );
    const upcoming = await db.query(
      `SELECT * FROM live_streams WHERE ended_at IS NULL AND (is_live OR scheduled_at >= now())
       ORDER BY is_live DESC, scheduled_at ASC LIMIT 4`,
    );
    const stats = rows[0];
    stats.draftSermons = stats.totalSermons - stats.publishedSermons;
    res.json({ stats, recentSermons: recent.rows, upcomingStreams: upcoming.rows });
  }),
);

// ---------------------------------------------------------------------------
// Séries de sermons
// ---------------------------------------------------------------------------

const seriesFields = {
  name: z.string().trim().min(2).max(300),
  description: text(5000),
  coverImageUrl: optUrl,
  isActive: z.boolean(),
};
const seriesColumns = { name: 'name', description: 'description', coverImageUrl: 'cover_image_url', isActive: 'is_active' };

router.get(
  '/series',
  requireMedia,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT ss.*, (SELECT count(*) FROM sermons s WHERE s.series_id = ss.id)::int AS sermons_count
       FROM sermon_series ss ORDER BY ss.created_at DESC`,
    );
    res.json(rows);
  }),
);

router.post(
  '/series',
  requireMedia,
  validate({ body: z.object({ ...seriesFields, description: seriesFields.description.default(''), isActive: z.boolean().default(true) }) }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      'INSERT INTO sermon_series (name, description, cover_image_url, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
      [b.name, b.description, b.coverImageUrl ?? null, b.isActive],
    );
    res.status(201).json(rows[0]);
  }),
);

router.put(
  '/series/:id',
  requireMedia,
  validate({ params: idParam, body: z.object(seriesFields).partial().strict() }),
  asyncHandler(async (req, res) => res.json(await updateRow('sermon_series', req.params.id, req.body, seriesColumns))),
);

router.delete(
  '/series/:id',
  requireMedia,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    // Les sermons de la série sont conservés, simplement détachés.
    const result = await db.query('DELETE FROM sermon_series WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) throw HttpError.notFound();
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Sermons
// ---------------------------------------------------------------------------

const sermonFields = {
  title: z.string().trim().min(2).max(300),
  description: text(10000),
  preacher: text(200),
  sermonDate: isoDate,
  videoUrl: optUrl,
  audioUrl: optUrl,
  pdfUrl: optUrl,
  thumbnailUrl: optUrl,
  seriesId: id.nullable().optional().or(z.literal('').transform(() => null)),
  isFeatured: z.boolean(),
  scriptures: text(500),
  chapters: z
    .array(z.object({ t: z.number().int().min(0).max(86400), label: z.string().trim().min(1).max(120) }))
    .max(40)
    .transform((list) => [...list].sort((a, b) => a.t - b.t)),
  durationSeconds: z.number().int().min(0).max(86400).nullable(),
  audioBytes: z.number().int().min(0).max(2 * 1024 ** 3).nullable(),
};
const sermonColumns = {
  title: 'title',
  description: 'description',
  preacher: 'preacher',
  sermonDate: 'sermon_date',
  videoUrl: 'video_url',
  audioUrl: 'audio_url',
  pdfUrl: 'pdf_url',
  thumbnailUrl: 'thumbnail_url',
  seriesId: 'series_id',
  isFeatured: 'is_featured',
  scriptures: 'scriptures',
  bibleBooks: 'bible_books',
  chapters: 'chapters',
  durationSeconds: 'duration_seconds',
  audioBytes: 'audio_bytes',
};

/** Passages saisis → texte normalisé + livres (pour le filtre). Refuse un livre inconnu. */
function withScriptures(body) {
  if (body.scriptures === undefined) return body;
  const { refs, books, unknown } = parseScriptures(body.scriptures);
  if (unknown.length) {
    throw HttpError.badRequest(`Passage non reconnu : « ${unknown[0]} ». Écrivez par exemple « Jean 3:16 ; Romains 8 ».`);
  }
  return { ...body, scriptures: refs.join(' ; '), bibleBooks: books };
}

/** Adresse lisible et unique d'un message : « la-puissance-de-la-louange ». */
async function uniqueSlug(title, exceptId = null) {
  const base =
    title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70) || 'message';
  for (let i = 1; i < 200; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const { rows } = await db.query('SELECT 1 FROM sermons WHERE slug = $1 AND ($2::text IS NULL OR id <> $2)', [slug, exceptId]);
    if (!rows[0]) return slug;
  }
  return `${base}-${Date.now()}`;
}

async function checkSeries(seriesId) {
  if (!seriesId) return;
  const { rows } = await db.query('SELECT 1 FROM sermon_series WHERE id = $1', [seriesId]);
  if (!rows[0]) throw HttpError.notFound('Série introuvable');
}

router.get(
  '/sermons',
  requireMedia,
  validate({ query: z.object({ search: text(100).default(''), seriesId: id.optional() }) }),
  asyncHandler(async (req, res) => {
    const { search, seriesId } = req.validQuery;
    const { rows } = await db.query(
      `SELECT s.*, ss.name AS series_name FROM sermons s LEFT JOIN sermon_series ss ON ss.id = s.series_id
       WHERE s.title ILIKE $1 AND ($2::text IS NULL OR s.series_id = $2)
       ORDER BY s.sermon_date DESC, s.created_at DESC LIMIT 200`,
      [`%${search.replace(/[%_\\]/g, '\\$&')}%`, seriesId ?? null],
    );
    res.json(rows);
  }),
);

router.post(
  '/sermons',
  requireMedia,
  validate({
    body: z.object({
      ...sermonFields,
      description: sermonFields.description.default(''),
      preacher: sermonFields.preacher.default(''),
      sermonDate: isoDate.optional(),
      isFeatured: z.boolean().default(false),
      scriptures: text(500).default(''),
      chapters: sermonFields.chapters.default([]),
      durationSeconds: sermonFields.durationSeconds.optional(),
      audioBytes: sermonFields.audioBytes.optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = withScriptures(req.body);
    await checkSeries(b.seriesId);
    const { rows } = await db.query(
      `INSERT INTO sermons (title, description, preacher, sermon_date, video_url, audio_url, pdf_url,
                            thumbnail_url, series_id, is_featured, created_by_id, slug, scriptures, bible_books,
                            chapters, duration_seconds, audio_bytes)
       VALUES ($1, $2, $3, coalesce($4::date, current_date), $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [b.title, b.description, b.preacher, b.sermonDate ?? null, b.videoUrl ?? null, b.audioUrl ?? null,
        b.pdfUrl ?? null, b.thumbnailUrl ?? null, b.seriesId ?? null, b.isFeatured, req.user.id,
        await uniqueSlug(b.title), b.scriptures, b.bibleBooks || [], JSON.stringify(b.chapters), b.durationSeconds ?? null, b.audioBytes ?? null],
    );
    res.status(201).json(rows[0]); // brouillon : publié séparément
  }),
);

router.put(
  '/sermons/:id',
  requireMedia,
  validate({ params: idParam, body: z.object(sermonFields).partial().strict() }),
  asyncHandler(async (req, res) => {
    const body = withScriptures(req.body);
    await checkSeries(body.seriesId);
    if (body.chapters) body.chapters = JSON.stringify(body.chapters);
    res.json(await updateRow('sermons', req.params.id, body, sermonColumns));
  }),
);

lifecycle('/sermons', 'sermons', {
  onPublish: (s) => announce(`Nouveau sermon : ${s.title}`, s.preacher || 'Maison d\'Adoration pour les Nations', '/mediatheque#sermons'),
});

/* Import depuis YouTube : on colle le lien, le site remplit le reste. */
router.get(
  '/youtube',
  requireMedia,
  validate({ query: z.object({ url: z.string().trim().min(5, 'Collez le lien de la vidéo YouTube').max(500) }) }),
  asyncHandler(async (req, res) => {
    res.json({ ...(await youtube.lookup(req.validQuery.url)), apiKey: config.youtube.enabled });
  }),
);

/* Événements proposés pour relier un album ou un appel à l'action pendant le direct. */
router.get(
  '/events-options',
  requireMedia,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, title, starts_at, registration_mode FROM events
       WHERE starts_at > now() - interval '1 year' ORDER BY starts_at DESC LIMIT 100`,
    );
    res.json(rows);
  }),
);

/* Équipement et outils : ce qui est en place, ce qui manque (aucun secret). */
router.get(
  '/tools-status',
  requireMedia,
  asyncHandler(async (req, res) => {
    res.json({
      youtubeApiKey: config.youtube.enabled,
      storage: config.cloudinary.enabled,
      apiPublicUrl: Boolean(config.apiPublicUrl),
      push: config.vapid.enabled,
      podcastUrl: config.apiPublicUrl ? `${config.apiPublicUrl}/podcast.xml` : null,
    });
  }),
);

// ---------------------------------------------------------------------------
// Galerie photo
// ---------------------------------------------------------------------------

const albumFields = {
  title: z.string().trim().min(2).max(300),
  description: text(5000),
  eventDate: isoDate.nullable().optional().or(z.literal('').transform(() => null)),
  coverImageUrl: optUrl,
  eventId: id.nullable().optional().or(z.literal('').transform(() => null)),
};
const albumColumns = { title: 'title', description: 'description', eventDate: 'event_date', coverImageUrl: 'cover_image_url', eventId: 'event_id' };

const albumSelect = `SELECT a.*, (SELECT count(*) FROM gallery_photos p WHERE p.album_id = a.id)::int AS photos_count,
  (SELECT title FROM events ev WHERE ev.id = a.event_id) AS event_title,
  coalesce(a.cover_image_url, (SELECT url FROM gallery_photos p WHERE p.album_id = a.id ORDER BY position, created_at LIMIT 1)) AS cover
  FROM gallery_albums a`;

router.get(
  '/gallery',
  requireMedia,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(`${albumSelect} ORDER BY coalesce(a.event_date, a.created_at::date) DESC`);
    res.json(rows);
  }),
);

router.get(
  '/gallery/:id',
  requireMedia,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(`${albumSelect} WHERE a.id = $1`, [req.params.id]);
    if (!rows[0]) throw HttpError.notFound('Album introuvable');
    const photos = await db.query('SELECT * FROM gallery_photos WHERE album_id = $1 ORDER BY position, created_at', [
      req.params.id,
    ]);
    res.json({ ...rows[0], photos: photos.rows });
  }),
);

router.post(
  '/gallery',
  requireMedia,
  validate({ body: z.object({ ...albumFields, description: albumFields.description.default('') }) }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      `INSERT INTO gallery_albums (title, description, event_date, cover_image_url, event_id, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [b.title, b.description, b.eventDate ?? null, b.coverImageUrl ?? null, b.eventId ?? null, req.user.id],
    );
    res.status(201).json(rows[0]);
  }),
);

router.put(
  '/gallery/:id',
  requireMedia,
  validate({ params: idParam, body: z.object(albumFields).partial().strict() }),
  asyncHandler(async (req, res) => res.json(await updateRow('gallery_albums', req.params.id, req.body, albumColumns))),
);

router.post(
  '/gallery/:id/photos',
  requireMedia,
  validate({
    params: idParam,
    body: z.object({ photos: z.array(z.object({ url, caption: text(500).default('') })).min(1).max(100) }),
  }),
  asyncHandler(async (req, res) => {
    const added = await db.transaction(async (client) => {
      const { rows: album } = await client.query('SELECT id FROM gallery_albums WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!album[0]) throw HttpError.notFound('Album introuvable');
      const { rows: last } = await client.query(
        'SELECT coalesce(max(position), -1) AS p FROM gallery_photos WHERE album_id = $1',
        [req.params.id],
      );
      const out = [];
      let position = last[0].p + 1;
      for (const p of req.body.photos) {
        const { rows } = await client.query(
          'INSERT INTO gallery_photos (album_id, url, caption, position) VALUES ($1, $2, $3, $4) RETURNING *',
          [req.params.id, p.url, p.caption, position++],
        );
        out.push(rows[0]);
      }
      return out;
    });
    res.status(201).json(added);
  }),
);

router.put(
  '/photos/:id',
  requireMedia,
  validate({ params: idParam, body: z.object({ caption: text(500), position: z.number().int().min(0) }).partial().strict() }),
  asyncHandler(async (req, res) =>
    res.json(await updateRow('gallery_photos', req.params.id, req.body, { caption: 'caption', position: 'position' })),
  ),
);

router.delete(
  '/photos/:id',
  requireMedia,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const result = await db.query('DELETE FROM gallery_photos WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) throw HttpError.notFound('Photo introuvable');
    res.json({ ok: true });
  }),
);

lifecycle('/gallery', 'gallery_albums', {
  onPublish: (a) => announce(`Nouvel album photo : ${a.title}`, 'Revivez nos moments en images', '/mediatheque#galerie'),
});

// ---------------------------------------------------------------------------
// Podcasts
// ---------------------------------------------------------------------------

const podcastFields = {
  title: z.string().trim().min(2).max(300),
  description: text(10000),
  audioUrl: url,
  thumbnailUrl: optUrl,
  seasonNumber: z.coerce.number().int().min(1).max(100),
  episodeNumber: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  durationSeconds: z.coerce.number().int().min(0).max(86400).nullable().optional(),
  audioBytes: z.coerce.number().int().min(0).nullable().optional(),
};
const podcastColumns = {
  title: 'title',
  description: 'description',
  audioUrl: 'audio_url',
  thumbnailUrl: 'thumbnail_url',
  seasonNumber: 'season_number',
  episodeNumber: 'episode_number',
  durationSeconds: 'duration_seconds',
  audioBytes: 'audio_bytes',
};

router.get(
  '/podcasts',
  requireMedia,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM podcasts ORDER BY season_number DESC, episode_number DESC NULLS LAST, created_at DESC',
    );
    res.json(rows);
  }),
);

router.post(
  '/podcasts',
  requireMedia,
  validate({
    body: z.object({ ...podcastFields, description: podcastFields.description.default(''), seasonNumber: podcastFields.seasonNumber.default(1) }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      `INSERT INTO podcasts (title, description, audio_url, thumbnail_url, season_number, episode_number,
                             duration_seconds, audio_bytes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [b.title, b.description, b.audioUrl, b.thumbnailUrl ?? null, b.seasonNumber, b.episodeNumber ?? null,
        b.durationSeconds ?? null, b.audioBytes ?? null, req.user.id],
    );
    res.status(201).json(rows[0]);
  }),
);

router.put(
  '/podcasts/:id',
  requireMedia,
  validate({ params: idParam, body: z.object(podcastFields).partial().strict() }),
  asyncHandler(async (req, res) => res.json(await updateRow('podcasts', req.params.id, req.body, podcastColumns))),
);

lifecycle('/podcasts', 'podcasts', {
  onPublish: (p) => announce(`Nouvel épisode : ${p.title}`, 'Podcast de la Maison d\'Adoration pour les Nations', '/mediatheque#podcasts'),
});

// ---------------------------------------------------------------------------
// Communiqués de presse
// ---------------------------------------------------------------------------

const pressFields = {
  title: z.string().trim().min(2).max(300),
  excerpt: text(600),
  content: z.string().trim().min(1, 'Le texte du communiqué est obligatoire').max(50000),
  coverImageUrl: optUrl,
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
};
const pressColumns = { title: 'title', excerpt: 'excerpt', content: 'content', coverImageUrl: 'cover_image_url', tags: 'tags' };

router.get(
  '/press',
  requireMedia,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM press_releases ORDER BY coalesce(published_at, created_at) DESC');
    res.json(rows);
  }),
);

router.post(
  '/press',
  requireMedia,
  validate({ body: z.object({ ...pressFields, excerpt: pressFields.excerpt.default(''), tags: pressFields.tags.default([]) }) }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      `INSERT INTO press_releases (title, excerpt, content, cover_image_url, tags, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [b.title, b.excerpt, b.content, b.coverImageUrl ?? null, b.tags, req.user.id],
    );
    res.status(201).json(rows[0]);
  }),
);

router.put(
  '/press/:id',
  requireMedia,
  validate({ params: idParam, body: z.object(pressFields).partial().strict() }),
  asyncHandler(async (req, res) => res.json(await updateRow('press_releases', req.params.id, req.body, pressColumns))),
);

lifecycle('/press', 'press_releases');

// ---------------------------------------------------------------------------
// Directs (YouTube, Facebook ou autre lien)
// ---------------------------------------------------------------------------

const streamFields = {
  title: z.string().trim().min(2).max(300),
  description: text(5000),
  platform: z.enum(['youtube', 'facebook', 'custom']),
  type: z.enum(['culte', 'conference', 'prayer', 'cours']),
  streamUrl: optUrl,
  thumbnailUrl: optUrl,
  scheduledAt: isoDateTime.nullable().optional().or(z.literal('').transform(() => null)),
  recordingUrl: optUrl,
  chatEnabled: z.boolean(),
  prayerEnabled: z.boolean(),
};
const streamColumns = {
  title: 'title',
  description: 'description',
  platform: 'platform',
  type: 'type',
  streamUrl: 'stream_url',
  thumbnailUrl: 'thumbnail_url',
  scheduledAt: 'scheduled_at',
  recordingUrl: 'recording_url',
  chatEnabled: 'chat_enabled',
  prayerEnabled: 'prayer_enabled',
};

router.get(
  '/streams',
  requireMedia,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM live_streams ORDER BY is_live DESC, (ended_at IS NULL) DESC, scheduled_at DESC NULLS LAST, created_at DESC',
    );
    res.json(rows);
  }),
);

router.post(
  '/streams',
  requireMedia,
  validate({
    body: z.object({
      ...streamFields,
      description: streamFields.description.default(''),
      platform: streamFields.platform.default('youtube'),
      type: streamFields.type.default('culte'),
      chatEnabled: z.boolean().default(true),
      prayerEnabled: z.boolean().default(true),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      `INSERT INTO live_streams (title, description, platform, type, stream_url, thumbnail_url, scheduled_at, recording_url,
                                 chat_enabled, prayer_enabled, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [b.title, b.description, b.platform, b.type, b.streamUrl ?? null, b.thumbnailUrl ?? null, b.scheduledAt ?? null,
        b.recordingUrl ?? null, b.chatEnabled, b.prayerEnabled, req.user.id],
    );
    res.status(201).json(rows[0]);
  }),
);

router.put(
  '/streams/:id',
  requireMedia,
  validate({ params: idParam, body: z.object(streamFields).partial().strict() }),
  asyncHandler(async (req, res) => res.json(await updateRow('live_streams', req.params.id, req.body, streamColumns))),
);

router.post(
  '/streams/:id/go-live',
  requireMedia,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `UPDATE live_streams SET is_live = true, started_at = now(), ended_at = NULL
       WHERE id = $1 AND coalesce(stream_url, '') <> '' RETURNING *`,
      [req.params.id],
    );
    if (!rows[0]) {
      const exists = await db.query('SELECT 1 FROM live_streams WHERE id = $1', [req.params.id]);
      if (!exists.rows[0]) throw HttpError.notFound();
      throw HttpError.badRequest('Ajoutez le lien du direct (YouTube, Facebook…) avant de le lancer');
    }
    announce(`En direct : ${rows[0].title}`, 'Rejoignez-nous maintenant', '/live').catch(() => {});
    res.json(rows[0]);
  }),
);

router.post(
  '/streams/:id/end',
  requireMedia,
  validate({
    params: idParam,
    body: z
      .object({
        // Archivage : le direct terminé devient un message de la bibliothèque.
        archive: z.boolean().default(false),
        title: z.string().trim().min(2).max(300).optional(),
        preacher: text(200).optional(),
        seriesId: id.nullable().optional().or(z.literal('').transform(() => null)),
        publish: z.boolean().default(true),
      })
      .default({}),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body || {};
    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        'UPDATE live_streams SET is_live = false, ended_at = now() WHERE id = $1 RETURNING *',
        [req.params.id],
      );
      const stream = rows[0];
      if (!stream) throw HttpError.notFound();
      await client.query('UPDATE live_moments SET is_active = false WHERE stream_id = $1', [stream.id]);
      let sermon = null;
      const video = stream.recording_url || stream.stream_url;
      if (b.archive && video && !stream.archived_sermon_id) {
        await checkSeries(b.seriesId);
        const title = b.title || stream.title;
        const day = new Date(stream.started_at || Date.now()).toLocaleDateString('en-CA', { timeZone: 'Africa/Lubumbashi' });
        const ins = await client.query(
          `INSERT INTO sermons (title, description, preacher, sermon_date, video_url, thumbnail_url, series_id,
                                is_published, published_at, created_by_id, slug)
           VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, CASE WHEN $8 THEN now() END, $9, $10) RETURNING *`,
          [title, stream.description, b.preacher || '', day, video, stream.thumbnail_url, b.seriesId ?? null,
            b.publish, req.user.id, await uniqueSlug(title)],
        );
        sermon = ins.rows[0];
        await client.query('UPDATE live_streams SET archived_sermon_id = $1, recording_url = coalesce(recording_url, $2) WHERE id = $3', [
          sermon.id, video, stream.id,
        ]);
      }
      return { ...stream, archived_sermon_id: sermon ? sermon.id : stream.archived_sermon_id, archivedSermon: sermon };
    });
    res.json(result);
  }),
);

router.delete(
  '/streams/:id',
  requireMedia,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const result = await db.query('DELETE FROM live_streams WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) throw HttpError.notFound();
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Régie du direct : modération de la discussion, appels à l'action
// ---------------------------------------------------------------------------

const chatOut = (m) => ({ id: m.id, name: m.name, body: m.body, isHost: m.is_host, isHidden: m.is_hidden, createdAt: m.created_at });
const momentOut = (m) => ({
  id: m.id, kind: m.kind, title: m.title, body: m.body, buttonLabel: m.button_label, url: m.url, eventId: m.event_id,
  isActive: m.is_active, activatedAt: m.activated_at, responses: m.responses ?? undefined,
});

router.get(
  '/streams/:id/room',
  requireMedia,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const [stream, chat, moments, prayers] = await Promise.all([
      db.query('SELECT * FROM live_streams WHERE id = $1', [req.params.id]),
      db.query('SELECT * FROM (SELECT * FROM live_chat_messages WHERE stream_id = $1 ORDER BY created_at DESC LIMIT 300) m ORDER BY created_at', [req.params.id]),
      db.query(
        `SELECT m.*, CASE WHEN m.kind = 'salvation' THEN (SELECT count(*) FROM faith_decisions d WHERE d.stream_id = m.stream_id)::int END AS responses
         FROM live_moments m WHERE m.stream_id = $1 ORDER BY m.created_at`,
        [req.params.id],
      ),
      db.query("SELECT count(*)::int AS n FROM prayer_requests WHERE stream_id = $1", [req.params.id]),
    ]);
    if (!stream.rows[0]) throw HttpError.notFound();
    res.json({ stream: stream.rows[0], messages: chat.rows.map(chatOut), moments: moments.rows.map(momentOut), prayerCount: prayers.rows[0].n });
  }),
);

router.post(
  '/streams/:id/chat',
  requireMedia,
  validate({ params: idParam, body: z.object({ body: z.string().trim().min(1).max(500) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `INSERT INTO live_chat_messages (stream_id, user_id, name, body, is_host)
       SELECT id, $2, $3, $4, true FROM live_streams WHERE id = $1 RETURNING *`,
      [req.params.id, req.user.id, req.user.name || 'Équipe M.A.N', req.body.body],
    );
    if (!rows[0]) throw HttpError.notFound();
    res.status(201).json(chatOut(rows[0]));
  }),
);

router.put(
  '/chat/:id',
  requireMedia,
  validate({ params: idParam, body: z.object({ isHidden: z.boolean() }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('UPDATE live_chat_messages SET is_hidden = $1 WHERE id = $2 RETURNING *', [req.body.isHidden, req.params.id]);
    if (!rows[0]) throw HttpError.notFound();
    res.json(chatOut(rows[0]));
  }),
);

const momentBody = z
  .object({
    kind: z.enum(['give', 'event', 'salvation', 'link']),
    title: z.string().trim().min(2).max(120),
    body: text(500).default(''),
    buttonLabel: text(40).default(''),
    url: optUrl,
    eventId: id.nullable().optional(),
  })
  .refine((m) => m.kind !== 'link' || m.url, { message: 'Indiquez le lien', path: ['url'] })
  .refine((m) => m.kind !== 'event' || m.eventId, { message: "Choisissez l'événement", path: ['eventId'] });

router.post(
  '/streams/:id/moments',
  requireMedia,
  validate({ params: idParam, body: momentBody }),
  asyncHandler(async (req, res) => {
    const m = req.body;
    const { rows } = await db.query(
      `INSERT INTO live_moments (stream_id, kind, title, body, button_label, url, event_id)
       SELECT id, $2, $3, $4, $5, $6, $7 FROM live_streams WHERE id = $1 RETURNING *`,
      [req.params.id, m.kind, m.title, m.body, m.buttonLabel, m.url ?? null, m.eventId ?? null],
    );
    if (!rows[0]) throw HttpError.notFound();
    res.status(201).json(momentOut(rows[0]));
  }),
);

router.post(
  '/moments/:id/:action(activate|deactivate)',
  requireMedia,
  validate({ params: z.object({ id, action: z.enum(['activate', 'deactivate']) }) }),
  asyncHandler(async (req, res) => {
    const on = req.params.action === 'activate';
    const out = await db.transaction(async (client) => {
      const { rows } = await client.query('SELECT * FROM live_moments WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!rows[0]) throw HttpError.notFound();
      // Un seul appel à l'action affiché à la fois.
      if (on) await client.query('UPDATE live_moments SET is_active = false WHERE stream_id = $1', [rows[0].stream_id]);
      const upd = await client.query(
        'UPDATE live_moments SET is_active = $1, activated_at = CASE WHEN $1 THEN now() ELSE activated_at END WHERE id = $2 RETURNING *',
        [on, req.params.id],
      );
      return upd.rows[0];
    });
    res.json(momentOut(out));
  }),
);

router.delete(
  '/moments/:id',
  requireMedia,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const r = await db.query('DELETE FROM live_moments WHERE id = $1', [req.params.id]);
    if (!r.rowCount) throw HttpError.notFound();
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Public : uniquement le contenu publié
// ---------------------------------------------------------------------------

/** Direct en cours, prochains directs et rediffusions (page Direct et médiathèque). */
async function liveData() {
  const [live, upcoming, replays] = await Promise.all([
    db.query('SELECT * FROM live_streams WHERE is_live ORDER BY started_at DESC LIMIT 1'),
    db.query(
      `SELECT * FROM live_streams WHERE NOT is_live AND ended_at IS NULL AND scheduled_at >= now()
       ORDER BY scheduled_at ASC LIMIT 6`,
    ),
    db.query(
      `SELECT * FROM live_streams WHERE ended_at IS NOT NULL AND coalesce(recording_url, '') <> ''
       ORDER BY ended_at DESC LIMIT 12`,
    ),
  ]);
  const clean = (rows) => rows.map(({ created_by_id, ...r }) => r);
  return { live: clean(live.rows)[0] || null, upcoming: clean(upcoming.rows), replays: clean(replays.rows) };
}

/* Page Direct : uniquement les directs (interrogée chaque minute, donc légère). */
router.get(
  '/public/live',
  asyncHandler(async (req, res) => {
    res.json(await liveData());
  }),
);

router.get(
  '/public/overview',
  asyncHandler(async (req, res) => {
    const [sermons, series, podcasts, albums, press, lives] = await Promise.all([
      db.query(
        `SELECT s.id, s.title, s.description, s.preacher, s.sermon_date, s.video_url, s.audio_url, s.pdf_url,
                s.thumbnail_url, s.series_id, s.is_featured, s.views_count, s.slug, s.scriptures, s.duration_seconds,
                ss.name AS series_name
         FROM sermons s LEFT JOIN sermon_series ss ON ss.id = s.series_id
         WHERE s.is_published AND s.published_at <= now() ORDER BY s.is_featured DESC, s.sermon_date DESC LIMIT 100`,
      ),
      db.query(
        `SELECT ss.id, ss.name, ss.description, ss.cover_image_url,
                (SELECT count(*) FROM sermons s WHERE s.series_id = ss.id AND s.is_published AND s.published_at <= now())::int AS sermons_count
         FROM sermon_series ss WHERE ss.is_active ORDER BY ss.created_at DESC`,
      ),
      db.query(
        `SELECT id, title, description, audio_url, thumbnail_url, season_number, episode_number, published_at, plays_count
         FROM podcasts WHERE is_published AND published_at <= now() ORDER BY published_at DESC LIMIT 100`,
      ),
      db.query(`${albumSelect} WHERE a.is_published AND a.published_at <= now() ORDER BY coalesce(a.event_date, a.published_at::date) DESC LIMIT 60`),
      db.query(
        `SELECT id, title, excerpt, cover_image_url, tags, published_at FROM press_releases
         WHERE is_published AND published_at <= now() ORDER BY published_at DESC LIMIT 50`,
      ),
      liveData(),
    ]);
    const albumRows = albums.rows.map(({ created_by_id, ...a }) => a);
    res.json({
      sermons: sermons.rows,
      series: series.rows,
      podcasts: podcasts.rows,
      albums: albumRows,
      press: press.rows,
      ...lives,
    });
  }),
);

router.get(
  '/public/albums/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(`${albumSelect} WHERE a.id = $1 AND a.is_published AND a.published_at <= now()`, [req.params.id]);
    if (!rows[0]) throw HttpError.notFound('Album introuvable');
    const photos = await db.query(
      'SELECT id, url, caption FROM gallery_photos WHERE album_id = $1 ORDER BY position, created_at',
      [req.params.id],
    );
    const { created_by_id, ...album } = rows[0];
    res.json({ ...album, photos: photos.rows });
  }),
);

router.get(
  '/public/press/:id',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT id, title, excerpt, content, cover_image_url, tags, published_at FROM press_releases
       WHERE id = $1 AND is_published AND published_at <= now()`,
      [req.params.id],
    );
    if (!rows[0]) throw HttpError.notFound('Communiqué introuvable');
    res.json(rows[0]);
  }),
);

/* Compteurs de vues / écoutes (sans compte) */
router.post(
  '/public/sermons/:id/view',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await db.query('UPDATE sermons SET views_count = views_count + 1 WHERE id = $1 AND is_published', [req.params.id]);
    res.json({ ok: true });
  }),
);
router.post(
  '/public/podcasts/:id/play',
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await db.query('UPDATE podcasts SET plays_count = plays_count + 1 WHERE id = $1 AND is_published', [req.params.id]);
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Public : bibliothèque des messages (recherche, filtres, page d'un message)
// ---------------------------------------------------------------------------

const PUBLIC_SERMON = `s.id, s.slug, s.title, s.description, s.preacher, s.sermon_date, s.video_url, s.audio_url, s.pdf_url,
  s.thumbnail_url, s.series_id, s.is_featured, s.views_count, s.scriptures, s.bible_books, s.chapters,
  s.duration_seconds, s.audio_bytes, ss.name AS series_name`;
const VISIBLE = 's.is_published AND s.published_at <= now()';

router.get(
  '/public/sermons',
  validate({
    query: z.object({
      search: text(120).optional(),
      preacher: text(200).optional(),
      seriesId: id.optional(),
      year: z.coerce.number().int().min(1990).max(2100).optional(),
      book: text(40).optional(),
      page: z.coerce.number().int().min(1).max(500).default(1),
      limit: z.coerce.number().int().min(1).max(48).default(24),
    }),
  }),
  asyncHandler(async (req, res) => {
    const q = req.validQuery;
    const where = [VISIBLE];
    const args = [];
    const add = (sql, v) => { args.push(v); where.push(sql.replace('?', `$${args.length}`)); };
    if (q.search) {
      const term = `%${q.search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      args.push(term);
      const n = `$${args.length}`;
      where.push(`(s.title ILIKE ${n} OR s.description ILIKE ${n} OR s.preacher ILIKE ${n} OR s.scriptures ILIKE ${n} OR ss.name ILIKE ${n})`);
    }
    if (q.preacher) add('s.preacher = ?', q.preacher);
    if (q.seriesId) add('s.series_id = ?', q.seriesId);
    if (q.year) add('extract(year FROM s.sermon_date) = ?', q.year);
    if (q.book) add('? = ANY(s.bible_books)', q.book);
    const from = `FROM sermons s LEFT JOIN sermon_series ss ON ss.id = s.series_id WHERE ${where.join(' AND ')}`;
    const [items, total] = await Promise.all([
      db.query(
        `SELECT ${PUBLIC_SERMON} ${from} ORDER BY s.sermon_date DESC NULLS LAST, s.created_at DESC
         LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
        args,
      ),
      db.query(`SELECT count(*)::int AS n ${from}`, args),
    ]);
    res.json({ items: items.rows, total: total.rows[0].n, page: q.page, limit: q.limit });
  }),
);

router.get(
  '/public/sermons/facets',
  asyncHandler(async (req, res) => {
    const base = `FROM sermons s WHERE ${VISIBLE}`;
    const [preachers, years, books, series] = await Promise.all([
      db.query(`SELECT s.preacher AS value, count(*)::int AS count ${base} AND s.preacher <> '' GROUP BY 1 ORDER BY 2 DESC, 1`),
      db.query(`SELECT extract(year FROM s.sermon_date)::int AS value, count(*)::int AS count ${base} AND s.sermon_date IS NOT NULL GROUP BY 1 ORDER BY 1 DESC`),
      db.query(`SELECT b AS value, count(*)::int AS count ${base.replace('FROM sermons s', 'FROM sermons s, unnest(s.bible_books) b')} GROUP BY 1`),
      db.query(
        `SELECT ss.id AS value, ss.name AS label, count(s.id)::int AS count FROM sermon_series ss
         JOIN sermons s ON s.series_id = ss.id AND ${VISIBLE} GROUP BY ss.id ORDER BY ss.name`,
      ),
    ]);
    const order = new Map(BOOK_ORDER.map((b, i) => [b, i]));
    res.json({
      preachers: preachers.rows,
      years: years.rows,
      books: books.rows.sort((a, b) => (order.get(a.value) ?? 99) - (order.get(b.value) ?? 99)),
      series: series.rows,
    });
  }),
);

router.get(
  '/public/sermons/by-slug/:slug',
  validate({ params: z.object({ slug: z.string().trim().min(1).max(200) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT ${PUBLIC_SERMON} FROM sermons s LEFT JOIN sermon_series ss ON ss.id = s.series_id
       WHERE ${VISIBLE} AND (s.slug = $1 OR s.id = $1)`,
      [req.params.slug],
    );
    const sermon = rows[0];
    if (!sermon) throw HttpError.notFound('Message introuvable');
    // Messages voisins : même série d'abord, sinon les plus récents.
    const { rows: related } = await db.query(
      `SELECT s.id, s.slug, s.title, s.preacher, s.sermon_date, s.thumbnail_url, s.video_url, s.duration_seconds
       FROM sermons s WHERE ${VISIBLE} AND s.id <> $1
       ORDER BY (s.series_id IS NOT DISTINCT FROM $2::text AND $2::text IS NOT NULL) DESC, s.sermon_date DESC NULLS LAST LIMIT 6`,
      [sermon.id, sermon.series_id],
    );
    res.json({ ...sermon, related });
  }),
);

// ---------------------------------------------------------------------------
// Public : salle du direct (discussion modérée, appels à l'action)
// ---------------------------------------------------------------------------

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: config.env === 'test' ? 1000 : 6,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Vous écrivez trop vite. Patientez quelques secondes.' },
});
const respondLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Réponse déjà envoyée. Réessayez plus tard.' },
});

const publicMoment = (m) => (m ? {
  id: m.id, kind: m.kind, title: m.title, body: m.body, buttonLabel: m.button_label,
  url: m.kind === 'give' ? m.url || '/#don' : m.kind === 'event' ? `/evenements#${m.event_id}` : m.url,
} : null);

router.get(
  '/public/live/:id/room',
  validate({ params: idParam, query: z.object({ since: z.string().datetime({ offset: true }).optional() }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT id, title, is_live, ended_at, chat_enabled, prayer_enabled, archived_sermon_id FROM live_streams WHERE id = $1',
      [req.params.id],
    );
    const st = rows[0];
    if (!st) throw HttpError.notFound('Direct introuvable');
    const since = req.validQuery.since;
    const [messages, moment, archived] = await Promise.all([
      st.chat_enabled
        ? db.query(
          `SELECT * FROM (SELECT id, name, body, is_host, created_at FROM live_chat_messages
             WHERE stream_id = $1 AND NOT is_hidden ${since ? 'AND created_at > $2' : ''}
             ORDER BY created_at DESC LIMIT 80) m ORDER BY created_at`,
          since ? [st.id, since] : [st.id],
        )
        : { rows: [] },
      db.query('SELECT * FROM live_moments WHERE stream_id = $1 AND is_active LIMIT 1', [st.id]),
      st.archived_sermon_id ? db.query('SELECT slug FROM sermons WHERE id = $1 AND is_published', [st.archived_sermon_id]) : { rows: [] },
    ]);
    // Messages masqués depuis le dernier passage : le client les retire.
    const hidden = since
      ? (await db.query('SELECT id FROM live_chat_messages WHERE stream_id = $1 AND is_hidden AND created_at > now() - interval \'3 hours\'', [st.id])).rows.map((r) => r.id)
      : [];
    res.json({
      isLive: st.is_live,
      ended: Boolean(st.ended_at),
      chatEnabled: st.chat_enabled,
      prayerEnabled: st.prayer_enabled,
      archivedSlug: archived.rows[0]?.slug || null,
      messages: messages.rows.map((m) => ({ id: m.id, name: m.name, body: m.body, isHost: m.is_host, createdAt: m.created_at })),
      hidden,
      moment: publicMoment(moment.rows[0]),
      serverTime: new Date().toISOString(),
    });
  }),
);

router.post(
  '/public/live/:id/chat',
  chatLimiter,
  optionalAuth,
  validate({
    params: idParam,
    body: z.object({ name: z.string().trim().min(2, 'Indiquez votre prénom').max(60), body: z.string().trim().min(1).max(300) }),
  }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT is_live, chat_enabled FROM live_streams WHERE id = $1', [req.params.id]);
    if (!rows[0]) throw HttpError.notFound('Direct introuvable');
    if (!rows[0].is_live || !rows[0].chat_enabled) throw new HttpError(409, 'La discussion est fermée pour ce direct.');
    // Liens interdits dans la discussion publique (anti-spam).
    if (/https?:\/\/|www\./i.test(req.body.body)) throw HttpError.badRequest('Les liens ne sont pas autorisés dans la discussion.');
    const ins = await db.query(
      `INSERT INTO live_chat_messages (stream_id, user_id, name, body) VALUES ($1, $2, $3, $4)
       RETURNING id, name, body, is_host, created_at`,
      [req.params.id, req.user?.id ?? null, req.user?.name || req.body.name, req.body.body],
    );
    const m = ins.rows[0];
    res.status(201).json({ id: m.id, name: m.name, body: m.body, isHost: m.is_host, createdAt: m.created_at });
  }),
);

router.post(
  '/public/moments/:id/respond',
  respondLimiter,
  optionalAuth,
  validate({
    params: idParam,
    body: z.object({
      name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
      phone: text(40).default(''),
      wantsContact: z.boolean().default(true),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query("SELECT * FROM live_moments WHERE id = $1 AND is_active AND kind = 'salvation'", [req.params.id]);
    if (!rows[0]) throw HttpError.notFound("Cet appel n'est plus ouvert");
    const b = req.body;
    if (b.wantsContact && b.phone.replace(/\D/g, '').length < 8) throw HttpError.badRequest('Indiquez un numéro pour être rappelé');
    await db.query(
      `INSERT INTO faith_decisions (stream_id, user_id, name, phone, wants_contact) VALUES ($1, $2, $3, $4, $5)`,
      [rows[0].stream_id, req.user?.id ?? null, b.name, b.phone, b.wantsContact],
    );
    res.status(201).json({ ok: true });
  }),
);

module.exports = router;
