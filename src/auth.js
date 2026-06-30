// Password gate + CSRF ligero.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import config from './config.js';

// Hash de la contraseña configurada (se calcula una vez al arrancar).
const passwordHash = bcrypt.hashSync(config.password, 10);

export function checkPassword(plain) {
  if (!plain) return false;
  return bcrypt.compareSync(plain, passwordHash);
}

export function requireAuth(req, res, next) {
  if (req.session && req.session.authed) return next();
  return res.status(401).json({ error: 'no autorizado' });
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

export default { checkPassword, requireAuth, issueCsrf, requireCsrf };
