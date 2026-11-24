// Demandes de première visite envoyées depuis l'accueil : formulaire public, suivi par les admins.
const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { optionalAuth, requireAdmin } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');

const router = express.Router();

const DAYS = ['mer', 'ven', 'dim'];
const STATUSES = ['new', 'welcomed', 'archived'];

const out = (r) => ({ id: r.id, name: r.name, phone: r.phone, day: r.day, status: r.status, createdAt: r.created_at });

const formLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de demandes envoyées. Réessayez plus tard.' },
});

router.post(
  '/',
  formLimiter,
  optionalAuth,
  validate({
    body: z.object({
      name: z.string().trim().min(2, 'Indiquez votre prénom').max(120),
      phone: z
        .string()
        .trim()
        .refine((p) => p === '' || /^\+?\d{9,15}$/.test(p.replace(/[\s-]/g, '')), 'Numéro de téléphone invalide')
        .default(''),
      day: z.enum(DAYS),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    await db.query("INSERT INTO visits (user_id, name, phone, day) VALUES ($1, $2, NULLIF($3, ''), $4)", [
      req.user?.id ?? null,
      b.name,
      b.phone,
      b.day,
    ]);
    res.status(201).json({ ok: true });
  }),
);

router.get(
  '/',
  requireAdmin,
  validate({ query: z.object({ status: z.enum(STATUSES).optional() }) }),
  asyncHandler(async (req, res) => {
    const { status } = req.validQuery;
    const { rows } = await db.query(
      `SELECT * FROM visits
       WHERE ($1::visit_status IS NULL AND status <> 'archived') OR status = $1
       ORDER BY created_at DESC LIMIT 500`,
      [status ?? null],
    );
    res.json(rows.map(out));
  }),
);

router.put(
  '/:id',
  requireAdmin,
  validate({ params: z.object({ id: z.string().trim().min(1).max(64) }), body: z.object({ status: z.enum(STATUSES) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('UPDATE visits SET status = $1 WHERE id = $2 RETURNING *', [req.body.status, req.params.id]);
    if (!rows[0]) throw HttpError.notFound('Visite introuvable');
    res.json(out(rows[0]));
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  validate({ params: z.object({ id: z.string().trim().min(1).max(64) }) }),
  asyncHandler(async (req, res) => {
    const r = await db.query('DELETE FROM visits WHERE id = $1', [req.params.id]);
    if (r.rowCount === 0) throw HttpError.notFound('Visite introuvable');
    res.json({ ok: true });
  }),
);

module.exports = router;
