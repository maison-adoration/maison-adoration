// Administration du système (super-admin) : état des services branchés.
// Ne renvoie que des indicateurs « actif / inactif » et des noms de réglages,
// jamais une valeur de configuration ni un secret.
const express = require('express');
const db = require('../db');
const config = require('../config');
const { requireSuperAdmin } = require('../middlewares/auth');
const { asyncHandler } = require('../utils/http-error');

const router = express.Router();

router.get(
  '/status',
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    let database = false;
    let migrations = null;
    try {
      await db.query('SELECT 1');
      database = true;
      const { rows } = await db.query('SELECT count(*)::int AS n FROM schema_migrations').catch(() => ({ rows: [] }));
      migrations = rows[0] ? rows[0].n : null;
    } catch {
      database = false;
    }
    const { rows: counts } = database
      ? await db.query(`SELECT
          (SELECT count(*) FROM users)::int AS users,
          (SELECT count(*) FROM users WHERE role IN ('media','admin','super-admin'))::int AS team,
          (SELECT count(*) FROM push_subscriptions)::int AS "pushSubscriptions"`)
      : { rows: [{}] };

    res.json({
      environment: config.env,
      siteUrl: config.siteUrl,
      apiPublicUrl: Boolean(config.flexpay.callbackUrl),
      counts: counts[0],
      services: [
        { key: 'database', label: 'Base de données', enabled: database, detail: migrations != null ? `${migrations} migrations appliquées` : null, settings: ['DATABASE_URL'] },
        { key: 'payments', label: 'Paiements Mobile Money (FlexPay)', enabled: config.flexpay.enabled, detail: config.flexpay.enabled && !config.flexpay.callbackUrl ? "Adresse publique de l'API manquante : les confirmations arriveront seulement par vérification" : null, settings: ['FLEXPAY_MERCHANT', 'FLEXPAY_TOKEN', 'FLEXPAY_PAYMENT_URL', 'FLEXPAY_CHECK_URL', 'API_PUBLIC_URL'] },
        { key: 'email', label: 'E-mails (mot de passe oublié, annonces)', enabled: config.smtp.enabled, settings: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'] },
        { key: 'sms', label: 'SMS (Twilio)', enabled: config.twilio.enabled, settings: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_MESSAGING_SERVICE_SID'] },
        { key: 'push', label: 'Notifications sur les appareils', enabled: config.vapid.enabled, settings: ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] },
        { key: 'storage', label: 'Stockage des images et fichiers (Cloudinary)', enabled: config.cloudinary.enabled, settings: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'] },
      ],
    });
  }),
);

module.exports = router;
