const { HttpError } = require('../utils/http-error');

/**
 * Valide req.body / req.query / req.params avec un schéma zod.
 * Seuls les champs déclarés sont conservés : impossible d'injecter
 * un champ non prévu (rôle, accès, etc.).
 */
const validate = (schemas) => (req, res, next) => {
  for (const key of ['params', 'query', 'body']) {
    if (!schemas[key]) continue;
    const result = schemas[key].safeParse(req[key] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
      return next(HttpError.badRequest(details[0]?.message || 'Requête invalide', details));
    }
    if (key === 'query') {
      // req.query est en lecture seule dans Express 5 ; on stocke la version validée à part.
      req.validQuery = result.data;
    } else {
      req[key] = result.data;
    }
  }
  next();
};

module.exports = { validate };
