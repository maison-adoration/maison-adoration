const config = require('./config');
const app = require('./app');
const { pool } = require('./db');

const server = app.listen(config.port, () => {
  console.log(`✅ API démarrée sur le port ${config.port} (${config.env})`);
  console.log(`🌐 Sites autorisés : ${config.corsOrigins.join(', ') || 'aucun'}${config.env === 'development' ? ' (+ tout site local en développement)' : ''}`);
  const off = Object.entries({
    Cloudinary: config.cloudinary.enabled,
    FlexPay: config.flexpay.enabled,
    'E-mail (SMTP)': config.smtp.enabled,
    'SMS (Twilio)': config.twilio.enabled,
    'Notifications push': config.vapid.enabled,
  })
    .filter(([, on]) => !on)
    .map(([name]) => name);
  if (off.length) console.log(`ℹ️  Non configuré : ${off.join(', ')}`);
});

const shutdown = () => {
  server.close(() => pool.end().then(() => process.exit(0)));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
