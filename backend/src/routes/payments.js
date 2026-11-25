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
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { requireAuth, requireAdmin, optionalAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');
const { asyncHandler, HttpError } = require('../utils/http-error');
const { sendReport } = require('../services/report');
const { paymentOut } = require('../utils/serializers');
const flexpay = require('../services/flexpay');

const router = express.Router();

/**
 * Revérifie un paiement en attente auprès de FlexPay et, s'il a réussi, donne l'accès.
 * L'appel à FlexPay se fait SANS verrou ni connexion à la base ouverte (il peut durer
 * jusqu'à 30 s) ; l'enregistrement se fait ensuite dans une transaction courte qui
 * revérifie que le paiement est toujours en attente (pas de double traitement).
 */
async function settle(paymentId) {
  const { rows } = await db.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
  const payment = rows[0];
  if (!payment || payment.status !== 'pending' || !payment.order_number) return payment;

  const status = await flexpay.checkPayment(payment.order_number);
  if (status === 'pending') return payment;

  return db.transaction(async (client) => {
    const { rows: updated } = await client.query(
      "UPDATE payments SET status = $1 WHERE id = $2 AND status = 'pending' RETURNING *",
      [status, payment.id],
    );
    // Déjà traité entre-temps (rappel FlexPay et interrogation du site en même temps)
    if (!updated[0]) return (await client.query('SELECT * FROM payments WHERE id = $1', [payment.id])).rows[0];
    if (status === 'success' && updated[0].user_id && updated[0].content_id) {
      await client.query(
        `INSERT INTO enrollments (user_id, content_id, source, payment_id)
         VALUES ($1, $2, 'purchase', $3) ON CONFLICT (user_id, content_id) DO NOTHING`,
        [updated[0].user_id, updated[0].content_id, updated[0].id],
      );
    }
    return updated[0];
  });
}

const phoneSchema = z
  .string()
  .trim()
  .refine((p) => /^\+?\d{9,15}$/.test(p.replace(/[\s-]/g, '')), 'Numéro de téléphone invalide');

const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

/** Envoie la demande à FlexPay et enregistre la réponse sur le paiement. */
async function sendToFlexpay(payment) {
  let result;
  try {
    result = await flexpay.startPayment({
      amount: payment.amount,
      currency: payment.currency,
      phone: payment.phone,
      reference: payment.reference,
    });
  } catch (err) {
    result = { accepted: false, message: 'FlexPay injoignable, réessayez' };
  }
  const { rows } = await db.query(
    `UPDATE payments SET order_number = $1, status = $2, message = $3 WHERE id = $4 RETURNING *`,
    [result.orderNumber ?? null, result.accepted ? 'pending' : 'failed', result.message ?? null, payment.id],
  );
  return { result, payment: rows[0] };
}

const donationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.env === 'test' ? 1000 : 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Trop de demandes de don. Réessayez plus tard.' },
});

/*
 * Don en ligne (dîme, offrande, projet) : ouvert à tous, compte facultatif.
 * Le donateur reçoit un jeton pour suivre son paiement ; seul son empreinte est gardée.
 */
router.post(
  '/donation',
  donationLimiter,
  optionalAuth,
  validate({
    body: z.object({
      kind: z.enum(['dime', 'offrande', 'projet']),
      amount: z.coerce.number().min(1, 'Montant minimum : 1').max(10000, 'Montant maximum : 10 000').multipleOf(0.01),
      phone: phoneSchema,
      name: z.string().trim().max(120).default(''),
    }),
  }),
  asyncHandler(async (req, res) => {
    if (!config.flexpay.enabled || !config.flexpay.callbackUrl) {
      throw HttpError.unavailable("Le don en ligne n'est pas encore configuré");
    }
    const b = req.body;
    const token = crypto.randomBytes(24).toString('hex');
    const reference = `MAN-DON-${b.kind.toUpperCase()}-${crypto.randomBytes(6).toString('hex')}`;
    const { rows } = await db.query(
      `INSERT INTO payments (user_id, payer_email, donation_kind, donor_name, status_token_hash, amount, currency, phone, reference)
       VALUES ($1, $2, $3, NULLIF($4, ''), $5, $6, $7, $8, $9) RETURNING *`,
      [
        req.user?.id ?? null,
        req.user?.email ?? null,
        b.kind,
        b.name || req.user?.name || '',
        hashToken(token),
        b.amount,
        config.currency,
        flexpay.normalizePhone(b.phone),
        reference,
      ],
    );
    const { result, payment } = await sendToFlexpay(rows[0]);
    if (!result.accepted) {
      return res.status(502).json({ error: result.message || 'Le paiement a été refusé', payment: paymentOut(payment) });
    }
    res.status(201).json({ ...paymentOut(payment), token });
  }),
);

