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
      const { rows } = await db.query(
        `UPDATE ${table} SET is_published = true, published_at = coalesce(published_at, now())
         WHERE id = $1 RETURNING *`,
        [req.params.id],
      );
      if (!rows[0]) throw HttpError.notFound();
      if (onPublish) onPublish(rows[0]).catch(() => {}); // une notification en échec n'annule pas la publication
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
    res.status(201).json({ url: fileUrl });
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
};

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
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    await checkSeries(b.seriesId);
    const { rows } = await db.query(
      `INSERT INTO sermons (title, description, preacher, sermon_date, video_url, audio_url, pdf_url,
                            thumbnail_url, series_id, is_featured, created_by_id)
       VALUES ($1, $2, $3, coalesce($4::date, current_date), $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [b.title, b.description, b.preacher, b.sermonDate ?? null, b.videoUrl ?? null, b.audioUrl ?? null,
        b.pdfUrl ?? null, b.thumbnailUrl ?? null, b.seriesId ?? null, b.isFeatured, req.user.id],
    );
    res.status(201).json(rows[0]); // brouillon : publié séparément
  }),
);

router.put(
  '/sermons/:id',
  requireMedia,
  validate({ params: idParam, body: z.object(sermonFields).partial().strict() }),
  asyncHandler(async (req, res) => {
    await checkSeries(req.body.seriesId);
    res.json(await updateRow('sermons', req.params.id, req.body, sermonColumns));
  }),
);

lifecycle('/sermons', 'sermons', {
  onPublish: (s) => announce(`Nouveau sermon : ${s.title}`, s.preacher || 'Maison d\'Adoration pour les Nations', '/mediatheque#sermons'),
});

// ---------------------------------------------------------------------------
// Galerie photo
// ---------------------------------------------------------------------------

const albumFields = {
  title: z.string().trim().min(2).max(300),
  description: text(5000),
  eventDate: isoDate.nullable().optional().or(z.literal('').transform(() => null)),
  coverImageUrl: optUrl,
};
const albumColumns = { title: 'title', description: 'description', eventDate: 'event_date', coverImageUrl: 'cover_image_url' };

const albumSelect = `SELECT a.*, (SELECT count(*) FROM gallery_photos p WHERE p.album_id = a.id)::int AS photos_count,
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
      `INSERT INTO gallery_albums (title, description, event_date, cover_image_url, created_by_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [b.title, b.description, b.eventDate ?? null, b.coverImageUrl ?? null, req.user.id],
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
};
const podcastColumns = {
  title: 'title',
  description: 'description',
  audioUrl: 'audio_url',
  thumbnailUrl: 'thumbnail_url',
  seasonNumber: 'season_number',
  episodeNumber: 'episode_number',
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
      `INSERT INTO podcasts (title, description, audio_url, thumbnail_url, season_number, episode_number, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [b.title, b.description, b.audioUrl, b.thumbnailUrl ?? null, b.seasonNumber, b.episodeNumber ?? null, req.user.id],
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
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      `INSERT INTO live_streams (title, description, platform, type, stream_url, thumbnail_url, scheduled_at, recording_url, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [b.title, b.description, b.platform, b.type, b.streamUrl ?? null, b.thumbnailUrl ?? null, b.scheduledAt ?? null,
        b.recordingUrl ?? null, req.user.id],
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
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'UPDATE live_streams SET is_live = false, ended_at = now() WHERE id = $1 RETURNING *',
      [req.params.id],
    );
    if (!rows[0]) throw HttpError.notFound();
    res.json(rows[0]);
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
                s.thumbnail_url, s.series_id, s.is_featured, s.views_count, ss.name AS series_name
         FROM sermons s LEFT JOIN sermon_series ss ON ss.id = s.series_id
         WHERE s.is_published ORDER BY s.is_featured DESC, s.sermon_date DESC LIMIT 100`,
      ),
      db.query(
        `SELECT ss.id, ss.name, ss.description, ss.cover_image_url,
                (SELECT count(*) FROM sermons s WHERE s.series_id = ss.id AND s.is_published)::int AS sermons_count
         FROM sermon_series ss WHERE ss.is_active ORDER BY ss.created_at DESC`,
      ),
      db.query(
        `SELECT id, title, description, audio_url, thumbnail_url, season_number, episode_number, published_at, plays_count
         FROM podcasts WHERE is_published ORDER BY published_at DESC LIMIT 100`,
      ),
      db.query(`${albumSelect} WHERE a.is_published ORDER BY coalesce(a.event_date, a.published_at::date) DESC LIMIT 60`),
      db.query(
        `SELECT id, title, excerpt, cover_image_url, tags, published_at FROM press_releases
         WHERE is_published ORDER BY published_at DESC LIMIT 50`,
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
    const { rows } = await db.query(`${albumSelect} WHERE a.id = $1 AND a.is_published`, [req.params.id]);
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
       WHERE id = $1 AND is_published`,
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

module.exports = router;
