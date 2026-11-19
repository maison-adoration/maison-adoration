require('dotenv').config({ quiet: true });
const { z } = require('zod');

// Toute la configuration vient des variables d'environnement.
// Aucune clé secrète ne doit être écrite dans le code.
const bool = z
  .enum(['true', 'false', '1', '0', ''])
  .optional()
  .transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL est obligatoire'),
  DATABASE_SSL: bool,

  JWT_SECRET: z.string().min(32, 'JWT_SECRET doit faire au moins 32 caractères'),
  JWT_EXPIRES_IN: z.string().default('30d'),

  // Origines autorisées à appeler l'API (séparées par des virgules)
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost'),
  // URL publique du site (liens dans les e-mails / SMS / notifications)
  SITE_URL: z.string().url().default('https://maison-adoration.net'),

  CURRENCY: z.string().default('USD'),
  PAGE_SIZE: z.coerce.number().int().positive().max(200).default(50),

  // Cloudinary (affiches et PDF)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_FOLDER: z.string().default('maison-adoration'),

  // FlexPay (Mobile Money)
  FLEXPAY_MERCHANT: z.string().optional(),
  FLEXPAY_TOKEN: z.string().optional(),
  FLEXPAY_PAYMENT_URL: z.string().url().optional(),
  FLEXPAY_CHECK_URL: z.string().url().optional(),
  // URL publique de ce serveur, à laquelle FlexPay envoie sa confirmation
  API_PUBLIC_URL: z.string().url().optional(),

  // E-mail (SMTP : Gmail avec mot de passe d'application, ou autre)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: bool,
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  // SMS (Twilio)
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_MESSAGING_SERVICE_SID: z.string().optional(),

  // Notifications push (générer avec : npx web-push generate-vapid-keys)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:maisondadoration@gmail.com'),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Configuration invalide :\n${issues}\n\nVoir backend/.env.example\n`);
  process.exit(1);
}
const env = parsed.data;

module.exports = {
  env: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL,
  jwt: { secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN },
  corsOrigins: env.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
  siteUrl: env.SITE_URL.replace(/\/$/, ''),
  currency: env.CURRENCY,
  pageSize: env.PAGE_SIZE,
  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    folder: env.CLOUDINARY_FOLDER,
    enabled: Boolean(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  },
  flexpay: {
    merchant: env.FLEXPAY_MERCHANT,
    token: env.FLEXPAY_TOKEN,
    paymentUrl: env.FLEXPAY_PAYMENT_URL,
    checkUrl: env.FLEXPAY_CHECK_URL,
    callbackUrl: env.API_PUBLIC_URL ? `${env.API_PUBLIC_URL.replace(/\/$/, '')}/payments/flexpay/callback` : undefined,
    enabled: Boolean(env.FLEXPAY_MERCHANT && env.FLEXPAY_TOKEN && env.FLEXPAY_PAYMENT_URL && env.FLEXPAY_CHECK_URL),
  },
  smtp: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    from: env.MAIL_FROM || env.SMTP_USER,
    enabled: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  },
  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID,
    enabled: Boolean(env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_MESSAGING_SERVICE_SID),
  },
  vapid: {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
    enabled: Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY),
  },
};
