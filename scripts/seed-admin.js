import 'dotenv/config';
import mongoose from 'mongoose';
import Admin from '../src/models/Admin.js';
import { hashPassword } from '../src/utils/password.js';

try {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('Set a valid ADMIN_EMAIL');
  if (!password || password.length <=8 || password.length > 1024) throw new Error('ADMIN_PASSWORD must contain 8–1024 characters');
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required');
  await mongoose.connect(process.env.MONGODB_URI);
  if (await Admin.exists({ _id: 'admin' })) {
    console.log('Admin already exists; no changes made.');
  } else {
    await Admin.create({ _id: 'admin', name: process.env.ADMIN_NAME?.trim() || 'Admin', email, passwordHash: await hashPassword(password) });
    console.log('Admin created. Remove ADMIN_PASSWORD from the environment after setup.');
  }
} catch (error) {
  console.error(error.name === 'Error' ? error.message : 'Admin setup failed; check database connection and configuration.');
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
