import test from 'node:test';
import assert from 'node:assert/strict';
import session from 'express-session';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
sharp.cache(false);
import { hashPassword, verifyPassword } from '../src/utils/password.js';
import { validatePost, listFilter } from '../src/utils/postValidation.js';

process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/unused-test-db';
process.env.SESSION_SECRET = 'test-only-secret-that-is-at-least-32-characters';
process.env.NODE_ENV = 'test';
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
const { createApp } = await import('../src/app.js');
const { default: Admin } = await import('../src/models/Admin.js');
const { default: Post } = await import('../src/models/Post.js');
const { default: Image } = await import('../src/models/Image.js');
const { config } = await import('../src/config.js');
const posts = await import('../src/controllers/postController.js');

test('post create, edit, filtering, related posts and delete contracts', async t => {
  const imageId = '0123456789abcdef01234567';
  const payload = { title: 'Pakistan wins', categoryId: 'sports', subtitle: 'Match report', imageId, author: 'Sports Desk', content: 'First paragraph.\n\nSecond paragraph.' };
  let saved;
  t.mock.method(Image, 'findById', async () => ({ url: '/uploads/example.webp' }));
  t.mock.method(Post, 'create', async values => (saved = new Post(values)));
  const { default: Subscriber } = await import('../src/models/Subscriber.js');
  t.mock.method(Subscriber, 'find', () => ({
    select: () => Promise.resolve([])
  }));
  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() {} };
  await posts.create({ body: payload }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.image, '/uploads/example.webp');
  assert.equal(res.body.readTime, '1 min read');
  assert.match(res.body.slug, /^pakistan-wins-/);
  assert.equal(res.body.showOnHomepage, false);
  const slug = saved.slug;
  const publishedAt = saved.publishedAt;
  t.mock.method(Post, 'findByIdAndUpdate', async (id, update, options) => {
    assert.equal(id, saved.id);
    assert.equal(options.runValidators, true);
    assert.equal(update.$set.slug, undefined);
    assert.equal(update.$set.publishedAt, undefined);
    saved.set(update.$set);
    return saved;
  });
  await posts.update({ params: { id: saved.id }, body: { title: 'Updated title', content: 'word '.repeat(401) } }, res);
  assert.equal(res.body.slug, slug);
  assert.equal(res.body.publishedAt.getTime(), publishedAt.getTime());
  assert.equal(res.body.readTime, '3 min read');
  let listedFilter;
  let countedFilter;
  t.mock.method(Post, 'find', filter => {
    listedFilter = filter;
    return { select() { return this; }, sort() { return this; }, skip(value) { assert.equal(value, 5); return this; }, limit: async () => [saved] };
  });
  t.mock.method(Post, 'countDocuments', async filter => { countedFilter = filter; return 6; });
  await posts.list({ query: { category: 'sports', search: 'Pakistan', page: '2', limit: '5' } }, res);
  assert.deepEqual(listedFilter, countedFilter);
  assert.equal(listedFilter.categoryId, 'sports');
  assert.deepEqual(res.body.pagination, { page: 2, limit: 5, total: 6, totalPages: 2 });
  t.mock.method(Post, 'findOne', async () => saved);
  await posts.detail({ params: { slug } }, res);
  assert.equal(String(listedFilter._id.$ne), saved.id);
  assert.equal(listedFilter.categoryId, 'sports');
  t.mock.method(Post, 'findByIdAndDelete', async () => { const previous = saved; saved = null; return previous; });
  const id = saved.id;
  await posts.remove({ params: { id } }, res);
  assert.equal(res.statusCode, 204);
  await assert.rejects(posts.detail({ params: { slug } }, res), error => error.status === 404);
  await assert.rejects(posts.remove({ params: { id } }, res), error => error.status === 404);
});

test('password hashes are salted and reject the wrong password', async () => {
  const first = await hashPassword('correct-password');
  const second = await hashPassword('correct-password');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('correct-password', first), true);
  assert.equal(await verifyPassword('incorrect', first), false);
});

test('post validation rejects invalid and server-owned fields', () => {
  assert.throws(() => validatePost({}), /title is required/);
  assert.throws(() => validatePost({ slug: 'overwrite' }, true), /Unknown field/);
  assert.throws(() => validatePost({ showOnHomepage: 'true' }, true), /boolean/);
  assert.throws(() => validatePost({ categoryId: 'opinion' }, true), /Invalid categoryId/);
  assert.throws(() => validatePost({ title: 'x'.repeat(251) }, true), /Invalid title/);
  assert.throws(() => validatePost({ imageId: 'invalid' }, true), /Invalid imageId/);
  assert.deepEqual(validatePost({ content: 'First paragraph.\n\nSecond paragraph.' }, true), { content: 'First paragraph.\n\nSecond paragraph.' });
});

test('listing combines filters and escapes regex search', () => {
  const { page, limit, filter } = listFilter({ page: '2', limit: '5', category: 'sports', search: 'a.*', homepage: 'true' });
  assert.equal(page, 2);
  assert.equal(limit, 5);
  assert.equal(filter.categoryId, 'sports');
  assert.equal(filter.showOnHomepage, true);
  assert.equal(filter.$or[0].title.$regex, 'a\\.\\*');
  for (const query of [{ page: '0' }, { limit: '101' }, { search: { $ne: '' } }, { category: 'latest-news' }, { homepage: 'yes' }]) {
    assert.throws(() => listFilter(query));
  }
});

