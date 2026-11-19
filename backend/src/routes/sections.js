// Sections des pages de contenu (Maison, Ministères, Extensions, Dons), modifiables par les admins.
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const { optionalAuth, requireAdmin, isAdminRole } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { upload, storage } = require('../services/storage');

const router = express.Router();

const PAGES = ['maison', 'ministeres', 'extensions', 'dons'];
const idParam = z.object({ id: z.string().trim().min(1).max(64) });

const sectionOut = (s) => ({
  id: s.id,
  page: s.page,
  slug: s.slug,
  title: s.title,
  subtitle: s.subtitle,
  body: s.body,
  imageUrl: s.image_url,
  details: s.details,
  position: s.position,
  published: s.published,
  updatedAt: s.updated_at,
});

/* Sections d'une page. Les visiteurs ne voient que les sections publiées ; les admins voient tout. */
router.get(
  '/',
  optionalAuth,
  validate({ query: z.object({ page: z.enum(PAGES).optional() }) }),
  asyncHandler(async (req, res) => {
    const all = Boolean(req.user && isAdminRole(req.user.role));
    const { page } = req.validQuery;
    const { rows } = await db.query(
      `SELECT * FROM site_sections
       WHERE ($1::text IS NULL OR page = $1) AND ($2 OR published)
       ORDER BY page, position, created_at`,
      [page ?? null, all],
    );
    // Pour les visiteurs, on retire les informations pratiques laissées vides.
    res.json(
      rows.map((s) => {
        const out = sectionOut(s);
        if (!all) out.details = (out.details || []).filter((d) => d && String(d.value || '').trim());
        return out;
      }),
    );
  }),
);

const detailsSchema = z
  .array(z.object({ label: z.string().trim().min(1).max(80), value: z.string().trim().max(300) }))
  .max(20);

const fields = {
  page: z.enum(PAGES),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Identifiant : lettres minuscules, chiffres et tirets uniquement')
    .max(80),
  title: z.string().trim().min(2).max(150),
  subtitle: z.string().trim().max(200),
  body: z.string().trim().max(20000),
  details: detailsSchema,
  position: z.coerce.number().int().min(0).max(10000),
  published: z.boolean(),
};

router.post(
  '/',
  requireAdmin,
  validate({
    body: z.object({
      ...fields,
      subtitle: fields.subtitle.default(''),
      body: fields.body.default(''),
      details: detailsSchema.default([]),
      position: fields.position.default(0),
      published: z.boolean().default(false),
    }),
  }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    try {
      const { rows } = await db.query(
        `INSERT INTO site_sections (page, slug, title, subtitle, body, details, position, published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [b.page, b.slug, b.title, b.subtitle, b.body, JSON.stringify(b.details), b.position, b.published],
      );
      res.status(201).json(sectionOut(rows[0]));
    } catch (err) {
      if (err.code === '23505') throw HttpError.conflict('Cet identifiant de section existe déjà');
      throw err;
    }
  }),
);

router.put(
  '/:id',
  requireAdmin,
  validate({ params: idParam, body: z.object(fields).omit({ page: true, slug: true }).partial().strict() }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const { rows } = await db.query(
      `UPDATE site_sections SET
         title = coalesce($1, title), subtitle = coalesce($2, subtitle), body = coalesce($3, body),
         details = coalesce($4::jsonb, details), position = coalesce($5, position),
         published = coalesce($6, published)
       WHERE id = $7 RETURNING *`,
      [
        b.title ?? null,
        b.subtitle ?? null,
        b.body ?? null,
        b.details ? JSON.stringify(b.details) : null,
        b.position ?? null,
        b.published ?? null,
        req.params.id,
      ],
    );
    if (!rows[0]) throw HttpError.notFound('Section introuvable');
    res.json(sectionOut(rows[0]));
  }),
);

/* Image de la section (multipart, champ « poster ») ; ?remove=1 pour la retirer */
router.put(
  '/:id/image',
  requireAdmin,
  upload.fields([{ name: 'poster', maxCount: 1 }]),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    let imageUrl = null;
    if (req.query.remove !== '1') {
      const file = req.files?.poster?.[0];
      if (!file) throw HttpError.badRequest('Aucune image reçue');
      imageUrl = await storage.uploadFile(file, 'section');
    }
    const { rows } = await db.query('UPDATE site_sections SET image_url = $1 WHERE id = $2 RETURNING *', [
      imageUrl,
      req.params.id,
    ]);
    if (!rows[0]) throw HttpError.notFound('Section introuvable');
    res.json(sectionOut(rows[0]));
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const result = await db.query('DELETE FROM site_sections WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) throw HttpError.notFound('Section introuvable');
    res.json({ ok: true });
  }),
);

module.exports = router;
