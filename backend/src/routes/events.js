// Événements : annonce publique, inscription (si l'événement l'exige), gestion par les admins.
const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { optionalAuth, requireAdmin } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { upload, storage } = require('../services/storage');
const { sendReport } = require('../services/report');

const router = express.Router();

const idParam = z.object({ id: z.string().min(1).max(64) });
const regParams = z.object({ id: z.string().min(1).max(64), rid: z.string().min(1).max(64) });

// Places prises = somme des places des inscriptions non annulées.
const SEATS = `(SELECT coalesce(sum(r.seats), 0)::int FROM event_registrations r WHERE r.event_id = e.id AND r.status <> 'cancelled')`;
const REGS = `(SELECT count(*)::int FROM event_registrations r WHERE r.event_id = e.id AND r.status <> 'cancelled')`;
const ATTENDED = `(SELECT coalesce(sum(r.seats), 0)::int FROM event_registrations r WHERE r.event_id = e.id AND r.status = 'attended')`;

function eventOut(e, { admin = false } = {}) {
  const taken = e.seats_taken ?? 0;
  const now = Date.now();
  const closedReason =
    e.registration_mode !== 'required' ? null
    : new Date(e.starts_at).getTime() <= now ? 'started'
    : e.registration_deadline && new Date(e.registration_deadline).getTime() <= now ? 'deadline'
    : e.capacity && taken >= e.capacity ? 'full'
    : null;
  const out = {
    id: e.id,
    title: e.title,
    description: e.description,
    location: e.location,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    imageUrl: e.image_url,
    registrationMode: e.registration_mode,
    capacity: e.capacity,
    registrationDeadline: e.registration_deadline,
    seatsLeft: e.capacity ? Math.max(0, e.capacity - taken) : null,
    registrationOpen: e.registration_mode === 'required' && !closedReason,
    closedReason,
  };
  if (admin) {
    Object.assign(out, {
      isPublished: e.is_published,
      isFeatured: e.is_featured,
      seatsTaken: taken,
      registrations: e.registrations_count ?? 0,
      attended: e.attended_seats ?? 0,
      createdAt: e.created_at,
    });
  }
  return out;
}

const regOut = (r) => ({
  id: r.id, name: r.name, phone: r.phone, email: r.email, seats: r.seats, status: r.status, createdAt: r.created_at,
});

/* ---------- Public ---------- */

