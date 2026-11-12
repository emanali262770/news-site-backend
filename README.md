# News backend

Express 5 + MongoDB/Mongoose API. MVC structure: `src/models`, `src/controllers`, `src/routes`; JSON responses are the API view. No signup or draft workflow.

## Setup

1. Run `npm install` (PowerShell execution-policy issues: use `npm.cmd`).
2. Keep your existing `MONGODB_URI` in `.env`. Add the other settings from `.env.example` without overwriting your URI.
3. Generate `SESSION_SECRET` with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
4. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD` (at least 12 characters) and optionally `ADMIN_NAME`. Run `npm run seed:admin`. The fixed admin ID prevents multiple admins; reruns do not change credentials. Remove `ADMIN_PASSWORD` after setup.
5. Run `npm run dev` or `npm start`. Default port: 5000. Run `npm test` for isolated tests (no database writes).

## Frontend authentication

Every fetch uses `credentials: 'include'`. Never store the password or session ID in localStorage.

1. `GET /api/auth/csrf` returns `{ csrfToken }` and sets an anonymous HttpOnly session cookie.
2. `POST /api/auth/login` sends `{ email, password }` as JSON with `X-CSRF-Token`. Login returns `{ admin, csrfToken }`; use this **new** token after login because the session is rotated.
3. On refresh call `GET /api/auth/me`; it returns `{ admin, csrfToken }`. A 401 means show login.
4. Send `X-CSRF-Token` for every POST/PATCH/DELETE, including logout and multipart uploads. Keep this token in memory. Logout invalidates the server session; fetch a new CSRF token before logging in again.

Sessions are persisted in MongoDB; the browser session cookie expires 24 hours after login. Login is limited to 10 attempts per IP per 15 minutes. The rate limiter is per process: use a shared rate-limit store before deploying multiple instances.

## Endpoints

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Public |
| POST | `/api/auth/login` | Public, rate limited + CSRF |
| GET | `/api/auth/me` | Admin |
| POST | `/api/auth/logout` | Admin + CSRF |
| GET | `/api/categories` | Public |
| GET | `/api/posts` | Public |
| GET | `/api/posts/:slug` | Public |
| POST | `/api/posts` | Admin + CSRF |
| PATCH | `/api/posts/:id` | Admin + CSRF |
| DELETE | `/api/posts/:id` | Admin + CSRF |
| POST | `/api/uploads/images` | Admin + CSRF |

Categories return an array of `{ id, label }`. Listing supports combined `category`, `search`, `homepage=true|false`, `page` (default 1), `limit` (default 10, max 100). Response: `{ data, pagination: { page, limit, total, totalPages } }`. Results sort by newest publication first. Search is a case-insensitive literal substring over title, subtitle, topic and content. Large datasets may need a dedicated search index.

Detail returns the full post, including `imageId`, `content`, `imageAlt`, `caption`, `showOnHomepage`, timestamps and `relatedPosts` (maximum two from the same category). Use the listing's slug to load an edit form, then PATCH using its ID. Create returns 201 with the full saved post; PATCH returns the updated post; DELETE returns 204 with no body. Deleted posts immediately return 404 in detail and disappear from listings. Errors use `{ message }`.

Create requires `title` (max 250), `categoryId`, `subtitle`, `imageId`, `author`, `content`. Optional: `topic`, `imageAlt`, `caption`, `showOnHomepage` (boolean, defaults false). PATCH accepts any nonempty subset of these fields. Unknown fields are rejected. Slugs have a random suffix for uniqueness; edits preserve slug and original publication date. Read time is at least one minute, based on 200 words/minute. Content is plain text; frontend should render it as text, not raw HTML.

Upload multipart field `image`: JPG/PNG/WebP, maximum 1 MiB and 25 megapixels, single frame. Files are decoded and re-encoded as WebP (metadata stripped); the response is `{ id, url }`. Supply this ID in the post. URLs are relative to the API origin. Uploaded images remain available when posts are deleted because images may be shared by other posts. Unused image cleanup is not automatic.

## Deployment

Set `NODE_ENV=production` and serve over HTTPS for Secure cookies. Set `FRONTEND_ORIGIN` to the exact frontend origin (comma-separated if needed); include any same-origin frontend deployment too. For genuinely cross-site HTTPS deployments set `COOKIE_SAME_SITE=none`; browser third-party cookie policies may still block sessions, so a same-site deployment is preferable. Configure `TRUST_PROXY_HOPS` only to match your trusted reverse proxy topology.

`UPLOAD_DIR` must be persistent storage; back it up along with MongoDB. Local disk storage assumes one application instance or a shared filesystem. Do not deploy uploads on an ephemeral filesystem. No sample news was provided, so no fabricated sample import is included.

Session and image handling follow the [Express session documentation](https://expressjs.com/en/resources/middleware/session/) and [Sharp image input documentation](https://sharp.pixelplumbing.com/api-input/).
