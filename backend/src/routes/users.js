const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireAdmin, requireSuperAdmin, ROLE_LEVEL } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { userOut } = require('../utils/serializers');

const router = express.Router();

const idParam = z.object({ id: z.string().trim().min(1).max(64) });

/** Peut-on gérer ce compte ? Soi-même, ou un rôle strictement supérieur. */
const canManage = (actor, target) =>
  actor.id === target.id || ROLE_LEVEL[actor.role] > ROLE_LEVEL[target.role];

async function findUser(id) {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!rows[0]) throw HttpError.notFound('Utilisateur introuvable');
  return rows[0];
}

/* Liste des utilisateurs (admin) : ?page=1&search=&role= */
router.get(
  '/',
  requireAdmin,
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      search: z.string().trim().max(100).default(''),
      role: z.enum(['user', 'admin', 'super-admin']).optional(),
    }),
  }),
  asyncHandler(async (req, res) => {
    const { page, search, role } = req.validQuery;
    const like = `%${search.replace(/[%_\\]/g, '\\$&')}%`;
    const { rows } = await db.query(
      `SELECT * FROM users
       WHERE ($1::user_role IS NULL OR role = $1)
         AND (name ILIKE $2 OR email ILIKE $2 OR coalesce(tel, '') ILIKE $2)
       ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [role ?? null, like, config.pageSize, (page - 1) * config.pageSize],
    );
    res.json(rows.map(userOut));
  }),
);

router.get(
  '/:id',
  requireAdmin,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => res.json(userOut(await findUser(req.params.id)))),
);

/* Création de compte par un admin (utilisateur) ou un super-admin (admin) */
const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(128),
  tel: z.string().trim().max(30).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
  role: z.enum(['user', 'admin']).default('user'),
});

router.post(
  '/',
  requireAdmin,
  validate({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const b = req.body;
    if (b.role === 'admin' && req.user.role !== 'super-admin') {
      throw HttpError.forbidden('Seul un super-admin peut créer un admin');
    }
    try {
      const { rows } = await db.query(
        `INSERT INTO users (name, email, password_hash, tel, country, role)
         VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6) RETURNING *`,
        [b.name, b.email, await bcrypt.hash(b.password, 12), b.tel, b.country, b.role],
      );
      res.status(201).json(userOut(rows[0]));
    } catch (err) {
      if (err.code === '23505') throw HttpError.conflict('Un compte existe déjà avec cet e-mail');
      throw err;
    }
  }),
);

/* Changement de rôle (super-admin uniquement) */
router.put(
  '/:id/role',
  requireSuperAdmin,
  validate({ params: idParam, body: z.object({ role: z.enum(['user', 'admin', 'super-admin']) }) }),
  asyncHandler(async (req, res) => {
    const target = await findUser(req.params.id);
    if (target.id === req.user.id) throw HttpError.badRequest('Vous ne pouvez pas changer votre propre rôle');
    const { rows } = await db.query('UPDATE users SET role = $1 WHERE id = $2 RETURNING *', [
      req.body.role,
      target.id,
    ]);
    res.json(userOut(rows[0]));
  }),
);

/*
 * Modification du profil. Liste blanche stricte : impossible de changer
 * son rôle, son e-mail, ses accès ou son numéro par cette route.
 */
const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    tel: z.string().trim().max(30),
    country: z.string().trim().max(80),
    emailOptIn: z.boolean(),
    smsOptIn: z.boolean(),
  })
  .partial()
  .strict();

router.put(
  '/:id',
  requireAuth,
  validate({ params: idParam, body: profileSchema }),
  asyncHandler(async (req, res) => {
    const target = await findUser(req.params.id);
    if (!canManage(req.user, target)) throw HttpError.forbidden('Vous ne pouvez pas modifier ce compte');
    const b = req.body;
    const { rows } = await db.query(
      `UPDATE users SET
         name = coalesce($1, name),
         tel = coalesce($2, tel),
         country = coalesce($3, country),
         email_opt_in = coalesce($4, email_opt_in),
         sms_opt_in = coalesce($5, sms_opt_in)
       WHERE id = $6 RETURNING *`,
      [b.name ?? null, b.tel ?? null, b.country ?? null, b.emailOptIn ?? null, b.smsOptIn ?? null, target.id],
    );
    res.json(userOut(rows[0]));
  }),
);

/* Changement de mot de passe : uniquement le sien, avec l'ancien mot de passe. */
router.put(
  '/:id/password',
  requireAuth,
  validate({
    params: idParam,
    body: z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(8).max(128) }),
  }),
  asyncHandler(async (req, res) => {
    if (req.params.id !== req.user.id) throw HttpError.forbidden('Vous ne pouvez changer que votre mot de passe');
    if (!(await bcrypt.compare(req.body.currentPassword, req.user.password_hash))) {
      throw HttpError.badRequest('Le mot de passe actuel est incorrect');
    }
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [
      await bcrypt.hash(req.body.newPassword, 12),
      req.user.id,
    ]);
    res.json({ ok: true });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const target = await findUser(req.params.id);
    if (target.role === 'super-admin') throw HttpError.forbidden('Un super-admin ne peut pas être supprimé');
    if (!canManage(req.user, target)) throw HttpError.forbidden('Vous ne pouvez pas supprimer ce compte');
    await db.query('DELETE FROM users WHERE id = $1', [target.id]);
    res.json({ ok: true });
  }),
);

module.exports = router;