test('HTTP auth, session rotation, CSRF, upload validation and logout', async t => {
  const uploadDirectory = await mkdtemp(path.join(os.tmpdir(), 'news-upload-test-'));
  const previousUploads = config.uploads;
  config.uploads = uploadDirectory;
  t.after(async () => { config.uploads = previousUploads; await rm(uploadDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); });
  t.mock.method(Image, 'create', async values => ({ id: 'image-id', ...values }));
  const passwordHash = await hashPassword('correct-password');
  const admin = { id: 'admin', name: 'Admin', email: 'admin@example.com', passwordHash };
  t.mock.method(Admin, 'findOne', () => ({ select: async () => admin }));
  t.mock.method(Admin, 'findById', async () => admin);
  const app = createApp({ sessionStore: new session.MemoryStore() });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let cookie;
  let token;
  const request = (path, options = {}) => fetch(base + path, { ...options, headers: { ...(cookie ? { Cookie: cookie } : {}), ...options.headers } });
  const json = body => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': token });
  assert.equal((await request('/auth/me')).status, 401);
  for (const [path, method] of [['/posts', 'POST'], ['/posts/abc', 'PATCH'], ['/posts/abc', 'DELETE'], ['/uploads/images', 'POST']]) {
    assert.equal((await request(path, { method })).status, 401);
  }
  assert.equal((await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  const csrf = await request('/auth/csrf');
  cookie = csrf.headers.get('set-cookie').split(';')[0];
  token = (await csrf.json()).csrfToken;
  const initialCookie = cookie;
  assert.equal((await request('/auth/login', { method: 'POST', headers: json(), body: JSON.stringify({ email: admin.email, password: 'wrong' }) })).status, 401);
  const login = await request('/auth/login', { method: 'POST', headers: json(), body: JSON.stringify({ email: admin.email, password: 'correct-password' }) });
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/);
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.notEqual(cookie, initialCookie);
  const result = await login.json();
  token = result.csrfToken;
  assert.equal(result.admin.passwordHash, undefined);
  const me = await request('/auth/me');
  assert.equal(me.status, 200);
  assert.equal((await me.json()).admin.email, admin.email);
  assert.equal((await request('/posts', { method: 'POST', headers: { ...json(), Origin: 'https://evil.example' }, body: '{}' })).status, 403);
  assert.equal((await request('/posts', { method: 'POST', headers: json(), body: '{}' })).status, 400);
  const form = new FormData();
  form.append('image', new Blob(['not an image'], { type: 'image/png' }), 'fake.png');
  assert.equal((await request('/uploads/images', { method: 'POST', headers: { 'X-CSRF-Token': token }, body: form })).status, 400);
  const large = new FormData();
  large.append('image', new Blob([new Uint8Array(1024 * 1024 + 1)]), 'large.png');
  assert.equal((await request('/uploads/images', { method: 'POST', headers: { 'X-CSRF-Token': token }, body: large })).status, 400);
  const validImage = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
  const validForm = new FormData();
  validForm.append('image', new Blob([validImage], { type: 'image/png' }), 'valid.png');
  const uploaded = await request('/uploads/images', { method: 'POST', headers: { 'X-CSRF-Token': token }, body: validForm });
  assert.equal(uploaded.status, 201);
  assert.match((await uploaded.json()).url, /^\/uploads\/[\da-f-]+\.webp$/);
  const files = await readdir(uploadDirectory);
  assert.equal(files.length, 1);
  assert.equal((await sharp(path.join(uploadDirectory, files[0])).metadata()).format, 'webp');
  assert.equal((await request('/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': token } })).status, 200);
  assert.equal((await request('/auth/me')).status, 401);
  const categories = await (await request('/categories')).json();
  assert.equal(categories.length, 10);
  assert.ok(!categories.some(category => category.id === 'opinion'));
});

test('multi-language translation caching contract', async t => {
  const postDoc = new Post({
    title: 'Hello',
    slug: 'hello-slug',
    categoryId: 'pakistan',
    subtitle: 'Greetings',
    imageId: '0123456789abcdef01234567',
    image: '/uploads/test.webp',
    author: 'Author',
    content: 'Long content here',
    readTime: '1 min read',
  });
  postDoc.translations.set('ur', {
    title: 'ہیلو',
    subtitle: 'خوش آمدید',
    content: 'لمبا مواد',
    caption: '',
  });

  t.mock.method(Post, 'findOne', async () => postDoc);
  t.mock.method(Post, 'find', () => ({
    select() { return this; },
    sort() { return this; },
    limit: async () => [],
  }));

  const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  
  await posts.detail({ params: { slug: 'hello-slug' }, query: { lang: 'ur' } }, res);
  assert.equal(res.body.title, 'ہیلو');
  assert.equal(res.body.subtitle, 'خوش آمدید');
  assert.equal(res.body.content, 'لمبا مواد');
  assert.equal(res.body.timeAgo, 'Just now');

  await posts.detail({ params: { slug: 'hello-slug' }, query: { lang: 'en' } }, res);
  assert.equal(res.body.title, 'Hello');
  assert.equal(res.body.subtitle, 'Greetings');
  assert.equal(res.body.content, 'Long content here');
});
