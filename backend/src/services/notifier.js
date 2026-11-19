// Notifications : e-mail (SMTP, ex. Gmail), SMS (Twilio), push (navigateur).
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const config = require('../config');
const db = require('../db');

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const transporter = config.smtp.enabled
  ? nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    })
  : null;

if (config.vapid.enabled) {
  webpush.setVapidDetails(config.vapid.subject, config.vapid.publicKey, config.vapid.privateKey);
}

const newContentText = (content) => ({
  subject: `Nouveau contenu : ${content.title}`,
  sms: (name) =>
    `Bonjour ${name}, nouveau contenu sur le site de la Maison d'Adoration pour les Nations : « ${content.title} ». ${config.siteUrl}/#ressources`,
  html: (name) => `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto;">
      <div style="text-align:center;"><img src="${config.siteUrl}/images/man-gold.png" alt="M.A.N." style="width:64px;" /></div>
      <p>Bonjour ${escapeHtml(name)},</p>
      <p>Un nouveau contenu est disponible sur le site de la Maison d'Adoration pour les Nations :</p>
      <p style="font-size:1.2rem; text-transform:uppercase; color:#c68101;">${escapeHtml(content.title)}</p>
      <p><a href="${config.siteUrl}/#ressources" style="color:#c68101;">Voir sur notre site</a></p>
      <p style="font-size:.8rem; color:#888;">Pour ne plus recevoir ces e-mails, désactivez-les dans
        <a href="${config.siteUrl}/profile" style="color:#888;">votre profil</a>.</p>
    </div>`,
});

/** Envoie en petits lots pour ne pas saturer les services. */
async function inBatches(items, size, fn) {
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < items.length; i += size) {
    const results = await Promise.allSettled(items.slice(i, i + size).map(fn));
    for (const r of results) r.status === 'fulfilled' ? sent++ : failed++;
  }
  return { sent, failed };
}

async function emailNewContent(content) {
  if (!transporter) return { enabled: false };
  const { rows } = await db.query("SELECT name, email FROM users WHERE email_opt_in AND role = 'user'");
  const t = newContentText(content);
  const result = await inBatches(rows, 10, (u) =>
    transporter.sendMail({ from: config.smtp.from, to: u.email, subject: t.subject, html: t.html(u.name) }),
  );
  return { enabled: true, recipients: rows.length, ...result };
}

async function smsNewContent(content) {
  if (!config.twilio.enabled) return { enabled: false };
  const { rows } = await db.query(
    "SELECT name, tel FROM users WHERE sms_opt_in AND role = 'user' AND tel IS NOT NULL AND tel <> ''",
  );
  const t = newContentText(content);
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`;
  const auth = Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64');
  const result = await inBatches(rows, 10, async (u) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        To: u.tel,
        MessagingServiceSid: config.twilio.messagingServiceSid,
        Body: t.sms(u.name),
      }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}`);
  });
  return { enabled: true, recipients: rows.length, ...result };
}

async function pushNewContent(content) {
  return pushMessage({
    title: `Nouveau : ${content.title}`,
    body: "Disponible sur le site de la Maison d'Adoration pour les Nations",
    url: '/#ressources',
  });
}

/** Notification push à tous les abonnés : { title, body, url }. */
async function pushMessage(message) {
  if (!config.vapid.enabled) return { enabled: false };
  const { rows } = await db.query('SELECT id, endpoint, keys FROM push_subscriptions');
  const payload = JSON.stringify(message);
  const expired = [];
  const result = await inBatches(rows, 20, async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, payload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) expired.push(s.id); // abonnement expiré
      throw err;
    }
  });
  if (expired.length) await db.query('DELETE FROM push_subscriptions WHERE id = ANY($1)', [expired]);
  return { enabled: true, recipients: rows.length, ...result, removedExpired: expired.length };
}

/** Lien de réinitialisation du mot de passe. Renvoie false si l'e-mail n'est pas configuré. */
async function sendPasswordReset(user, link) {
  if (!transporter) return false;
  await transporter.sendMail({
    from: config.smtp.from,
    to: user.email,
    subject: 'Réinitialisation de votre mot de passe',
    html: `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: auto;">
      <p>Bonjour ${escapeHtml(user.name)},</p>
      <p>Vous avez demandé à changer votre mot de passe sur le site de la Maison d'Adoration pour les Nations.</p>
      <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#c68101;color:#fff;border-radius:6px;text-decoration:none;">Choisir un nouveau mot de passe</a></p>
      <p style="font-size:.85rem;color:#666;">Ce lien est valable 1 heure et ne peut servir qu'une fois.
        Si vous n'avez rien demandé, ignorez cet e-mail : votre mot de passe ne change pas.</p>
    </div>`,
  });
  return true;
}

module.exports = { emailNewContent, smsNewContent, pushNewContent, pushMessage, sendPasswordReset, escapeHtml };
