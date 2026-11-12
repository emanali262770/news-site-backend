import 'dotenv/config';
import mongoose from 'mongoose';
import { createApp } from './src/app.js';
import { config, validateConfig } from './src/config.js';

let app;

try {
  validateConfig();
  await mongoose.connect(config.mongoUri);
  app = createApp();
  if (!process.env.VERCEL) {
    const server = app.listen(config.port, () => console.log(`API listening on port ${config.port}`));
    const shutdown = () => server.close(async () => {
      await app.locals.sessionStore.close();
      await mongoose.disconnect();
      process.exit(0);
    });
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
} catch (error) {
  console.error('Startup failed. Check MongoDB connectivity and environment configuration.', error);
  process.exitCode = 1;
}

export default app;
