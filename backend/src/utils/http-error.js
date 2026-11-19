/** Erreur HTTP avec un code et un message lisible par le site. */
class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }

  static badRequest(msg = 'Requête invalide', details) { return new HttpError(400, msg, details); }
  static unauthorized(msg = 'Vous devez être connecté') { return new HttpError(401, msg); }
  static forbidden(msg = "Vous n'avez pas les droits nécessaires") { return new HttpError(403, msg); }
  static notFound(msg = 'Ressource introuvable') { return new HttpError(404, msg); }
  static conflict(msg = 'Cette ressource existe déjà') { return new HttpError(409, msg); }
  static unavailable(msg = 'Service indisponible') { return new HttpError(503, msg); }
}

/** Enveloppe un handler async pour transmettre les erreurs à Express. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = { HttpError, asyncHandler };
