const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { signToken, requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { userOut } = require('../utils/serializers');
const crypto = require('crypto');
const notifier = require('../services/notifier');

const router = express.Router();

// Limite les tentatives de connexion / inscription (anti force brute).
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Réessayez dans 15 minutes.' },
});

const email = z.string().trim().toLowerCase().email('E-mail invalide').max(254);
const password = z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères').max(128);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nom trop court').max(120),
  email,
  password,
  tel: z.string().trim().max(30).optional().default(''),
  country: z.string().trim().max(80).optional().default(''),
});

router.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const { name, email: mail, password: pwd, tel, country } = req.body;
    const passwordHash = await bcrypt.hash(pwd, 12);
    try {
      // Le rôle et les accès ne viennent JAMAIS du formulaire : valeurs par défaut uniquement.
      const { rows } = await db.query(
        `INSERT INTO users (name, email, password_hash, tel, country)
         VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, '')) RETURNING *`,
        [name, mail, passwordHash, tel, country],
      );
      const user = rows[0];
      res.status(201).json({ token: signToken(user), user: userOut(user) });
    } catch (err) {
      if (err.code === '23505') throw HttpError.conflict('Un compte existe déjà avec cet e-mail');
      throw err;
    }
  }),
);

const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

router.post(
  '/login',
  authLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
    const user = rows[0];
    // Même message que l'e-mail existe ou non : on ne révèle pas qui est inscrit.
    const ok = user && (await bcrypt.compare(req.body.password, user.password_hash));
    if (!ok) throw new HttpError(401, 'E-mail ou mot de passe incorrect');
    res.json({ token: signToken(user), user: userOut(user) });
  }),
);

router.get('/me', requireAuth, (req, res) => res.json(userOut(req.user)));

// ---------------------------------------------------------------------------
// Mot de passe oublié
// ---------------------------------------------------------------------------

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de demandes. Réessayez dans une heure.' },
});
const sha256 = (t) => crypto.createHash('sha256').update(t).digest('hex');
const RESET_TTL_MIN = 60;

router.post(
  '/forgot-password',
  resetLimiter,
  validate({ body: z.object({ email }) }),
  asyncHandler(async (req, res) => {
    // Réponse identique que le compte existe ou non : on ne révèle pas qui est inscrit.
    const answer = { ok: true, emailEnabled: config.smtp.enabled };
    if (!config.smtp.enabled) return res.json(answer);
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
    const user = rows[0];
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO password_resets (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + make_interval(mins => $3))`,
        [user.id, sha256(token), RESET_TTL_MIN],
      );
      const link = `${config.siteUrl}/mot-de-passe?token=${token}`;
      notifier.sendPasswordReset(user, link).catch((err) => {
        if (config.env !== 'test') console.error('Envoi du lien de réinitialisation impossible :', err.message);
      });
    }
    res.json(answer);
  }),
);

router.post(
  '/reset-password',
  resetLimiter,
  validate({ body: z.object({ token: z.string().regex(/^[a-f0-9]{64}$/, 'Lien invalide'), password }) }),
  asyncHandler(async (req, res) => {
    const user = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `SELECT * FROM password_resets WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() FOR UPDATE`,
        [sha256(req.body.token)],
      );
      if (!rows[0]) throw HttpError.badRequest('Ce lien a expiré ou a déjà servi. Faites une nouvelle demande.');
      const { rows: updated } = await client.query(
        'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2 RETURNING *',
        [await bcrypt.hash(req.body.password, 12), rows[0].user_id],
      );
      // Ce lien et tous les autres liens en attente de ce compte deviennent inutilisables.
      await client.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [
        rows[0].user_id,
      ]);
      return updated[0];
    });
    res.json({ token: signToken(user), user: userOut(user) });
  }),
);

module.exports = router;
