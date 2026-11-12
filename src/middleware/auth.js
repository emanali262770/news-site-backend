import { randomBytes, timingSafeEqual } from 'node:crypto';
import Admin from '../models/Admin.js';
import { config } from '../config.js';
import { fail } from '../utils/errors.js';

export async function requireAdmin(req, res, next) {
  if (!req.session.adminId) throw fail(401, 'Authentication required');
  const admin = await Admin.findById(req.session.adminId);
  if (!admin) throw fail(401, 'Authentication required');
  req.admin = admin;
  next();
}

export function csrfToken(req) {
  req.session.csrfToken ||= randomBytes(32).toString('hex');
  return req.session.csrfToken;
}

export function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('Origin');
  if (origin && !config.origins.includes(origin)) throw fail(403, 'Origin not allowed');
  const supplied = req.get('X-CSRF-Token') || '';
  const expected = req.session.csrfToken || '';
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(expected)
      || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    throw fail(403, 'Invalid CSRF token');
  }
  next();
}
