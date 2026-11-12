import { promisify } from 'node:util';
import Admin from '../models/Admin.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { fail } from '../utils/errors.js';
import { csrfToken } from '../middleware/auth.js';
import { config } from '../config.js';

// Check a hash even for unknown emails to avoid a fast account-existence signal.
const dummyHash = hashPassword('unused-dummy-password');
const publicAdmin = admin => ({ id: admin.id, name: admin.name, email: admin.email });
export const csrf = (req, res) => res.json({ csrfToken: csrfToken(req) });
export const me = (req, res) => res.json({ admin: publicAdmin(req.admin), csrfToken: csrfToken(req) });

export async function login(req, res) {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || !password || password.length > 1024) {
    throw fail(400, 'Valid email and password are required');
  }
  const admin = await Admin.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  const valid = await verifyPassword(password, admin?.passwordHash || await dummyHash);
  if (!admin || !valid) throw fail(401, 'Invalid email or password');
  await promisify(req.session.regenerate).call(req.session);
  req.session.adminId = admin.id;
  const token = csrfToken(req);
  await promisify(req.session.save).call(req.session);
  res.json({ admin: publicAdmin(admin), csrfToken: token });
}

export async function logout(req, res) {
  await promisify(req.session.destroy).call(req.session);
  res.clearCookie('news.sid', { path: '/', httpOnly: true, secure: config.production, sameSite: config.sameSite });
  res.json({ message: 'Logged out' });
}
