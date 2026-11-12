import { Router } from 'express';
import multer from 'multer';
import { rateLimit } from 'express-rate-limit';
import * as auth from '../controllers/authController.js';
import * as posts from '../controllers/postController.js';
import { upload } from '../controllers/uploadController.js';
import { requireAdmin, csrfProtection } from '../middleware/auth.js';
import { categories } from '../constants/categories.js';

const router = Router();
const loginLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Try again later.' },
});
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 1, fields: 0, parts: 2 },
}).single('image');

router.use('/auth', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
router.get('/auth/csrf', auth.csrf);
router.post('/auth/login', loginLimit, csrfProtection, auth.login);
router.get('/auth/me', requireAdmin, auth.me);
router.post('/auth/logout', requireAdmin, csrfProtection, auth.logout);

router.get('/categories', (req, res) => res.json(categories));

router.get('/posts', posts.list);
router.get('/posts/:slug', posts.detail);
router.post('/posts', requireAdmin, csrfProtection, posts.create);
router.patch('/posts/:id', requireAdmin, csrfProtection, posts.update);
router.delete('/posts/:id', requireAdmin, csrfProtection, posts.remove);

router.post('/uploads/images', requireAdmin, csrfProtection, imageUpload, upload);

export default router;
