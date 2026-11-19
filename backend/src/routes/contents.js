// Contenus : activités, podcasts, vidéos, PDF (anciennement « webinars »).
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { optionalAuth, requireAuth, requireAdmin, isAdminRole } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { contentOut, participantOut } = require('../utils/serializers');
const { upload, storage } = require('../services/storage');
const notifier = require('../services/notifier');

const router = express.Router();

const TYPES = ['activity', 'podcast', 'video', 'pdf'];
const idParam = z.object({ id: z.string().trim().min(1).max(64) });

/** Ensemble des contenus auxquels l'utilisateur a accès. */
async function accessSet(user) {
  if (!user) return new Set();
  const { rows } = await db.query('SELECT content_id FROM enrollments WHERE user_id = $1', [user.id]);
  return new Set(rows.map((r) => r.content_id));
}

async function present(rows, user) {
  const access = await accessSet(user);
  const isAdmin = Boolean(user && isAdminRole(user.role));
  return rows.map((c) => contentOut(c, { hasAccess: access.has(c.id), isAdmin }));
}

async function findContent(id) {
  const { rows } = await db.query('SELECT * FROM contents WHERE id = $1', [id]);
  if (!rows[0]) throw HttpError.notFound('Contenu introuvable');
  return rows[0];
}

/* Liste : ?page=1&type=video&search=  (le lien n'est donné que si on y a droit) */
router.get(
  '/',
  optionalAuth,
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      type: z.enum(TYPES).optional(),
      search: z.string().trim().max(100).default(''),
      limit: z.coerce.number().int().min(1).max(200).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, type, search, limit } = req.validQuery;
    const size = limit || config.pageSize;
    const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
    const { rows } = await db.query(
      `SELECT * FROM contents
       WHERE ($1::content_type IS NULL OR type = $1)
         AND (title ILIKE $2 OR description ILIKE $2)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [type ?? null, like, size, (page - 1) * size],
    );
    res.json(await present(rows, req.user));
  }),
);

/* Titres (pour les filtres de recherche du site) */
router.get(
  '/titles',
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT id, type, title FROM contents ORDER BY created_at DESC');
    res.json(rows);
  }),
);

/* Mes contenus achetés */
router.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      `SELECT c.* FROM contents c JOIN enrollments e ON e.content_id = c.id
       WHERE e.user_id = $1 ORDER BY c.created_at DESC`,
      [req.user.id],
    );
    res.json(rows.map((c) => contentOut(c, { hasAccess: true })));
  }),
);

router.get(
  '/:id',
  optionalAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const [content] = await present([await findContent(req.params.id)], req.user);
    res.json(content);
  }),
);

/* Participants d'un contenu (admin) : données limitées, jamais de mot de passe */
router.get(
  '/:id/participants',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await findContent(req.params.id);
    const { rows } = await db.query(
      `SELECT u.id, u.name, u.email, u.tel, u.country, e.created_at AS enrolled_at, e.source
       FROM enrollments e JOIN users u ON u.id = e.user_id
       WHERE e.content_id = $1 ORDER BY e.created_at DESC`,
      [req.params.id],
    );
    res.json(rows.map(participantOut));
  }),
);

/* Donner l'accès à un utilisateur à la main (admin), par son e-mail */
router.post(
  '/:id/enrollments',
  requireAdmin,
  validate({ params: idParam, body: z.object({ email: z.string().trim().toLowerCase().email() }) }),
  asyncHandler(async (req, res) => {
    const content = await findContent(req.params.id);
    const { rows } = await db.query('SELECT id FROM users WHERE email = $1', [req.body.email]);
    if (!rows[0]) throw HttpError.notFound("Aucun compte n'existe avec cet e-mail");
    const result = await db.query(
      `INSERT INTO enrollments (user_id, content_id, source) VALUES ($1, $2, 'manual')
       ON CONFLICT DO NOTHING`,
      [rows[0].id, content.id],
    );
    if (result.rowCount === 0) throw HttpError.conflict('Cet utilisateur a déjà accès à ce contenu');
    res.status(201).json({ ok: true });
  }),
);

/* Retirer un accès (admin) */
router.delete(
  '/:id/enrollments/:userId',
  requireAdmin,
  validate({ params: idParam.extend({ userId: z.string().trim().min(1).max(64) }) }),
  asyncHandler(async (req, res) => {
    const result = await db.query('DELETE FROM enrollments WHERE content_id = $1 AND user_id = $2', [
      req.params.id,
      req.params.userId,
    ]);
    if (result.rowCount === 0) throw HttpError.notFound('Accès introuvable');
    res.json({ ok: true });
  }),
);

/* Création (admin) : multipart/form-data avec « poster » (image) et, pour un PDF, « pdf » */
const createSchema = z.object({
  type: z.enum(TYPES),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(5000).default(''),
  price: z.coerce.number().min(0).max(100000).default(0),
  url: z.string().trim().url('Lien invalide').max(500).optional().or(z.literal('').transform(() => undefined)),
});

router.post(
  '/',
  requireAdmin,
  upload.fields([
    { name: 'poster', maxCount: 1 },
    { name: 'pdf', maxCount: 1 },
  ]),
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    const poster = req.files?.poster?.[0];
    const pdf = req.files?.pdf?.[0];
    if (!poster) throw HttpError.badRequest('Une affiche (image) est obligatoire');
    if (b.type === 'pdf' && !pdf) throw HttpError.badRequest('Un fichier PDF est obligatoire pour ce type');
    if ((b.type === 'video' || b.type === 'podcast') && !b.url) {
      throw HttpError.badRequest('Le lien YouTube est obligatoire pour une vidéo ou un podcast');
    }
    const posterUrl = await storage.uploadFile(poster, 'poster');
    const url = b.type === 'pdf' ? await storage.uploadFile(pdf, 'pdf') : b.url ?? null;
    const { rows } = await db.query(
      `INSERT INTO contents (type, title, description, price, url, poster_url, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [b.type, b.title, b.description, b.price, url, posterUrl, req.user.id],
    );
    res.status(201).json(contentOut(rows[0], { isAdmin: true }));
  }),
);

