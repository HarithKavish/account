# HarithKavish Account

The **Account Platform** — account lifecycle for HarithKavish, served from
**https://account.harithkavish.com**.

## The boundary that defines this project

There are two separate platforms. Keeping them separate is the point.

| | **Account Platform** (this repo) | **Authentication Platform** (separate) |
| --- | --- | --- |
| Domain | `account.harithkavish.com` | `auth.harithkavish.com` |
| Owns | Account creation, profile, credentials as stored data, deletion | Signing in, sessions, authenticating users into products |
| Database | `users`, `account_events` | Its own |
| Has a login? | **No** | Yes |

Forge, Nexus and VR will send users to the Auth Platform to sign in. They will
not implement their own login, and neither does this site.

The password hash lives **here**, because an account's credentials are lifecycle
data owned by the account. The *act* of authenticating with them belongs to
Auth. That split is deliberate; do not collapse it by adding a login here.

### What must never be added to this repo

- A login page, sign-in form, or "continue as" affordance
- Session tables, session cookies, or auth middleware
- A second WebAuthn implementation
- Anything that duplicates `auth.harithkavish.com`

---

## Status

Account creation is **real**. A user can create an account and it is persisted
to PostgreSQL with an Argon2id password hash and a database-enforced unique
user ID.

Account *management* (profile edits, password change, deletion) is built up to
the point where it needs to know who is asking. That proof comes from the Auth
Platform, whose contract is not finalised, so those operations render an
explicit "Sign-in required" state rather than a fake local login. See
`components/pending-auth.tsx` — replacing that component with real data is the
integration.

Passkeys are deliberately **not** implemented and have **no table yet**.
Registering credentials before the Account/Auth contract exists would bake in a
guess about which side owns them.

---

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Database | Neon (serverless PostgreSQL) |
| ORM / migrations | Drizzle + drizzle-kit |
| Password hashing | Argon2id (`@node-rs/argon2`) |
| Rate limiting | Upstash Redis (`@upstash/ratelimit`) |
| Hosting | Vercel |

---

## Getting started

```bash
npm install
cp .env.example .env.local     # fill in Neon + Upstash values
npm run db:migrate             # apply migrations to your database
npm run dev
```

```bash
npm run typecheck
npm run lint
npm run build
npm run db:generate            # regenerate SQL after editing lib/db/schema.ts
```

The build requires **no** credentials — nothing connects to a database or Redis
at build time. CI enforces this.

---

## Routes

| Route | Rendering | Purpose |
| --- | --- | --- |
| `/` | Static | What this site is; routes you to create or manage |
| `/signup` | **Dynamic** | Real account creation. Writes to PostgreSQL |
| `/account` | Static | Management overview |
| `/settings` | Static | Profile — pending Auth integration |
| `/security` | Static | Password, passkeys, sessions — pending Auth integration |
| `/delete` | Static | Deletion consequences and confirmation — pending Auth integration |

There is no `/login`, and no redirect logic that implies one.

---

## Data model

```
users                                account_events
├── id              uuid pk          ├── id           uuid pk
├── user_id         unique, lower    ├── user_id      → users.id, ON DELETE SET NULL
├── password_hash   argon2id         ├── type         enum
├── first_name                       ├── occurred_at
├── last_name                        └── metadata     jsonb, non-sensitive only
├── status          enum
├── created_at
├── updated_at
├── deletion_requested_at
└── deleted_at
```

`id` (internal UUID) is deliberately separate from `user_id` (what the user
types to sign in). The internal ID is never exposed as a login identity.

`status`, `deletion_requested_at` and `deleted_at` exist so a deletion can be
recorded and confirmed *before* the record is destroyed — which is what lets the
Auth Platform be told to invalidate its state first.

**No session table.** Sessions belong to the Auth Platform.

---

## Account creation flow

```
/signup  →  client validation (feedback only)
         →  Server Action  (Next.js Origin check = CSRF protection)
         →  server-side validation (authoritative)
         →  Upstash rate limit — before hashing, so Argon2 is not the DoS
         →  user_id availability check (friendly message)
         →  Argon2id hash
         →  transaction: insert user + account_created event
         →  return { userId, firstName } only
         →  confirmation, pointing at auth.harithkavish.com to sign in
```

The user is **not** logged in afterwards. There is nothing to log into.

---

## Security

Implemented:

- Argon2id, OWASP floor (19 MiB, t=2, p=1). Parameters live in the hash, so they
  can be raised later without invalidating existing accounts.
- Password hashes never leave the server. `toProfile()` builds its result field
  by field so a schema change cannot spread the hash into a response.
- Server-side validation is authoritative; the client copy is for speed only.
- Uniqueness enforced by a database unique index, not just an application check
  — the pre-check exists for a friendly message and cannot survive a race.
- Distributed rate limiting on account creation. If Upstash is unconfigured,
  signup **fails closed** rather than running unprotected.
- Parameterised queries throughout (Drizzle / `pg` placeholders).
- `server-only` on the database, password and rate-limit modules, so importing
  them from a client component is a build error.
- Errors are logged without the input, which contains a plaintext password.
- Security headers set in `next.config.ts` (now effective — the app is
  server-rendered again).
- Secrets only in environment variables; `.env*` is gitignored.

Known and deliberate:

- Signup reveals whether a user ID is taken. That is unavoidable on a form that
  must let you pick a free one, and is not a meaningful leak here.
- No CSP yet. It needs a nonce for the inline theme script; worth doing next.

---

## Deployment

Hosted on **Vercel**. GitHub Pages was removed: it serves static files only and
cannot run Server Actions or reach a database.

Required environment variables in the Vercel project:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** connection (host contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | Neon **direct** connection — migrations only |
| `UPSTASH_REDIS_REST_URL` | Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash |
| `NEXT_PUBLIC_SITE_URL` | `https://account.harithkavish.com` |

DNS for `account.harithkavish.com` is on Cloudflare. Point it at Vercel with the
record set to **DNS-only** (grey cloud) so two CDNs are not stacked.

---

## Verifying against the real database

After creating an account through the form:

```bash
npm run verify:signup -- <userId> <password>
```

Asserts the schema, the stored row, that the hash is Argon2id and genuinely
verifies, that the plaintext appears nowhere, that the audit event was written,
and that the database itself rejects a duplicate user ID.
