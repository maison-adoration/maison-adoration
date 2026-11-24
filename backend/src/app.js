const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { notFound, errorHandler } = require('./middlewares/error');

const app = express();

// Render / proxies : nécessaire pour connaître la vraie IP (limitation de débit).
if (config.isProd) app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Pas d'origine = appel serveur-à-serveur (ex. FlexPay) : autorisé.
      if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS : origine non autorisée (${origin})`));
    },
    // Le navigateur garde la réponse « preflight » 24 h au lieu de refaire
    // une requête OPTIONS avant chaque appel authentifié (un aller-retour de moins).
    maxAge: 86400,
  }),
);
// Réponses JSON compressées (gzip) : listes et pages 3 à 8 fois plus légères.
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.env === 'test' ? 100000 : 1000,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
  }),
);
if (config.env === 'development') app.use(require('morgan')('dev'));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: false, limit: '100kb' }));

app.use('/', require('./routes/misc'));
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/contents', require('./routes/contents'));
app.use('/payments', require('./routes/payments'));
app.use('/sections', require('./routes/sections'));
app.use('/kids-registrations', require('./routes/kids'));
app.use('/media', require('./routes/media'));
app.use('/visits', require('./routes/visits'));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
