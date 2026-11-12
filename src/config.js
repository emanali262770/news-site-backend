import path from 'node:path';

export const config = {
  mongoUri: process.env.MONGODB_URI,
  secret: process.env.SESSION_SECRET,
  port: Number(process.env.PORT || 5000),
  production: process.env.NODE_ENV === 'production',
  origins: (process.env.FRONTEND_ORIGIN || 'http://localhost:5173').split(',').map(value => new URL(value.trim()).origin),
  uploads: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
  sameSite: process.env.COOKIE_SAME_SITE || 'lax',
};

export function validateConfig() {
  if (!config.mongoUri) throw new Error('MONGODB_URI is required');
  if (!config.secret || config.secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  if (!['lax', 'strict', 'none'].includes(config.sameSite)) throw new Error('Invalid COOKIE_SAME_SITE');
  if (config.sameSite === 'none' && !config.production) throw new Error('SameSite none requires production HTTPS');
}