// Événements publiés à venir (ou en cours depuis moins de 6 h, ou pas encore terminés).
router.get(
  '/',
  validate({ query: z.object({ featured: z.enum(['1']).optional() }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT e.*, ${SEATS} AS seats_taken FROM events e
       WHERE e.is_published
         AND coalesce(e.ends_at, e.starts_at + interval '6 hours') >= now()
         AND ($1::boolean IS NULL OR e.is_featured = $1)
       ORDER BY e.starts_at LIMIT 50`,
      [req.validQuery.featured ? true : null],
    );
    res.json(rows.map((e) => eventOut(e)));
  }),
);

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: "Trop d'inscriptions envoyées. Réessayez plus tard." },
});

router.post(
  '/:id/registrations',
  registerLimiter,
  optionalAuth,
  validate({
    params: idParam,
    body: z.object({
      name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
      phone: z.string().trim().refine((p) => /^\+?\d{9,15}$/.test(p.replace(/[\s-]/g, '')), 'Numéro de téléphone invalide'),
      email: z.union([z.literal(''), z.string().trim().email('Adresse e-mail invalide').max(200)]).default(''),
      seats: z.coerce.number().int().min(1).max(10).default(1),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const phone = b.phone.replace(/[\s-]/g, '');
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      // Verrou sur l'événement : deux inscriptions simultanées ne dépassent pas la capacité.
      const { rows } = await client.query('SELECT * FROM events WHERE id = $1 AND is_published FOR UPDATE', [req.params.id]);
      const e = rows[0];
      if (!e) throw HttpError.notFound('Événement introuvable');
      if (e.registration_mode !== 'required') throw HttpError.badRequest("Cet événement est en entrée libre : pas besoin de s'inscrire.");
      const { rows: t } = await client.query(
        "SELECT coalesce(sum(seats), 0)::int AS taken FROM event_registrations WHERE event_id = $1 AND status <> 'cancelled'",
        [e.id],
      );
      const state = eventOut({ ...e, seats_taken: t[0].taken });
      if (state.closedReason === 'started') throw HttpError.badRequest("L'événement a commencé : les inscriptions sont fermées.");
      if (state.closedReason === 'deadline') throw HttpError.badRequest('La date limite des inscriptions est passée.');
      if (e.capacity && t[0].taken + b.seats > e.capacity) {
        const left = Math.max(0, e.capacity - t[0].taken);
        throw HttpError.badRequest(left ? `Il ne reste que ${left} place${left > 1 ? 's' : ''}.` : "L'événement est complet.");
      }
      const ins = await client.query(
        `INSERT INTO event_registrations (event_id, user_id, name, phone, email, seats)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (event_id, phone) DO NOTHING RETURNING *`,
        [e.id, req.user?.id ?? null, b.name, phone, b.email, b.seats],
      );
      if (!ins.rows[0]) throw HttpError.conflict('Ce numéro est déjà inscrit à cet événement.');
      await client.query('COMMIT');
      res.status(201).json({ ok: true, seats: b.seats, event: { id: e.id, title: e.title, startsAt: e.starts_at, location: e.location } });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }),
);

/* ---------- Administration (gestion de l'église) ---------- */

const eventBody = z
  .object({
    title: z.string().trim().min(3, 'Titre trop court').max(160),
    description: z.string().trim().max(4000).default(''),
    location: z.string().trim().max(200).default(''),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date().nullable().optional(),
    registrationMode: z.enum(['none', 'required']),
    capacity: z.coerce.number().int().min(1).max(100000).nullable().optional(),
    registrationDeadline: z.coerce.date().nullable().optional(),
    isPublished: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    // Photo choisie parmi celles du site, ou image déjà envoyée (Cloudinary).
    imageUrl: z
      .string()
      .regex(/^(\/images\/design\/[\w-]+\.jpg|https:\/\/res\.cloudinary\.com\/[\w./%-]+)$/, 'Image non autorisée')
      .nullable()
      .optional(),
  })
  .refine((b) => !b.endsAt || b.endsAt >= b.startsAt, { message: 'La fin doit être après le début', path: ['endsAt'] })
  .refine((b) => !b.registrationDeadline || b.registrationDeadline <= b.startsAt, {
    message: 'La clôture des inscriptions doit précéder le début',
    path: ['registrationDeadline'],
  });

const params = (b) => {
  const required = b.registrationMode === 'required';
  return [
    b.title, b.description, b.location, b.startsAt, b.endsAt ?? null, b.registrationMode,
    required ? b.capacity ?? null : null, required ? b.registrationDeadline ?? null : null, b.isPublished, b.isFeatured,
    b.imageUrl ?? null,
  ];
};

router.get(
  '/admin/all',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT e.*, ${SEATS} AS seats_taken, ${REGS} AS registrations_count, ${ATTENDED} AS attended_seats
       FROM events e ORDER BY (coalesce(e.ends_at, e.starts_at) < now()), e.starts_at`,
    );
    // À venir d'abord (du plus proche au plus lointain), puis les passés.
    const upcoming = rows.filter((e) => new Date(e.ends_at || e.starts_at) >= new Date());
    const past = rows.filter((e) => new Date(e.ends_at || e.starts_at) < new Date()).reverse();
    res.json([...upcoming, ...past].map((e) => eventOut(e, { admin: true })));
  }),
);

