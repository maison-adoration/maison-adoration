// Paiements Mobile Money (FlexPay).
//
// Déroulement :
//  1. Le site appelle POST /payments/flexpay { contentId, phone }.
//     Le prix est lu en base (jamais envoyé par le navigateur).
//  2. Le fidèle confirme sur son téléphone.
//  3. FlexPay appelle POST /payments/flexpay/callback. On ne croit pas son contenu :
//     on redemande le statut à FlexPay avant de donner l'accès.
//  4. Le site interroge GET /payments/:id jusqu'au statut final.
const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const db = require('../db');
const config = require('../config');
const { requireAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { paymentOut } = require('../utils/serializers');
const flexpay = require('../services/flexpay');

const router = express.Router();

/**
 * Revérifie un paiement en attente auprès de FlexPay et, s'il a réussi,
 * donne l'accès — le tout dans une seule transaction, sans double traitement.
 */
async function settle(paymentId) {
  return db.transaction(async (client) => {
    const { rows } = await client.query('SELECT * FROM payments WHERE id = $1 FOR UPDATE', [paymentId]);
    const payment = rows[0];
    if (!payment || payment.status !== 'pending' || !payment.order_number) return payment;

    const status = await flexpay.checkPayment(payment.order_number);
    if (status === 'pending') return payment;

    const { rows: updated } = await client.query(
      'UPDATE payments SET status = $1 WHERE id = $2 RETURNING *',
      [status, payment.id],
    );
    if (status === 'success') {
      await client.query(
        `INSERT INTO enrollments (user_id, content_id, source, payment_id)
         VALUES ($1, $2, 'purchase', $3) ON CONFLICT (user_id, content_id) DO NOTHING`,
        [payment.user_id, payment.content_id, payment.id],
      );
    }
    return updated[0];
  });
}

router.post(
  '/flexpay',
  requireAuth,
  validate({
    body: z.object({
      contentId: z.string().trim().min(1).max(64),
      phone: z
        .string()
        .trim()
        .refine((p) => /^\+?\d{9,15}$/.test(p.replace(/[\s-]/g, '')), 'Numéro de téléphone invalide'),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!config.flexpay.enabled || !config.flexpay.callbackUrl) {
      throw HttpError.unavailable("Le paiement en ligne n'est pas encore configuré");
    }
    const { rows } = await db.query('SELECT * FROM contents WHERE id = $1', [req.body.contentId]);
    const content = rows[0];
    if (!content) throw HttpError.notFound('Contenu introuvable');
    if (Number(content.price) <= 0) throw HttpError.badRequest('Ce contenu est gratuit');

    const { rows: owned } = await db.query(
      'SELECT 1 FROM enrollments WHERE user_id = $1 AND content_id = $2',
      [req.user.id, content.id],
    );
    if (owned.length) throw HttpError.conflict('Vous avez déjà accès à ce contenu');

    const reference = `MAN-${req.user.number}-${content.number}-${crypto.randomBytes(4).toString('hex')}`;
    const { rows: created } = await db.query(
      `INSERT INTO payments (user_id, content_id, amount, currency, phone, reference)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.user.id, content.id, content.price, config.currency, flexpay.normalizePhone(req.body.phone), reference],
    );
    let payment = created[0];

    let result;
    try {
      result = await flexpay.startPayment({
        amount: content.price,
        currency: config.currency,
        phone: payment.phone,
        reference,
      });
    } catch (err) {
      result = { accepted: false, message: 'FlexPay injoignable, réessayez' };
    }

    const { rows: updated } = await db.query(
      `UPDATE payments SET order_number = $1, status = $2, message = $3 WHERE id = $4 RETURNING *`,
      [result.orderNumber ?? null, result.accepted ? 'pending' : 'failed', result.message ?? null, payment.id],
    );
    payment = updated[0];
    if (!result.accepted) {
      return res.status(502).json({ error: result.message || 'Le paiement a été refusé', payment: paymentOut(payment) });
    }
    res.status(201).json(paymentOut(payment));
  }),
);

/* Appel de FlexPay quand une transaction se termine. Aucune confiance accordée au contenu. */
router.post(
  '/flexpay/callback',
  asyncHandler(async (req, res) => {
    const orderNumber = typeof req.body?.orderNumber === 'string' ? req.body.orderNumber : null;
    const reference = typeof req.body?.reference === 'string' ? req.body.reference : null;
    if (!orderNumber && !reference) return res.status(400).json({ error: 'Référence manquante' });
    const { rows } = await db.query(
      'SELECT id FROM payments WHERE order_number = $1 OR reference = $2 LIMIT 1',
      [orderNumber, reference],
    );
    if (rows[0]) await settle(rows[0].id);
    // Réponse identique dans tous les cas : rien à apprendre pour un tiers.
    res.json({ received: true });
  }),
);

/* Statut d'un de mes paiements (le site l'interroge jusqu'au résultat final) */
router.get(
  '/:id',
  requireAuth,
  validate({ params: z.object({ id: z.string().trim().min(1).max(64) }) }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query('SELECT * FROM payments WHERE id = $1 AND user_id = $2', [
      req.params.id,
      req.user.id,
    ]);
    if (!rows[0]) throw HttpError.notFound('Paiement introuvable');
    let payment = rows[0];
    if (payment.status === 'pending' && config.flexpay.enabled) payment = (await settle(payment.id)) || payment;
    res.json(paymentOut(payment));
  }),
);

module.exports = router;
module.exports.settle = settle;
