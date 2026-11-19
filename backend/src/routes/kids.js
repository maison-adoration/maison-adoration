// Inscriptions des enfants à Man Kids : formulaire public, suivi par les admins.
const express = require('express');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { optionalAuth, requireAdmin } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');

const router = express.Router();

const STATUSES = ['new', 'contacted', 'enrolled', 'archived'];

const out = (r) => ({
  id: r.id,
  parentName: r.parent_name,
  parentPhone: r.parent_phone,
  parentEmail: r.parent_email,
  childName: r.child_name,
  childAge: r.child_age,
  notes: r.notes,
  status: r.status,
  createdAt: r.created_at,
});

// Évite les envois en masse du formulaire public.
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
      parentName: z.string().trim().min(2, 'Nom du parent trop court').max(120),
      parentPhone: z
        .string()
        .trim()
        .refine((p) => /^\+?\d{9,15}$/.test(p.replace(/[\s-]/g, '')), 'Numéro de téléphone invalide'),
      parentEmail: z.string().trim().toLowerCase().email('E-mail invalide').max(254).optional().or(z.literal('')),
      childName: z.string().trim().min(2, "Prénom de l'enfant trop court").max(120),
      childAge: z.coerce.number().int().min(0, 'Âge invalide').max(17, 'Man Kids accueille les moins de 18 ans'),
      notes: z.string().trim().max(1000).default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    await db.query(
      `INSERT INTO kids_registrations (user_id, parent_name, parent_phone, parent_email, child_name, child_age, notes)
       VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7)`,
      [req.user?.id ?? null, b.parentName, b.parentPhone, b.parentEmail || '', b.childName, b.childAge, b.notes],
    );
    // Rien n'est renvoyé : le formulaire est public.
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
      `SELECT * FROM kids_registrations
       WHERE ($1::kids_registration_status IS NULL AND status <> 'archived') OR status = $1
       ORDER BY created_at DESC LIMIT 500`,
      [status ?? null],
    );
    res.json(rows.map(out));
  }),
);

router.put(
  '/:id',
  requireAdmin,
  validate({
    params: z.object({ id: z.string().trim().min(1).max(64) }),
    body: z.object({ status: z.enum(STATUSES) }),
  }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('UPDATE kids_registrations SET status = $1 WHERE id = $2 RETURNING *', [
      req.body.status,
      req.params.id,
    ]);
    if (!rows[0]) throw HttpError.notFound('Inscription introuvable');
    res.json(out(rows[0]));
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  validate({ params: z.object({ id: z.string().trim().min(1).max(64) }) }),
  asyncHandler(async (req, res) => {
    const result = await db.query('DELETE FROM kids_registrations WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) throw HttpError.notFound('Inscription introuvable');
    res.json({ ok: true });
  }),
);

module.exports = router;
