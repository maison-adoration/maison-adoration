const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');
const { HttpError } = require('../utils/http-error');

const ROLE_LEVEL = { user: 0, admin: 1, 'super-admin': 2 };

const signToken = (user) =>
  jwt.sign({ sub: user.id }, config.jwt.secret, { expiresIn: config.jwt.expiresIn, algorithm: 'HS256' });

/** Lit le jeton « Authorization: Bearer … » et charge l'utilisateur (ou null). */
async function loadUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
  } catch {
    return null;
  }
  if (!payload || typeof payload.sub !== 'string') return null;
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [payload.sub]);
  return rows[0] || null;
}

/** Connexion facultative : req.user est rempli si le jeton est valide. */
const optionalAuth = async (req, res, next) => {
  try {
    req.user = await loadUser(req);
    next();
  } catch (err) {
    next(err);
  }
};

/** Exige un utilisateur connecté, avec au minimum le rôle indiqué. */
const requireRole = (minRole = 'user') => async (req, res, next) => {
  try {
    const user = await loadUser(req);
    if (!user) return next(HttpError.unauthorized());
    if (ROLE_LEVEL[user.role] < ROLE_LEVEL[minRole]) return next(HttpError.forbidden());
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

const isAdminRole = (role) => ROLE_LEVEL[role] >= ROLE_LEVEL.admin;

module.exports = {
  signToken,
  optionalAuth,
  requireAuth: requireRole('user'),
  requireAdmin: requireRole('admin'),
  requireSuperAdmin: requireRole('super-admin'),
  isAdminRole,
  ROLE_LEVEL,
};
