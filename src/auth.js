// Password gate + CSRF + RBAC.
import crypto from 'node:crypto';
import users from './users.js';

// Login por usuario+contraseña. Compatibilidad: si no se pasa usuario,
// se asume "admin" (login solo-contraseña como antes).
export function authenticate(username, password) {
  return users.authenticate(username, password);
}

export function getUser(req) {
  if (!req.session?.userId) return null;
  return users.findById(req.session.userId) || null;
}

export function requireAuth(req, res, next) {
  if (req.session && req.session.authed && req.session.userId) {
    const u = users.findById(req.session.userId);
    if (u) { req.user = u; return next(); }
  }
  return res.status(401).json({ error: 'no autorizado' });
}

// Middleware factory: exige un permiso concreto.
export function requirePerm(perm) {
  return (req, res, next) => {
    if (users.hasPerm(req.user, perm)) return next();
    return res.status(403).json({ error: 'permiso denegado: ' + perm });
  };
}

// CSRF: token por sesión, validado en métodos mutadores.
export function issueCsrf(req) {
  if (!req.session.csrf) {
    req.session.csrf = crypto.randomBytes(24).toString('hex');
  }
  return req.session.csrf;
}

export function requireCsrf(req, res, next) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();
  const token = req.get('x-csrf-token') || req.body?._csrf;
  if (token && req.session?.csrf && token === req.session.csrf) return next();
  return res.status(403).json({ error: 'token CSRF inválido' });
}

export default { authenticate, getUser, requireAuth, requirePerm, issueCsrf, requireCsrf };
