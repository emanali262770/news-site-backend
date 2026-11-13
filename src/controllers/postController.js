import { randomBytes } from 'node:crypto';
import Post from '../models/Post.js';
import Image from '../models/Image.js';
import Subscriber from '../models/Subscriber.js';
import { fail } from '../utils/errors.js';
import { listFilter, validatePost } from '../utils/postValidation.js';
import { translateText } from '../utils/translator.js';
import { sendNewPostNotification } from '../utils/mailer.js';

const summaryFields = 'slug title categoryId topic subtitle image author publishedAt readTime showOnHomepage translations';

function calculateTimeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

const serializePost = doc => {
  const { _id, __v, translations, ...fields } = doc.toObject();
  return { id: String(_id), ...fields, timeAgo: calculateTimeAgo(fields.publishedAt) };
};

function sanitizeLang(lang) {
  if (!lang || typeof lang !== 'string') return 'en';
  const clean = lang.trim();
  // Automatically map standard Punjabi 'pa' to Shahmukhi Punjabi (Arabic/Urdu script)
  if (clean.toLowerCase() === 'pa' || clean.toLowerCase() === 'punjabi') {
    return 'pa-Arab';
  }
  return /^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(clean) ? clean.toLowerCase() : 'en';
}

async function translatePostDetail(doc, lang) {
  const data = serializePost(doc);
  if (lang === 'en') return data;

  const cached = doc.translations instanceof Map 
    ? doc.translations.get(lang) 
    : doc.translations?.[lang];

  if (cached && cached.content && cached.title && cached.title !== doc.title) {
    data.title = cached.title;
    data.topic = cached.topic || data.topic;
    data.subtitle = cached.subtitle || data.subtitle;
    data.content = cached.content;
    if (data.caption !== undefined) data.caption = cached.caption || data.caption;
    return data;
  }

  const [title, topic, subtitle, content, caption] = await Promise.all([
    doc.title ? translateText(doc.title, lang) : '',
    doc.topic ? translateText(doc.topic, lang) : '',
    doc.subtitle ? translateText(doc.subtitle, lang) : '',
    doc.content ? translateText(doc.content, lang) : '',
    doc.caption ? translateText(doc.caption, lang) : '',
  ]);

  const translated = {
    title: title || doc.title,
    topic: topic || doc.topic || '',
    subtitle: subtitle || doc.subtitle,
    content: content || doc.content,
    caption: caption || doc.caption || '',
  };

  data.title = translated.title;
  data.topic = translated.topic;
  data.subtitle = translated.subtitle;
  data.content = translated.content;
  if (data.caption !== undefined) data.caption = translated.caption;

  if (translated.title !== doc.title && doc._id && Post.updateOne) {
    Post.updateOne(
      { _id: doc._id },
      { $set: { [`translations.${lang}`]: translated } }
    ).catch(err => console.error(`Cache update error [${lang}]:`, err.message));
  }

  return data;
}

async function translatePostSummary(doc, lang) {
  const data = serializePost(doc);
  if (lang === 'en') return data;

  const cached = doc.translations instanceof Map 
    ? doc.translations.get(lang) 
    : doc.translations?.[lang];

  if (cached && cached.title && cached.title !== doc.title) {
    data.title = cached.title;
    data.topic = cached.topic || data.topic;
    data.subtitle = cached.subtitle || data.subtitle;
    return data;
  }

  const [title, topic, subtitle] = await Promise.all([
    doc.title ? translateText(doc.title, lang) : '',
    doc.topic ? translateText(doc.topic, lang) : '',
    doc.subtitle ? translateText(doc.subtitle, lang) : '',
  ]);

  const translated = {
    ...(cached || {}),
    title: title || doc.title,
    topic: topic || doc.topic || '',
    subtitle: subtitle || doc.subtitle,
  };

  data.title = translated.title;
  data.topic = translated.topic;
  data.subtitle = translated.subtitle;

  if (translated.title !== doc.title && doc._id && Post.updateOne) {
    Post.updateOne(
      { _id: doc._id },
      { $set: { [`translations.${lang}`]: translated } }
    ).catch(err => console.error(`Summary cache error [${lang}]:`, err.message));
  }

  return data;
}

function calculateReadTime(content) {
  const wordCount = content.trim().split(/\s+/u).length;
  return `${Math.max(1, Math.ceil(wordCount / 200))} min read`;
}

function validatePostId(id) {
  if (!/^[a-f\d]{24}$/i.test(id)) throw fail(404, 'Post not found');
}

function createSlug(title) {
  const base = title
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 180) || 'post';

  return `${base}-${randomBytes(8).toString('hex')}`;
}

async function attachImageUrl(values) {
  if (!values.imageId) return;
  const image = await Image.findById(values.imageId);
  if (!image) throw fail(400, 'Uploaded image not found');
  values.image = image.url;
}

export async function list(req, res) {
  const { page, limit, filter } = listFilter(req.query || {});
  const lang = sanitizeLang(req.query?.lang);
  const [posts, total] = await Promise.all([
    Post.find(filter)
      .select(summaryFields)
      .sort({ publishedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Post.countDocuments(filter),
  ]);

  const data = lang === 'en'
    ? posts.map(serializePost)
    : await Promise.all(posts.map(p => translatePostSummary(p, lang)));

  res.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function detail(req, res) {
  const post = await Post.findOne({ slug: req.params.slug });
  if (!post) throw fail(404, 'Post not found');
  const related = await Post.find({ categoryId: post.categoryId, _id: { $ne: post._id } })
    .select(summaryFields)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(2);

  const lang = sanitizeLang(req.query?.lang);
  const [translatedPost, relatedPosts] = await Promise.all([
    translatePostDetail(post, lang),
    lang === 'en'
      ? Promise.resolve(related.map(serializePost))
      : Promise.all(related.map(p => translatePostSummary(p, lang))),
  ]);

  res.json({ ...translatedPost, relatedPosts });
}

export async function create(req, res) {
  const values = validatePost(req.body);
  await attachImageUrl(values);
  const post = await Post.create({
    ...values,
    slug: createSlug(values.title),
    readTime: calculateReadTime(values.content),
  });

  // Notify all active subscribers in the background without slowing down the response
  Subscriber.find({ isActive: true })
    .select('email')
    .then(subscribers => {
      if (subscribers && subscribers.length > 0) {
        sendNewPostNotification(subscribers, post);
      }
    })
    .catch(err => console.error('[Newsletter] Notification trigger error:', err.message));

  res.status(201).json(serializePost(post));
}

export async function update(req, res) {
  validatePostId(req.params.id);
  const values = validatePost(req.body, true);
  await attachImageUrl(values);
  if (values.content) values.readTime = calculateReadTime(values.content);
  if (values.title || values.topic || values.subtitle || values.content || values.caption) {
    values.translations = new Map();
  }
  const post = await Post.findByIdAndUpdate(req.params.id, { $set: values }, { new: true, runValidators: true });
  if (!post) throw fail(404, 'Post not found');
  res.json(serializePost(post));
}

export async function remove(req, res) {
  validatePostId(req.params.id);
  if (!await Post.findByIdAndDelete(req.params.id)) throw fail(404, 'Post not found');
  res.status(204).end();
}
