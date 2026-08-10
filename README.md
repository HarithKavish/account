# HarithKavish Account

Centralized identity for HarithKavish products, served from
**https://account.harithkavish.com**.

The account model is intentionally minimal: a user ID, a password, a first and
last name, and (later) passkeys. This platform owns identity and authentication
only — Forge, Nexus, VR and future products own their own data.

---

## Status: Phase 1 (product shell) — complete

The website, design system, information architecture and navigation are built.
**Authentication is not.** Sign-in currently runs against a browser-local
demonstration backend so the product could be designed and reviewed before the
identity system is built underneath it.

The running app says so plainly: a persistent banner warns against entering a
real password, and every feature that would be security-sensitive to fake
(password change, passkeys, session management) reports itself as unavailable
rather than simulating success.

| Phase | Scope | State |
| --- | --- | --- |
| 1 | Website / product shell | Done |
| 2 | PostgreSQL schema | Not started |
| 3 | Real registration, login, sessions | Not started |
| 4 | Passkeys (WebAuthn) | Not started |
| 5 | Account management | Not started |
| 6 | Multi-application identity groundwork | Not started |
| 7 | Forge / Nexus / VR integration | Not started |

---

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run build        # production build
npm start            # serve the production build
```

Copy `.env.example` to `.env.local` if you need to override the site origin.
No secrets are required in Phase 1.

---

## Routes

| Route | Access | Purpose |
| --- | --- | --- |
| `/` | Public | Entry point — what the account is, and the way in |
| `/login` | Public | Sign in with user ID and password |
| `/signup` | Public | Create an account (name, user ID, password) |
| `/passkey` | Public | Passkey sign-in — states honestly that it is not built yet |
| `/account` | Protected | Account dashboard: profile, status, connected products |
| `/security` | Protected | Password, passkeys, active sessions |
| `/settings` | Protected | Profile editing, security shortcut, appearance, sign out |

Redirect behaviour:

- A signed-out visitor to a protected route goes to `/login?next=<route>` and is
  returned there after signing in.
- A signed-in visitor to `/login` or `/signup` goes to `/account`.
- `next` is only honoured when it is a same-origin absolute path, so it cannot
  be used as an open redirect.

---

## Architecture

```
app/                      Routes (App Router). One directory per page.
  globals.css             The whole design system: tokens + component classes.
components/               Shell, forms, guards. All client components.
lib/
  account/
    types.ts              Domain types + the AuthBackend interface.
    validation.ts         Rules shared by client and (in Phase 3) server.
    mock-backend.ts       PHASE 1 ONLY. Browser-local demonstration.
    backend.ts            Selects the installed backend. One line to swap.
    redirect.ts           Safe post-login redirect handling.
  config/site.ts          Navigation, branding, ecosystem roadmap data.
```

### The swap point

Every page and component talks to `AuthBackend` (`lib/account/types.ts`) and
never to the mock directly. Phase 3 adds a `ServerAuthBackend` implementing the
same interface and changes the one line in `lib/account/backend.ts`. The UI does
not change.

`AuthBackend.capabilities` drives what the UI claims to support, so Phases 3–5
light up their sections by reporting `true` rather than by editing pages.

### Data model

Types in `lib/account/types.ts` already match the intended Phase 2 schema. Note
that the internal `id` (UUID) is deliberately separate from the public `userId`
that people type to sign in, and that passkeys are a separate collection keyed by
`userId` — a user may register several.

```
users                              passkeys
├── id            internal UUID    ├── id
├── user_id       public, unique   ├── user_id       → users.id
├── password_hash                  ├── credential_id
├── first_name                     ├── public_key
├── last_name                      ├── sign_count
├── created_at                     ├── created_at
└── updated_at                     └── last_used_at
```

No client-visible type carries a password hash, and none ever should.

---

## Design system

Tokens are inherited from the existing HarithKavish sites so this reads as part
of the same family: the `--bg` / `--surface` / `--accent` / `--muted` palette,
the `Aptos` type stack, 1.4rem card radius, pill controls, the radial background
wash and the 120px grid overlay. Light and dark are both first-class, switched
via `data-theme` on the root element with a pre-paint script so there is no
flash.

---

## Security posture in Phase 1

- No plaintext password is ever written to storage.
- The demo credential marker is a salted SHA-256 digest and is **not** a password
  hashing function — Phase 3 uses Argon2id server-side and the client never sees
  a hash at all.
- Sign-in failures give one message for both unknown user and wrong password, so
  user IDs cannot be enumerated.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, HSTS,
  `Referrer-Policy`, `Permissions-Policy`) are set in `next.config.ts`. A CSP is
  deferred to Phase 3, when the inline theme script can carry a nonce.
- Routes are `noindex` — an account platform has nothing to gain from crawling.
- `.env*` is gitignored; no secrets are in source control.

---

## Deployment

The app is a standard Next.js build with no external services in Phase 1, so any
Node host works. On Vercel: import the repository, keep the defaults, and point
`account.harithkavish.com` at the deployment.

Set `NEXT_PUBLIC_SITE_URL` if the deployment serves from a different origin;
it defaults to the production domain.
