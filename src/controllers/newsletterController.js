import Subscriber from '../models/Subscriber.js';
import { fail } from '../utils/errors.js';
import { sendWelcomeEmail } from '../utils/mailer.js';

export async function subscribe(req, res) {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    throw fail(400, 'Email is required');
  }

  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(cleanEmail)) {
    throw fail(400, 'Invalid email address format');
  }

  let subscriber = await Subscriber.findOne({ email: cleanEmail });

  if (subscriber) {
    if (!subscriber.isActive) {
      subscriber.isActive = true;
      await subscriber.save();
    }
    return res.json({ message: 'You are already subscribed to our newsletter!' });
  }

  subscriber = await Subscriber.create({ email: cleanEmail });

  // Send welcome email asynchronously in the background
  sendWelcomeEmail(cleanEmail).catch(err => {
    console.error('Welcome email error:', err.message);
  });

  res.status(201).json({ message: 'Subscribed successfully! Thank you.' });
}

export async function unsubscribe(req, res) {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    throw fail(400, 'Email is required');
  }

  const cleanEmail = email.trim().toLowerCase();
  await Subscriber.findOneAndUpdate({ email: cleanEmail }, { isActive: false });
  res.json({ message: 'Unsubscribed successfully' });
}