router.post(
  '/',
  requireAdmin,
  validate({ body: eventBody }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `INSERT INTO events (title, description, location, starts_at, ends_at, registration_mode, capacity, registration_deadline, is_published, is_featured, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      params(req.body),
    );
    res.status(201).json(eventOut(rows[0], { admin: true }));
  }),
);

router.put(
  '/:id',
  requireAdmin,
  validate({ params: idParam, body: eventBody }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `UPDATE events SET title = $1, description = $2, location = $3, starts_at = $4, ends_at = $5,
         registration_mode = $6, capacity = $7, registration_deadline = $8, is_published = $9, is_featured = $10,
         image_url = $11, updated_at = now()
       WHERE id = $12 RETURNING *`,
      [...params(req.body), req.params.id],
    );
    if (!rows[0]) throw HttpError.notFound('Événement introuvable');
    res.json(eventOut(rows[0], { admin: true }));
  }),
);

router.put(
  '/:id/image',
  requireAdmin,
  upload.fields([{ name: 'poster', maxCount: 1 }]),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const file = req.files && req.files.poster && req.files.poster[0];
    if (!file) throw HttpError.badRequest('Aucune image reçue');
    const imageUrl = await storage.uploadFile(file, 'event');
    const { rows } = await db.query('UPDATE events SET image_url = $1, updated_at = now() WHERE id = $2 RETURNING *', [imageUrl, req.params.id]);
    if (!rows[0]) throw HttpError.notFound('Événement introuvable');
    res.json({ imageUrl });
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM events WHERE id = $1', [req.params.id]);
    if (!rowCount) throw HttpError.notFound('Événement introuvable');
    res.json({ ok: true });
  }),
);

async function loadRegistrations(eventId, search = '') {
  const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
  const { rows } = await db.query(
    `SELECT * FROM event_registrations WHERE event_id = $1 AND (name ILIKE $2 OR phone ILIKE $2 OR email ILIKE $2)
     ORDER BY (status = 'cancelled'), name`,
    [eventId, like],
  );
  return rows;
}

router.get(
  '/:id/registrations',
  requireAdmin,
  validate({ params: idParam, query: z.object({ search: z.string().trim().max(100).default('') }) }),
  asyncHandler(async (req, res) => {
    res.json((await loadRegistrations(req.params.id, req.validQuery.search)).map(regOut));
  }),
);

router.put(
  '/:id/registrations/:rid',
  requireAdmin,
  validate({ params: regParams, body: z.object({ status: z.enum(['registered', 'attended', 'cancelled']) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('UPDATE event_registrations SET status = $1 WHERE id = $2 AND event_id = $3 RETURNING *', [
      req.body.status, req.params.rid, req.params.id,
    ]);
    if (!rows[0]) throw HttpError.notFound('Inscription introuvable');
    res.json(regOut(rows[0]));
  }),
);

router.delete(
  '/:id/registrations/:rid',
  requireAdmin,
  validate({ params: regParams }),
  asyncHandler(async (req, res) => {
    const { rowCount } = await db.query('DELETE FROM event_registrations WHERE id = $1 AND event_id = $2', [req.params.rid, req.params.id]);
    if (!rowCount) throw HttpError.notFound('Inscription introuvable');
    res.json({ ok: true });
  }),
);

const STATUS_FR = { registered: 'Inscrit', attended: 'Présent', cancelled: 'Annulé' };
const fmtDate = (d) =>
  new Date(d)
    .toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lubumbashi' })
    .replace(/(\d{2}):(\d{2})/, '$1h$2');

// Export des inscrits : Excel (liste de travail, annulés à part) ou PDF (liste d'émargement).
router.get(
  '/:id/registrations.:format(xlsx|pdf)',
  requireAdmin,
  validate({ params: z.object({ id: z.string().min(1).max(64), format: z.enum(['xlsx', 'pdf']) }) }),
  asyncHandler(async (req, res) => {
    const { rows: ev } = await db.query(`SELECT e.*, ${SEATS} AS seats_taken FROM events e WHERE e.id = $1`, [req.params.id]);
    const e = ev[0];
    if (!e) throw HttpError.notFound('Événement introuvable');
    const regs = (await loadRegistrations(e.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const active = regs.filter((r) => r.status !== 'cancelled');
    const cancelled = regs.filter((r) => r.status === 'cancelled');
    const seats = (list) => list.reduce((n, r) => n + r.seats, 0);
    const attended = seats(regs.filter((r) => r.status === 'attended'));
    const pdf = req.params.format === 'pdf';
    const columns = [
      { header: 'N°', key: 'n', width: 6, pdf: 4, type: 'number', muted: true },
      { header: 'Nom', key: 'name', width: 28, pdf: 24, bold: true },
      { header: 'Téléphone', key: 'phone', width: 18, pdf: 15 },
      { header: 'E-mail', key: 'email', width: 30, pdf: false },
      { header: 'Personnes', key: 'seats', width: 11, pdf: 8, type: 'number' },
      { header: pdf ? 'Présent' : 'Présence', key: 'present', width: 11, pdf: 7, type: 'check' },
      { header: 'Statut', key: 'status', width: 11, pdf: false },
      { header: 'Inscrit le', key: 'createdAt', width: 17, pdf: false, type: 'datetime' },
      { header: 'Signature', key: 'sign', pdf: 22, type: 'signature', xlsx: false },
    ];
    const toRow = (r, i) => ({
      n: i + 1, name: r.name, phone: r.phone, email: r.email, seats: r.seats,
      present: r.status === 'attended', status: STATUS_FR[r.status], createdAt: r.created_at,
    });
    await sendReport(res, req.params.format, {
      sheet: 'Inscrits',
      filename: `inscrits-${e.title}`,
      docLabel: pdf ? "LISTE D'ÉMARGEMENT" : 'LISTE DES INSCRITS',
      title: pdf ? e.title : `Inscrits : ${e.title}`,
      subtitle: [fmtDate(e.starts_at).replace(/^./, (c) => c.toUpperCase()), e.location].filter(Boolean).join(' — '),
      kpis: [
        { label: 'Inscriptions', value: active.length },
        { label: 'Personnes attendues', value: seats(active), note: e.capacity ? `/ ${e.capacity}` : '' },
        ...(e.capacity && !pdf ? [{ label: 'Places restantes', value: Math.max(0, e.capacity - seats(active)) }] : []),
        pdf && !attended ? { label: 'Présents (à remplir)', value: '_____', fill: true } : { label: 'Présents', value: attended, fill: pdf },
      ],
      columns,
      rows: active.map(toRow),
      total: { label: 'Total', values: { seats: seats(active) } },
      extraSheets: cancelled.length ? [{ name: 'Annulés', title: `Annulés : ${e.title}`, rows: cancelled.map(toRow) }] : [],
    });
  }),
);

module.exports = router;
