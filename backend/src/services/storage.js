// Envoi des affiches et PDF vers Cloudinary.
const multer = require('multer');
const crypto = require('crypto');
const cloudinary = require('cloudinary').v2;
const config = require('../config');
const { HttpError } = require('../utils/http-error');

if (config.cloudinary.enabled) {
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const PDF_TYPES = ['application/pdf'];
const AUDIO_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/x-wav', 'audio/webm'];
const TYPES_BY_KIND = { image: IMAGE_TYPES, pdf: PDF_TYPES, audio: AUDIO_TYPES };

/** Fichiers gardés en mémoire (10 Mo max) puis envoyés à Cloudinary. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 2 },
  fileFilter: (req, file, cb) => {
    const allowed = file.fieldname === 'pdf' ? PDF_TYPES : IMAGE_TYPES;
    if (!allowed.includes(file.mimetype)) {
      return cb(HttpError.badRequest(`Type de fichier non accepté pour « ${file.fieldname} » : ${file.mimetype}`));
    }
    cb(null, true);
  },
});

/**
 * Envoi d'un fichier par l'équipe média : champ « file », type donné par ?kind=image|audio|pdf.
 * Audio jusqu'à 60 Mo (prédications), le reste 10 Mo.
 */
const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 60 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const kind = req.query.kind;
    const allowed = TYPES_BY_KIND[kind];
    if (!allowed) return cb(HttpError.badRequest('Paramètre kind attendu : image, audio ou pdf'));
    if (!allowed.includes(file.mimetype)) {
      return cb(HttpError.badRequest(`Type de fichier non accepté pour « ${kind} » : ${file.mimetype}`));
    }
    cb(null, true);
  },
});

/** Envoie un fichier et renvoie son URL publique. */
function uploadFile(file, kind) {
  if (!config.cloudinary.enabled) {
    return Promise.reject(HttpError.unavailable("L'envoi de fichiers n'est pas configuré (Cloudinary)"));
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `${config.cloudinary.folder}/${kind}`,
        public_id: `${kind}-${Date.now()}-${crypto.randomUUID()}`,
        // Cloudinary range l'audio dans les ressources « video ».
        resource_type: kind === 'pdf' ? 'raw' : kind === 'audio' ? 'video' : 'image',
      },
      (err, result) => (err ? reject(err) : resolve(result.secure_url)),
    );
    stream.end(file.buffer);
  });
}

// Remplaçable dans les tests.
module.exports = { upload, uploadMedia, storage: { uploadFile } };