/* Modification des informations (admin) */
const updateSchema = createSchema.partial().strict();

router.put(
  '/:id',
  requireAdmin,
  validate({ params: idParam, body: updateSchema }),
  asyncHandler(async (req, res) => {
    await findContent(req.params.id);
    const b = req.body;
    const { rows } = await db.query(
      `UPDATE contents SET
         type = coalesce($1, type), title = coalesce($2, title),
         description = coalesce($3, description), price = coalesce($4, price),
         url = coalesce($5, url)
       WHERE id = $6 RETURNING *`,
      [b.type ?? null, b.title ?? null, b.description ?? null, b.price ?? null, b.url ?? null, req.params.id],
    );
    res.json(contentOut(rows[0], { isAdmin: true }));
  }),
);

/* Changement d'affiche (admin) */
router.put(
  '/:id/poster',
  requireAdmin,
  upload.fields([{ name: 'poster', maxCount: 1 }]),
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    await findContent(req.params.id);
    const poster = req.files?.poster?.[0];
    if (!poster) throw HttpError.badRequest('Aucune image reçue');
    const posterUrl = await storage.uploadFile(poster, 'poster');
    const { rows } = await db.query('UPDATE contents SET poster_url = $1 WHERE id = $2 RETURNING *', [
      posterUrl,
      req.params.id,
    ]);
    res.json(contentOut(rows[0], { isAdmin: true }));
  }),
);

router.delete(
  '/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const { rows: paid } = await db.query(
      "SELECT 1 FROM payments WHERE content_id = $1 AND status = 'success' LIMIT 1",
      [req.params.id],
    );
    if (paid.length) {
      throw HttpError.conflict('Ce contenu a déjà été acheté : il ne peut pas être supprimé (historique des paiements)');
    }
    const result = await db.query('DELETE FROM contents WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) throw HttpError.notFound('Contenu introuvable');
    res.json({ ok: true });
  }),
);

/* Annoncer un contenu : canal = email | sms | push (admin) */
router.post(
  '/:id/notify',
  requireAdmin,
  validate({ params: idParam, body: z.object({ channel: z.enum(['email', 'sms', 'push']) }) }),
  asyncHandler(async (req, res) => {
    const content = await findContent(req.params.id);
    const send = {
      email: notifier.emailNewContent,
      sms: notifier.smsNewContent,
      push: notifier.pushNewContent,
    }[req.body.channel];
    const result = await send(content);
    if (!result.enabled) throw HttpError.unavailable(`Le canal « ${req.body.channel} » n'est pas configuré sur le serveur`);
    res.json(result);
  }),
);

module.exports = router;
