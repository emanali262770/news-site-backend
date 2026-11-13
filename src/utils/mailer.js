import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!config.email.user || !config.email.pass) {
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: config.email.user,
      pass: config.email.pass,
    },
  });

  return transporter;
}

/**
 * Sends a welcome email when a user subscribes to the newsletter
 */
export async function sendWelcomeEmail(toEmail) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log(`[Newsletter] SMTP not configured. Skipped welcome email to ${toEmail}`);
    return;
  }

  const siteUrl = config.origins[0] || 'https://news-site-ebon-sigma.vercel.app';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b132b; color: #ffffff; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #1c2541; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
        .header { background: #3a86ff; padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; font-size: 26px; color: #ffffff; letter-spacing: 1px; }
        .content { padding: 30px 25px; line-height: 1.6; color: #e0e1dd; }
        .button { display: inline-block; background: #3a86ff; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; margin-top: 20px; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #8d99ae; border-top: 1px solid #2b3a67; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Stay Informed 📰</h1>
        </div>
        <div class="content">
          <h2>Welcome to Our Community!</h2>
          <p>Thank you for subscribing to our news updates. You are now in the loop for the latest breaking news, deep dives, and daily highlights directly in your inbox.</p>
          <p>Whenever a major headline drops, we'll keep you ahead of the curve.</p>
          <a href="${siteUrl}" class="button">Visit Our Website</a>
        </div>
        <div class="footer">
          <p>You received this email because you subscribed on our website.</p>
          <p>&copy; ${new Date().getFullYear()} News Site. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await mailer.sendMail({
      from: `"News Updates" <${config.email.from}>`,
      to: toEmail,
      subject: 'Welcome to News Updates! 🎉',
      html,
    });
    console.log(`[Newsletter] Welcome email sent to ${toEmail}`);
  } catch (error) {
    console.error(`[Newsletter] Failed to send welcome email to ${toEmail}:`, error.message);
  }
}

/**
 * Notifies all subscribers about a newly published post
 */
export async function sendNewPostNotification(subscribers, post) {
  const mailer = getTransporter();
  if (!mailer || !subscribers || subscribers.length === 0) {
    if (!mailer) console.log('[Newsletter] SMTP not configured. Notification emails skipped.');
    return;
  }

  const siteUrl = config.origins[0] || 'https://news-site-ebon-sigma.vercel.app';
  const postUrl = `${siteUrl}/post/${post.slug}`;
  const imageUrl = post.image && post.image.startsWith('http') 
    ? post.image 
    : (post.image ? `${siteUrl}${post.image}` : '');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #1d4ed8, #3b82f6); padding: 24px; text-align: center; }
        .header h1 { margin: 0; font-size: 22px; color: #ffffff; text-transform: uppercase; letter-spacing: 2px; }
        .badge { display: inline-block; background: #ef4444; color: #ffffff; font-size: 11px; font-weight: bold; padding: 4px 10px; border-radius: 12px; margin-bottom: 10px; text-transform: uppercase; }
        .post-image { width: 100%; max-height: 320px; object-fit: cover; display: block; }
        .content { padding: 28px 24px; }
        .category { color: #38bdf8; font-size: 13px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px; }
        .title { margin: 0 0 14px 0; font-size: 22px; line-height: 1.4; color: #ffffff; }
        .subtitle { color: #94a3b8; font-size: 15px; line-height: 1.6; margin-bottom: 24px; }
        .button { display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 12px rgba(37,99,235,0.4); }
        .footer { padding: 20px 24px; background: #0f172a; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; }
        .meta { font-size: 13px; color: #64748b; margin-top: 20px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <span class="badge">Breaking News</span>
          <h1>Latest Story Published</h1>
        </div>
        ${imageUrl ? `<img src="${imageUrl}" alt="${post.title}" class="post-image" />` : ''}
        <div class="content">
          ${post.categoryId ? `<div class="category">• ${post.categoryId}</div>` : ''}
          <h2 class="title">${post.title}</h2>
          <p class="subtitle">${post.subtitle || ''}</p>
          <a href="${postUrl}" class="button">Read Full Story &rarr;</a>
          <div class="meta">
            <span>By ${post.author || 'Editorial Desk'}</span> • <span>${post.readTime || '3 min read'}</span>
          </div>
        </div>
        <div class="footer">
          <p>You are receiving this because you subscribed to our news updates.</p>
          <p>&copy; ${new Date().getFullYear()} News Site. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailList = subscribers.map(s => s.email).filter(Boolean);
  if (emailList.length === 0) return;

  // Send asynchronously in batches using BCC to respect user privacy and avoid rate limits
  const batchSize = 50;
  for (let i = 0; i < emailList.length; i += batchSize) {
    const batch = emailList.slice(i, i + batchSize);
    mailer.sendMail({
      from: `"News Desk" <${config.email.from}>`,
      to: config.email.from, // Primary to yourself
      bcc: batch,            // All subscribers hidden in BCC
      subject: `📰 ${post.title}`,
      html,
    }).catch(err => {
      console.error('[Newsletter] Batch send failed:', err.message);
    });
  }
}
