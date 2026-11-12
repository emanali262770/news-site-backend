import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import { config, validateConfig, isAllowedOrigin } from './config.js';
import router from './routes/index.js';
import { errorHandler } from './utils/errors.js';

export function createApp({ sessionStore } = {}) {
  validateConfig();
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY_HOPS) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS));
  app.use(helmet());
  app.use(cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/uploads', express.static(config.uploads, {
    dotfiles: 'deny',
    immutable: true,
    maxAge: '1y',
    setHeaders: res => res.set('Cross-Origin-Resource-Policy', 'cross-origin'),
  }));

  const store = sessionStore || MongoStore.create({
    mongoUrl: config.mongoUri,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
  });
  store.on('error', () => console.error('Session store error'));
  app.locals.sessionStore = store;
  app.use('/api', session({
    name: 'news.sid',
    secret: config.secret,
    store,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: config.production,
      sameSite: config.sameSite,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }), router);
  app.get('/', (req, res) => {
    res.json({
      status: 'success',
      message: 'News Site API is running smoothly 🚀',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    });
  });

  app.use((req, res) => res.status(404).json({ message: 'Not found' }));
  app.use(errorHandler);
  return app;
}
