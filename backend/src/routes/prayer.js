// Équipe de prière (gestion de l'église) : demandes de prière reçues pendant
// le direct et la semaine, et décisions « J'ai donné ma vie à Christ ».
const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { optionalAuth, requireAdmin } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { sendReport } = require('../services/report');

const router = express.Router();
const id = z.string().trim().min(1).max(64);

const PRAYER_STATUS = { new: 'Nouvelle', praying: 'En prière', answered: 'Exaucée', archived: 'Archivée' };
const DECISION_STATUS = { new: 'À contacter', contacted: 'Contacté', archived: 'Archivé' };

const prayerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demande déjà envoyée. Réessayez plus tard.' },
});

/* Public : envoyer une demande de prière (avec ou sans direct en cours). */
router.post(
  '/prayer-requests',
  prayerLimiter,
  optionalAuth,
  validate({
    body: z.object({
      name: z.string().trim().min(2, 'Indiquez votre nom').max(120),
      phone: z.string().trim().max(40).default(''),
      request: z.string().trim().min(5, 'Décrivez votre sujet de prière').max(2000),
      wantsCall: z.boolean().default(false),
      streamId: id.optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (b.wantsCall && b.phone.replace(/\D/g, '').length < 8) throw HttpError.badRequest('Indiquez un numéro pour être rappelé');
    let streamId = null;
    if (b.streamId) {
      const { rows } = await db.query('SELECT id, prayer_enabled FROM live_streams WHERE id = $1', [b.streamId]);
      if (rows[0]?.prayer_enabled) streamId = rows[0].id;
    }
    await db.query(
      `INSERT INTO prayer_requests (stream_id, user_id, name, phone, request, wants_call) VALUES ($1, $2, $3, $4, $5, $6)`,
      [streamId, req.user?.id ?? null, b.name, b.phone, b.request, b.wantsCall],
    );
    res.status(201).json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Gestion de l'église
// ---------------------------------------------------------------------------

const listQuery = z.object({ status: z.string().trim().max(20).optional() });

router.get(
  '/prayer-requests',
  requireAdmin,
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const { status } = req.validQuery;
    const args = [];
    let where = '';
    if (status && PRAYER_STATUS[status]) { args.push(status); where = 'WHERE p.status = $1'; }
    const [items, counts] = await Promise.all([
      db.query(
        `SELECT p.*, s.title AS stream_title FROM prayer_requests p LEFT JOIN live_streams s ON s.id = p.stream_id
         ${where} ORDER BY (p.status = 'new') DESC, p.created_at DESC LIMIT 500`,
        args,
      ),
      db.query('SELECT status, count(*)::int AS n FROM prayer_requests GROUP BY status'),
    ]);
    res.json({ items: items.rows, counts: Object.fromEntries(counts.rows.map((r) => [r.status, r.n])) });
  }),
);

router.put(
  '/prayer-requests/:id',
  requireAdmin,
  validate({ params: z.object({ id }), body: z.object({ status: z.enum(Object.keys(PRAYER_STATUS)) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('UPDATE prayer_requests SET status = $1 WHERE id = $2 RETURNING *', [req.body.status, req.params.id]);
    if (!rows[0]) throw HttpError.notFound();
    res.json(rows[0]);
  }),
);

router.delete(
  '/prayer-requests/:id',
  requireAdmin,
  validate({ params: z.object({ id }) }),
  asyncHandler(async (req, res) => {
    const r = await db.query('DELETE FROM prayer_requests WHERE id = $1', [req.params.id]);
    if (!r.rowCount) throw HttpError.notFound();
    res.json({ ok: true });
  }),
);

router.get(
  '/prayer-requests/export.:format(xlsx|pdf)',
  requireAdmin,
  validate({ params: z.object({ format: z.enum(['xlsx', 'pdf']) }), query: listQuery }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT p.*, s.title AS stream_title FROM prayer_requests p LEFT JOIN live_streams s ON s.id = p.stream_id
       WHERE p.status <> 'archived' ORDER BY p.created_at DESC`,
    );
    const calls = rows.filter((r) => r.wants_call).length;
    await sendReport(res, req.params.format, {
      sheet: 'Prière',
      filename: 'demandes-de-priere',
      docLabel: 'ÉQUIPE DE PRIÈRE',
      title: 'Demandes de prière',
      subtitle: 'Demandes en cours (hors archivées)',
      kpis: [
        { label: 'Demandes', value: rows.length },
        { label: 'Nouvelles', value: rows.filter((r) => r.status === 'new').length },
        { label: 'À rappeler', value: calls },
      ],
      columns: [
        { header: 'Reçue le', key: 'createdAt', width: 17, pdf: 12, type: 'datetime', muted: true },
        { header: 'Nom', key: 'name', width: 24, pdf: 16, bold: true },
        { header: 'Téléphone', key: 'phone', width: 17, pdf: 13 },
        { header: 'Rappel', key: 'call', width: 9, pdf: 6, type: 'check' },
        { header: 'Sujet de prière', key: 'request', width: 60, pdf: 42 },
        { header: 'Statut', key: 'status', width: 12, pdf: 10 },
        { header: 'Direct', key: 'stream', width: 26, pdf: false },
      ],
      rows: rows.map((r) => ({
        createdAt: r.created_at, name: r.name, phone: r.phone, call: r.wants_call, request: r.request,
        status: PRAYER_STATUS[r.status], stream: r.stream_title || 'Hors direct',
      })),
      landscape: true,
    });
  }),
);

router.get(
  '/faith-decisions',
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT d.*, s.title AS stream_title FROM faith_decisions d LEFT JOIN live_streams s ON s.id = d.stream_id
       ORDER BY (d.status = 'new') DESC, d.created_at DESC LIMIT 500`,
    );
    res.json(rows);
  }),
);

router.put(
  '/faith-decisions/:id',
  requireAdmin,
  validate({ params: z.object({ id }), body: z.object({ status: z.enum(Object.keys(DECISION_STATUS)) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('UPDATE faith_decisions SET status = $1 WHERE id = $2 RETURNING *', [req.body.status, req.params.id]);
    if (!rows[0]) throw HttpError.notFound();
    res.json(rows[0]);
  }),
);

router.get(
  '/faith-decisions/export.:format(xlsx|pdf)',
  requireAdmin,
  validate({ params: z.object({ format: z.enum(['xlsx', 'pdf']) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT d.*, s.title AS stream_title FROM faith_decisions d LEFT JOIN live_streams s ON s.id = d.stream_id
       WHERE d.status <> 'archived' ORDER BY d.created_at DESC`,
    );
    await sendReport(res, req.params.format, {
      sheet: 'Décisions',
      filename: 'decisions-pour-christ',
      docLabel: 'SUIVI DES NOUVEAUX CONVERTIS',
      title: "« J'ai donné ma vie à Christ »",
      subtitle: 'Personnes à accompagner (hors archivées)',
      kpis: [
        { label: 'Décisions', value: rows.length },
        { label: 'À contacter', value: rows.filter((r) => r.status === 'new' && r.wants_contact).length },
        { label: 'Contactées', value: rows.filter((r) => r.status === 'contacted').length },
      ],
      columns: [
        { header: 'Date', key: 'createdAt', width: 17, pdf: 13, type: 'datetime', muted: true },
        { header: 'Nom', key: 'name', width: 28, pdf: 22, bold: true },
        { header: 'Téléphone', key: 'phone', width: 18, pdf: 15 },
        { header: 'Souhaite être contacté', key: 'contact', width: 14, pdf: 10, type: 'check' },
        { header: 'Statut', key: 'status', width: 14, pdf: 12 },
        { header: 'Direct', key: 'stream', width: 30, pdf: 22 },
        { header: 'Suivi par', key: 'sign', pdf: 18, type: 'signature', xlsx: false },
      ],
      rows: rows.map((r) => ({
        createdAt: r.created_at, name: r.name, phone: r.phone, contact: r.wants_contact,
        status: DECISION_STATUS[r.status], stream: r.stream_title || '',
      })),
    });
  }),
);

module.exports = router;
