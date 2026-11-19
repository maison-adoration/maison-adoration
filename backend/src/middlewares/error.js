const multer = require('multer');
const config = require('../config');
const { HttpError } = require('../utils/http-error');

const notFound = (req, res, next) => next(HttpError.notFound(`Route introuvable : ${req.method} ${req.path}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux' : `Fichier refusé : ${err.message}`;
    return res.status(400).json({ error: msg });
  }
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON invalide' });
  }
  if (err && err.message && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  // Erreur inattendue : on la journalise, sans jamais renvoyer les détails internes.
  if (config.env !== 'test') console.error(err);
  return res.status(500).json({ error: 'Erreur interne du serveur' });
};

module.exports = { notFound, errorHandler };