/* Suivi d'un don par son jeton (sans compte). */
router.get(
  '/donation/:id',
  validate({
    params: z.object({ id: z.string().trim().min(1).max(64) }),
    query: z.object({ token: z.string().trim().regex(/^[a-f0-9]{48}$/, 'Jeton invalide') }),
  }),
  asyncHandler(async (req, res) => {
    const { rows } = await db.query(
      'SELECT * FROM payments WHERE id = $1 AND status_token_hash = $2 AND donation_kind IS NOT NULL',
      [req.params.id, hashToken(req.validQuery.token)],
    );
    if (!rows[0]) throw HttpError.notFound('Don introuvable');
    let payment = rows[0];
    if (payment.status === 'pending' && config.flexpay.enabled) payment = (await settle(payment.id)) || payment;
    res.json(paymentOut(payment));
  }),
);

router.post(
  '/flexpay',
  requireAuth,
  validate({
    body: z.object({
      contentId: z.string().trim().min(1).max(64),
      phone: phoneSchema,
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
      `INSERT INTO payments (user_id, payer_email, content_id, amount, currency, phone, reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user.id, req.user.email, content.id, content.price, config.currency, flexpay.normalizePhone(req.body.phone), reference],
    );
    const { result, payment } = await sendToFlexpay(created[0]);
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

/* Suivi des paiements (admin) : ?status=&search=&from=AAAA-MM-JJ&to=AAAA-MM-JJ[&format=csv] */
const listQuery = z.object({
  status: z.enum(['pending', 'success', 'failed']).optional(),
  purpose: z.enum(['content', 'donation']).optional(),
  search: z.string().trim().max(100).default(''),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).default('json'),
});

router.get(
  '/',
  requireAdmin,
  validate({ query: listQuery }),
  asyncHandler(async (req, res) => {
    const q = req.validQuery;
    const where = `WHERE ($1::payment_status IS NULL OR p.status = $1)
        AND ($2::date IS NULL OR p.created_at >= $2::date)
        AND ($3::date IS NULL OR p.created_at < $3::date + 1)
        AND (coalesce(p.payer_email, '') ILIKE $4 OR coalesce(u.name, '') ILIKE $4 OR coalesce(p.donor_name, '') ILIKE $4
             OR coalesce(c.title, '') ILIKE $4 OR p.phone ILIKE $4)
        AND ($5::text IS NULL OR ($5 = 'donation') = (p.donation_kind IS NOT NULL))`;
    const params = [q.status ?? null, q.from ?? null, q.to ?? null, `%${q.search.replace(/[%_\\]/g, '\\$&')}%`, q.purpose ?? null];
    const { rows } = await db.query(
      `SELECT p.id, p.created_at, p.status, p.amount, p.currency, p.phone, p.reference, p.order_number, p.message,
              p.payer_email, coalesce(u.name, p.donor_name) AS payer_name,
              coalesce(c.title, CASE p.donation_kind WHEN 'dime' THEN 'Don : dîme' WHEN 'offrande' THEN 'Don : offrande'
                                                     WHEN 'projet' THEN 'Don : projet' END) AS content_title,
              p.donation_kind
       FROM payments p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN contents c ON c.id = p.content_id
       ${where} ORDER BY p.created_at DESC LIMIT 1000`,
      params,
    );
    if (q.format === 'csv') {
      const cell = (v) => {
        let t = v === null || v === undefined ? '' : v instanceof Date ? v.toISOString().replace('T', ' ').slice(0, 16) : String(v);
        if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
        return `"${t.replace(/"/g, '""')}"`;
      };
      const STATUS = { pending: 'En attente', success: 'Réussi', failed: 'Échoué' };
      const lines = rows.map((r) =>
        [r.created_at, STATUS[r.status], r.amount, r.currency, r.payer_name, r.payer_email, r.phone, r.content_title, r.reference]
          .map(cell)
          .join(';'),
      );
      const header = ['Date', 'Statut', 'Montant', 'Devise', 'Nom', 'E-mail', 'Téléphone', 'Contenu ou don', 'Référence'];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="paiements-man.csv"');
      return res.send(`\uFEFF${[header.map(cell).join(';'), ...lines].join('\r\n')}`);
    }
    const { rows: totals } = await db.query(
      `SELECT p.currency, count(*) FILTER (WHERE p.status = 'success')::int AS successes,
              coalesce(sum(p.amount) FILTER (WHERE p.status = 'success'), 0) AS total,
              count(*) FILTER (WHERE p.status = 'pending')::int AS pending,
              count(*) FILTER (WHERE p.status = 'failed')::int AS failed
       FROM payments p LEFT JOIN users u ON u.id = p.user_id LEFT JOIN contents c ON c.id = p.content_id
       ${where} GROUP BY p.currency`,
      params,
    );
    if (q.format === 'xlsx' || q.format === 'pdf') {
      const STATUS = { pending: 'En attente', success: 'Réussi', failed: 'Échoué' };
      const donations = q.purpose === 'donation';
      const title = donations ? 'Dons en ligne' : q.purpose === 'content' ? 'Achats de ressources' : 'Dons et paiements';
      const d = (x) => new Date(`${x}T12:00:00Z`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
      const period = q.from && q.to ? `Du ${d(q.from)} au ${d(q.to)}` : q.from ? `Depuis le ${d(q.from)}` : q.to ? `Jusqu'au ${d(q.to)}` : 'Toutes les dates';
      const filters = [period, q.status && `statut : ${STATUS[q.status].toLowerCase()}`, q.search && `recherche : « ${q.search} »`].filter(Boolean).join(' — ');
      const money = (n) => Number(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const ok = rows.filter((r) => r.status === 'success');
      const currencies = [...new Set(ok.map((r) => r.currency))];
      return sendReport(res, q.format, {
        sheet: title,
        filename: title,
        docLabel: donations ? 'DONS' : 'PAIEMENTS',
        title,
        subtitle: filters,
        kpis: [
          ...totals.slice(0, 2).map((t) => ({ label: `Total reçu`, value: money(t.total), note: t.currency })),
          { label: 'Réussis', value: totals.reduce((n, t) => n + t.successes, 0) },
          { label: 'En attente', value: totals.reduce((n, t) => n + t.pending, 0) },
          { label: 'Échoués', value: totals.reduce((n, t) => n + t.failed, 0) },
        ].slice(0, 4),
        columns: [
          { header: 'Date', key: 'created_at', width: 17, pdf: 14, type: 'datetime' },
          { header: donations ? 'Donateur' : 'Nom', key: 'payer_name', width: 26, pdf: 20, bold: true },
          { header: donations ? 'Type de don' : 'Contenu ou don', key: 'content_title', width: 28, pdf: 20 },
          { header: 'Montant', key: 'amount', width: 12, pdf: 11, type: 'money' },
          { header: 'Devise', key: 'currency', width: 8, pdf: 7 },
          { header: 'Statut', key: 'status', width: 12, pdf: 10 },
          { header: 'Téléphone', key: 'phone', width: 16, pdf: 14 },
          { header: 'E-mail', key: 'payer_email', width: 26, pdf: false },
          { header: 'Référence', key: 'reference', width: 24, pdf: false },
        ],
        rows: rows.map((r) => ({
          ...r,
          amount: Number(r.amount),
          status: STATUS[r.status],
          payer_name: r.payer_name || (r.donation_kind ? 'Anonyme' : ''),
          content_title: r.content_title ? r.content_title.replace(/^Don : /, donations ? '' : 'Don : ').replace(/^./, (c) => c.toUpperCase()) : '',
        })),
        // Total des paiements réussis, quand une seule devise est concernée.
        total: currencies.length === 1 ? { label: 'Total reçu (paiements réussis)', values: { amount: ok.reduce((n, r) => n + Number(r.amount), 0), currency: currencies[0] } } : null,
      });
    }
    res.json({ payments: rows, totals });
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
