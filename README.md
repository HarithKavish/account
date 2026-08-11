# HarithKavish Account Platform

The account lifecycle system for the HarithKavish ecosystem.

**Production domain:** https://account.harithkavish.com

> **Deployment status:** the current codebase is **not yet deployed**. The
> domain still serves the previous static build from an earlier architecture.
> See [Deployment](#deployment).

---

## Contents

- [Purpose](#purpose)
- [Account Platform vs Auth Platform](#account-platform-vs-auth-platform)
- [Architecture](#architecture)
- [Data model](#data-model)
- [Account creation](#account-creation)
- [Security](#security)
- [Rate limiting](#rate-limiting)
- [Technology stack](#technology-stack)
- [Development](#development)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Project status](#project-status)
- [Roadmap](#roadmap)

---

## Purpose

This platform owns the **account lifecycle** for HarithKavish:

- Account creation
- Account profile management
- Account credential management (storing and changing credentials)
- Account deletion and lifecycle state
- Persistent account identity

It is intentionally **separate** from authentication.

---

## Account Platform vs Auth Platform

| | **Account Platform** (this repo) | **Auth Platform** (separate) |
| --- | --- | --- |
| Domain | `account.harithkavish.com` | `auth.harithkavish.com` |
| Owns | Account lifecycle and identity data | Authentication, login, sessions |
| Database | `users`, `account_events` | Its own, separate |
| Has a login? | **No** | Yes |

**The Account Platform does not provide login.** There is intentionally no
`/login` route, no session table, no session cookie, and no auth middleware.

Authentication belongs to `auth.harithkavish.com`. Future HarithKavish products
— Forge, Nexus, VR — will use the Auth Platform to sign users in rather than
implementing their own login.

The password hash is stored **here**, because an account's credentials are
lifecycle data owned by the account. The *act* of authenticating with those
credentials belongs to the Auth Platform.

> **Authentication integration is a separate development track and is not
> complete.** No contract between the two platforms has been finalised, and
> nothing in this repository communicates with `auth.harithkavish.com`.

### Not to be added to this repository

- A login page, sign-in form, or session-establishing flow
- Session tables, session cookies, or authentication middleware
- A WebAuthn implementation
- Anything duplicating the Auth Platform's responsibilities

---

## Architecture

```
User
  │
  ▼
account.harithkavish.com
  │
  ├── Account Web Application      Next.js App Router (React 19)
  │
  ├── Account Backend              Next.js Server Actions
  │
  ├── PostgreSQL / Neon            database "account"
  │
  └── Upstash Redis
          │
          └── Account creation rate limiting
```

There is no separate backend service. The "backend" is Next.js Server Actions
running on the server, which is why the application can no longer be exported as
a static site.

### Database separation

The database is a **dedicated `account` database inside the existing Neon
project**, not the project's default `neondb`. This keeps Account Platform data
separate from data the Auth Platform will hold later, in line with the
platform separation above.

### Neon branches — development vs production

```
Neon project "harithkavish"
│
├── production   (default branch)   → endpoint ep-long-recipe-…
│     └── database "account"        → used by the deployed application ONLY
│
└── dev          (branched from production)  → endpoint ep-round-frog-…
      └── database "account"        → used by local development ONLY
```

| | Local development | Production |
| --- | --- | --- |
| Neon branch | `dev` | `production` |
| Database | `account` | `account` |
| Credentials live in | `.env.local` (gitignored) | Vercel environment variables |

Production credentials are deliberately **not** present in `.env.local`. Local
development cannot reach the production database.

The `dev` branch was created from `production`, so it starts as a copy-on-write
snapshot of the schema and the data at that moment. Writing to it does not
affect production — verified by diffing the production schema and row counts
before and after a dev signup test.

Run `npm run env:check` to confirm which branch you are pointed at, and
`npm run db:schema` to print a database's structure and row counts.

### Redis environments

The Upstash free tier permits a single database, so development and production
**share one Redis instance**, separated by key namespace:

| Environment | Key prefix |
| --- | --- |
| Production | `account:signup:prod` |
| Vercel preview | `account:signup:preview` |
| Local development | `account:signup:dev` |

This stops development traffic consuming production's rate-limit budget. It is
namespace isolation, not instance isolation — the two environments still share
one credential. A separate production instance would be stronger and requires a
paid Upstash plan.

### Module layout

```
app/
  page.tsx              Entry point
  signup/
    page.tsx            Dynamic route (must not be prerendered)
    signup-form.tsx     Client component
    actions.ts          'use server' — account creation entry point
  account/, settings/, security/, delete/    Management UI
components/
  pending-auth.tsx      The Account/Auth boundary, made visible in the UI
lib/
  account/
    service.ts          createAccount(), isUserIdAvailable()
    password.ts         Argon2id hashing and verification
    rate-limit.ts       Upstash-backed limiter
    validation.ts       Shared rules; authoritative on the server
    types.ts            Domain types
  env.ts                Environment contract and validation (no file loading)
  env-cli.ts            Env loading for CLI tooling, via @next/env
  db/
    schema.ts           Drizzle schema
    client.ts           Neon pool + Drizzle instance
drizzle/                Generated SQL migrations
scripts/
  env-check.mts         Reports the resolved environment
  verify-signup.mts     Verification against the real database
```

`lib/db/client.ts`, `lib/account/password.ts` and `lib/account/rate-limit.ts`
import `server-only`, so importing them from a client component is a build
error.

---

## Data model

Defined in `lib/db/schema.ts`; the applied SQL is
`drizzle/0000_youthful_archangel.sql` (one migration applied to date).

### Enums

```
account_status      active | deletion_requested | deleted

account_event_type  account_created | profile_updated | password_changed
                    account_deletion_requested | account_deletion_cancelled
                    account_deleted
```

### `users`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | Internal identifier, `gen_random_uuid()`. Never used as a login identity |
| `user_id` | `text` NOT NULL | Public login identifier chosen by the user. Stored lowercase |
| `password_hash` | `text` NOT NULL | Argon2id encoded hash |
| `first_name` | `text` NOT NULL | |
| `last_name` | `text` NOT NULL | |
| `status` | `account_status` NOT NULL | Defaults to `active` |
| `created_at` | `timestamptz` NOT NULL | Defaults to `now()` |
| `updated_at` | `timestamptz` NOT NULL | Defaults to `now()` |
| `deletion_requested_at` | `timestamptz` NULL | Set when deletion is requested |
| `deleted_at` | `timestamptz` NULL | Set when the account is destroyed or tombstoned |

Indexes:

- `users_user_id_unique` — **UNIQUE** on `user_id`
- `users_status_idx` — on `status`

The internal `id` and the public `user_id` are deliberately distinct. The
internal UUID is never exposed as the user's login identity.

The `status`, `deletion_requested_at` and `deleted_at` columns exist so a
deletion can be recorded and confirmed before the record is destroyed. The
deletion workflow that would use them is **not implemented** — see
[Project status](#project-status).

### `account_events`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` NULL | FK → `users.id`, **ON DELETE SET NULL** |
| `type` | `account_event_type` NOT NULL | |
| `occurred_at` | `timestamptz` NOT NULL | Defaults to `now()` |
| `metadata` | `jsonb` NULL | Non-sensitive context only |

Index: `account_events_user_id_idx` on `user_id`.

The FK is nullable with `ON DELETE SET NULL` so deleting an account does not
remove its audit trail, while the trail retains no copy of the identity.
**No credential material is ever written to `metadata`.**

### Tables that intentionally do not exist

- **No session table.** Sessions belong to the Auth Platform.
- **No `passkeys` table.** Passkey storage is deferred until the Account/Auth
  contract defines which platform registers credentials and which verifies them.

---

## Account creation

The only fully implemented lifecycle operation. It writes to the real database.

```
First name
Last name
User ID
Password
Confirm password
       ↓
Client-side validation            fast feedback only, never the boundary
       ↓
Server Action                     Next.js Origin check provides CSRF protection
       ↓
Server-side validation            authoritative
       ↓
Rate limit check                  before hashing, so Argon2 is not itself the DoS
       ↓
User ID uniqueness check          friendly message; not relied on for correctness
       ↓
Argon2id password hashing
       ↓
PostgreSQL persistence            user + event written in one transaction
       ↓
account_created audit event
       ↓
Confirmation screen               points the user at auth.harithkavish.com
```

The user is **not** signed in afterwards. There is no session to create.

The response returned to the browser contains only `userId` and `firstName`.

### Validation rules

Defined in `lib/account/validation.ts` and applied on the server:

| Field | Rule |
| --- | --- |
| First / last name | Required, max 60 characters |
| User ID | Required, 3–64 characters, `^[a-z0-9][a-z0-9._+@-]*$` after lowercasing |
| Password | Required, 10–128 characters |
| Confirm password | Must match |

User IDs are normalised to lowercase, so uniqueness is case-insensitive.
Email addresses are valid user IDs.

---

## Security

Implemented and verified in this repository:

- **Argon2id password hashing** via `@node-rs/argon2`, at the OWASP floor:
  `memoryCost` 19456 KiB, `timeCost` 2, `parallelism` 1. Parameters are encoded
  in the hash, so they can be raised later without invalidating existing hashes.
- **No plaintext password storage.** The plaintext is never written to the
  database, and errors are logged without the input.
- **Password hashes never reach the client.** The service builds its result
  field by field, so a schema change cannot spread the hash into a response.
- **Database-level uniqueness constraint** on `users.user_id`. The application
  also pre-checks, but only to produce a friendly message — the unique index is
  what holds under concurrent signups, and `23505` is handled.
- **Server-side validation** is authoritative; the client copy exists for speed
  of feedback only.
- **Account creation rate limiting** backed by Upstash Redis — see below.
- **CSRF protection** for account creation via Next.js Server Actions, which
  verify the request Origin.
- **Audit trail** in `account_events`, carrying no credential material.
- **Parameterised queries** throughout — Drizzle ORM in application code, and
  numbered placeholders in the verification script. No SQL is built by string
  concatenation.
- **`server-only` guards** on the database, password and rate-limit modules.
- **Secrets in environment variables only.** `.env*` is gitignored except
  `.env.example`.
- **Security headers** set in `next.config.ts`: `X-Content-Type-Options`,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
  `Strict-Transport-Security`. These require a server, so they take effect once
  the application is deployed to a server host.

Known limitations, stated deliberately:

- **No Content-Security-Policy yet.** It needs a nonce for the inline theme
  script.
- **Signup reveals whether a user ID is taken.** Unavoidable on a form that must
  let the user choose a free identifier.
- **HTTPS in production is not yet provided by this application's own
  deployment**, because the application is not deployed. See
  [Deployment](#deployment).

---

## Rate limiting

Account creation is rate limited to protect against automated abuse.

- **Store:** Upstash Redis, accessed over its REST API.
- **Algorithm:** sliding window, via `@upstash/ratelimit`.
- **Limit:** 5 account-creation attempts per 10 minutes.
- **Key:** derived from the client IP taken from `x-forwarded-for` (leftmost
  entry) or `x-real-ip`. The value is used only as a counter key and is never
  stored in the database.
- **Key prefix:** `account:signup`.
- **Ordering:** the limit is checked *before* password hashing, so the
  deliberately expensive Argon2 step cannot itself be used as a denial of
  service.
- **Failure mode: closed.** If the Upstash environment variables are absent, the
  limiter reports itself unavailable and account creation is **refused** rather
  than proceeding unprotected.

Redis is used for counters only. No account data is stored there.

---

## Technology stack

Read from `package.json` and project configuration.

| Layer | Technology |
| --- | --- |
| Runtime | Node.js 22.x (pinned via `engines` and `.nvmrc`) |
| Framework | Next.js 16.3.0 (App Router, Turbopack) |
| UI | React 19.2.8, TypeScript 5 |
| Styling | Plain CSS with custom properties (`app/globals.css`) — no CSS framework |
| Database | PostgreSQL on Neon |
| Database driver | `@neondatabase/serverless` (WebSocket pool, via `ws`) |
| ORM / migrations | `drizzle-orm` 0.45, `drizzle-kit` 0.31 |
| Password hashing | `@node-rs/argon2` 2.0 |
| Rate limiting | `@upstash/ratelimit` 2.0 with `@upstash/redis` 1.38 |
| Server boundary | `server-only` |
| Linting | ESLint 9 with `eslint-config-next` |
| Env loading | `@next/env` — Next's own loader, shared by app and CLI |
| Script runner | `tsx` |

The WebSocket pool driver is used rather than Neon's HTTP driver because account
creation writes the user and its audit event in a single interactive
transaction, which the HTTP driver cannot hold open.

`@node-rs/argon2` is listed in `serverExternalPackages` in `next.config.ts` so
the native module is not bundled.

---

## Development

### Install

```bash
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Fill in the values described in [Environment variables](#environment-variables).

### Database migration

```bash
npm run db:migrate      # apply migrations
npm run db:generate     # regenerate SQL after editing lib/db/schema.ts
npm run db:studio       # browse the database
```

Migrations run against `DATABASE_URL_UNPOOLED`. PgBouncer, which backs the
pooled connection, cannot execute the session-level statements DDL requires.

### Run

```bash
npm run dev             # development server on http://localhost:3000
npm run build           # production build
npm run start           # serve the production build
```

### Checks

```bash
npm run typecheck       # tsc --noEmit
npm run lint            # eslint
npm run env:check       # report which env files loaded and what they point at
npm run db:schema       # print tables, enums, indexes, constraints, row counts
```

The production build requires **no** credentials — nothing connects to the
database or Redis at build time. CI enforces this.

### Verification script

After creating an account through the signup form:

```bash
npm run verify:signup -- <userId> <password>
```

Asserts against the real database that the schema and unique index exist, the
account row is present, the internal UUID is distinct from the public user ID,
the stored value is an Argon2id hash that verifies against the password and
rejects a wrong one, the plaintext appears nowhere in the row, the
`account_created` event was written without credential material, and that
PostgreSQL itself rejects a duplicate `user_id`.

The script is read-only apart from one duplicate-insert test, which runs inside
a transaction that is rolled back.

### Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main` and on pull requests:
typecheck, lint, then build without credentials.

There is no automated deployment workflow.

---

## Environment variables

Names and placeholders only. **Never commit real values.** See `.env.example`.

```
NEXT_PUBLIC_SITE_URL=https://account.harithkavish.com

DATABASE_URL=postgresql://<user>:<password>@<host>-pooler.<region>.aws.neon.tech/account?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://<user>:<password>@<host>.<region>.aws.neon.tech/account?sslmode=require

UPSTASH_REDIS_REST_URL=https://<id>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
```

| Variable | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Metadata | Public; safe to expose |
| `DATABASE_URL` | Running application | **Pooled** connection (host contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | Migrations, verification script | **Direct** connection |
| `UPSTASH_REDIS_REST_URL` | Rate limiter | Signup fails closed without it |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiter | Secret |

### Environment loading — one loader, one contract

The application and the CLI tooling must never resolve to different databases.
Three mechanisms enforce that.

**1. A single loader.** Everything that runs outside the Next.js server —
`drizzle.config.ts`, migrations, `env:check`, `verify:signup` — loads env files
through `lib/env-cli.ts`, which calls `loadEnvConfig` from **`@next/env`**: the
same loader Next.js itself runs at startup.

This matters because Next's precedence is not simply ".env.local then .env" — it
also considers `.env.development[.local]` and `.env.production[.local]`
depending on `NODE_ENV`. A hand-rolled loader reading only two of those files
will eventually disagree with the application. Using Next's own implementation
makes divergence impossible, because there is only one implementation.

`dotenv` is deliberately **not** a dependency, so a second loader cannot be
reintroduced by accident.

**2. A single contract.** `lib/env.ts` defines which variables exist and what
counts as valid. Both the app (`lib/db/client.ts`, `lib/account/rate-limit.ts`)
and the CLI read through it, so they fail identically on bad configuration.

**3. A consistency assertion.** `DATABASE_URL` (pooled, used by the app) and
`DATABASE_URL_UNPOOLED` (direct, used by migrations) are separate strings. If
they ever pointed at different databases, migrations would apply to one database
while the application read another — silently. `assertSameDatabase()` compares
host (ignoring Neon's `-pooler` suffix), database name and user, and refuses to
start on a mismatch.

There is also **no fallback** from one URL to the other. A missing
`DATABASE_URL_UNPOOLED` is an error, not a quiet switch to running migrations
through the pooler.

**Checking what resolved:**

```bash
npm run env:check
```

Prints the env files that were loaded, the database both URLs address, and
whether Upstash is configured — hosts and database names only, never
credentials. `db:migrate` and `verify:signup` print the same target line, so any
disagreement is visible immediately.

On a deployed host there are no env files; values come from the platform's
environment and the same validation applies.

Any new script that touches the database should import from `lib/env-cli.ts`.

---

## Deployment

### Current production state

`https://account.harithkavish.com` currently serves the **previous static
build** produced by an earlier architecture, deployed to GitHub Pages. That
build predates the account/auth separation and still contains a `/login` route.

**The current codebase has not been deployed.** The GitHub Pages workflow and
the static export configuration were removed, because static hosting cannot run
Server Actions or reach a database. No replacement deployment has been set up:
the repository is not linked to a hosting provider, and there is no deployment
workflow.

### Intended production deployment

- **Host:** Vercel — chosen for its Node runtime, which `@node-rs/argon2`
  requires as a native module.
- **Domain:** `account.harithkavish.com`, with DNS on Cloudflare. The record
  must be set to **DNS-only** so two CDNs are not stacked.
- **Environment variables:** all five listed above must be set in the hosting
  project.

### Environments

| Environment | Database | State |
| --- | --- | --- |
| Local development | Neon `dev` branch | Working |
| Staging | — | Does not exist |
| Production | Neon `production` branch | See deployment status above |

---

## Project status

### Implemented

- Account website and product shell
- Real PostgreSQL database on Neon (dedicated `account` database)
- Schema and one applied migration (`users`, `account_events`, enums, indexes)
- **Real account creation**, persisted to the production database
- Argon2id password hashing
- Server-side validation
- Database-enforced `user_id` uniqueness
- Account creation rate limiting via Upstash Redis
- `account_created` audit event
- Account lifecycle data model, including deletion state columns
- Management UI structure for profile, security and deletion
- CI: typecheck, lint, credential-free build
- Verification script covering the account-creation flow

### Not implemented

- **Production deployment** of the current codebase
- **Authentication integration** with `auth.harithkavish.com` — no contract
  exists and nothing communicates with it
- **Profile editing** — UI structure exists; the operation needs identity proof
- **Password change** — UI structure exists; needs identity proof
- **Account deletion workflow** — data model and confirmation UI exist, but
  there is deliberately **no deletion endpoint**, as an unauthenticated delete
  would be unsafe
- **Passkeys** — no table, no WebAuthn code
- Integration with Forge, Nexus or VR

Every management operation that requires knowing *who is asking* renders an
explicit "Sign-in required" state (`components/pending-auth.tsx`) rather than
implementing a local login. Replacing that component with real data is the
integration work.

### Routes

| Route | Rendering | State |
| --- | --- | --- |
| `/` | Static | Implemented |
| `/signup` | Dynamic | **Implemented — writes to the database** |
| `/account` | Static | Management overview; pending Auth integration |
| `/settings` | Static | Profile; pending Auth integration |
| `/security` | Static | Password, passkeys, sessions; pending Auth integration |
| `/delete` | Static | Deletion consequences and confirmation; pending Auth integration |
| `/login` | — | **Does not exist, by design** |

---

## Roadmap

All items below are **planned** and none are implemented.

1. **Production deployment** — deploy to Vercel, point the domain, retire the
   stale static build
2. **Account management** — profile editing and password change, once identity
   can be proven
3. **Authentication integration** — define the Account/Auth contract, then
   connect `auth.harithkavish.com`
4. **Passkeys** — design credential storage once the contract determines
   ownership, then implement
5. **Account deletion** — the confirmed, authenticated deletion workflow,
   including telling the Auth Platform to invalidate its state
6. **Forge integration**
7. **Nexus integration**
8. **VR integration**
9. **Standards-based identity** — OAuth 2.0 / OpenID Connect where appropriate,
   owned by the Auth Platform rather than this repository

---

## Documentation principle

This README is the project's source of truth. Anything described as implemented
has been verified against the repository and, where applicable, against the
live database. Anything not implemented is labelled as planned or in progress.

No credentials, tokens, connection strings or real account data appear in this
document.
