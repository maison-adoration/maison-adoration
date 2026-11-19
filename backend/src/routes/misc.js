// Routes publiques diverses : santé, réglages publics, statistiques, abonnements push.
const express = require('express');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { optionalAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler } = require('../utils/http-error');

const router = express.Router();

router.get('/', (req, res) => res.json({ name: "API Maison d'Adoration pour les Nations", status: 'ok' }));

router.get(
  '/health',
  asyncHandler(async (req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  }),
);

/* Réglages publics uniquement — aucun jeton ni secret. */
router.get('/settings', (req, res) =>
  res.json({
    currency: config.currency,
    paymentsEnabled: config.flexpay.enabled,
    vapidPublicKey: config.vapid.enabled ? config.vapid.publicKey : null,
  }),
);

router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(`
      SELECT (SELECT count(*) FROM users)::int AS "nUsers",
             (SELECT count(*) FROM contents WHERE type <> 'activity')::int AS "nCourses",
             (SELECT count(DISTINCT country) FROM users WHERE country IS NOT NULL AND country <> '')::int AS "nCountries"`);
    res.json(rows[0]);
  }),
);

/* Abonnement aux notifications push du navigateur */
router.post(
  '/push-subscriptions',
  optionalAuth,
  validate({
    body: z.object({
      endpoint: z.string().url().max(1000).startsWith('https://'),
      keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
    }),
  }),
  asyncHandler(async (req, res) => {
    await db.query(
      `INSERT INTO push_subscriptions (endpoint, keys, user_id) VALUES ($1, $2, $3)
       ON CONFLICT (endpoint) DO UPDATE SET keys = EXCLUDED.keys, user_id = coalesce(EXCLUDED.user_id, push_subscriptions.user_id)`,
      [req.body.endpoint, req.body.keys, req.user?.id ?? null],
    );
    res.status(201).json({ ok: true });
  }),
);

module.exports = router;
