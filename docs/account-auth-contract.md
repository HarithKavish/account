# Account ↔ Auth Architecture Contract

The shared contract between the **HarithKavish Account Platform** and the
**HarithKavish Auth Platform**.

| | |
| --- | --- |
| Account | https://account.harithkavish.com |
| Auth | https://auth.harithkavish.com |
| Document status | **Revision 3** — incorporates the final Auth decisions |
| Applies to | Account (this repository) and the separate Auth project |

This document exists so that Auth can be designed and built against a settled
contract, and so that Account can evolve without silently breaking it. It is a
specification, not a description of working software.

---

## How to read this document

Every substantive statement carries one of four markers. Nothing in this
document should be assumed to exist unless it is marked **FACT**.

| Marker | Meaning |
| --- | --- |
| **[FACT]** | Implemented and deployed in Account today. Verified against the running system. |
| **[RESOLVED]** | Decided in joint review. Architecturally settled — but **not built**. |
| **[PROPOSED]** | Intended architecture, not yet formally ratified. Not built. |
| **[OPEN QUESTION]** | Requires an explicit decision before implementation begins. |

**[RESOLVED] and [PROPOSED] both mean "no code exists."** The distinction is
whether the decision is settled, not whether it is implemented. See §19 for the
consolidated list of resolved decisions.

---

## Contents

- [1. Architectural principles](#1-architectural-principles)
- [2. Roles and ownership](#2-roles-and-ownership)
- [3. Current state of Account](#3-current-state-of-account-fact)
- [4. Identity model](#4-identity-model)
- [5. Single sign-on, as experienced](#5-single-sign-on-as-experienced)
- [6. Session model](#6-session-model)
- [7. Authentication versus authorization](#7-authentication-versus-authorization)
- [8. Protocol](#8-protocol)
- [9. Tokens and signing](#9-tokens-and-signing)
- [10. Claims](#10-claims)
- [11. Password ownership](#11-password-ownership)
- [12. Private Account → Auth interface](#12-private-account--auth-interface)
- [13. Passkeys and the RP ID](#13-passkeys-and-the-rp-id)
- [14. Account status semantics](#14-account-status-semantics)
- [15. Logout and revocation](#15-logout-and-revocation)
- [16. Failure model](#16-failure-model)
- [17. Security requirements](#17-security-requirements)
- [18. Hosting](#18-hosting)
- [19. Resolved decisions](#19-resolved-decisions)
- [20. Irreversible decisions](#20-irreversible-decisions)
- [21. Open questions](#21-open-questions)
- [22. Implementation boundary](#22-implementation-boundary)

---

## 1. Architectural principles

These are the invariants. Everything else in this document follows from them,
and any future change that violates one of them is a change to the
architecture, not an implementation detail.

1. **Account answers "Who is this person?"**
2. **Auth answers "Has this person authenticated?"**
3. **Applications answer "What can this authenticated person do here?"**
4. **No application owns the primary password.**
5. **No application bypasses Auth for normal user authentication.**
6. **No shared parent-domain authentication cookie.**
7. **The Account UUID is the stable ecosystem identity.**
8. **Standard OIDC/OAuth is preferred over a custom protocol.**

> **Principles 4 and 5 apply to Account itself.** Account is the identity
> authority, but it is not exempt from them: for its own authenticated
> surfaces, Account is a first-party client of Auth like any other application.
> See §2. **[RESOLVED]**

---

## 2. Roles and ownership

### Account — the identity authority

Account owns:

| Concern | Status |
| --- | --- |
| Immutable internal account UUID | **[FACT]** |
| User ID (public, user-facing login identifier) | **[FACT]** |
| First name, last name | **[FACT]** |
| Password credential material | **[FACT]** |
| Account status and lifecycle state | **[FACT]** |
| Identity / profile data | **[FACT]** |
| Passkey credential records | **[RESOLVED]** — no such table exists today (§13) |

### Auth — the authentication and SSO authority

> **Auth is the sole authentication authority for the entire first-party
> HarithKavish ecosystem.** **[RESOLVED]** There is no second authenticator, no
> per-application exception, and no category of user for whom authentication
> happens elsewhere. Account is not an exception to this — it holds the
> credentials but does not authenticate with them (§2, R4/R5).

Auth owns — **none of it built**:

- Authentication ceremonies (password, passkey, any future factor)
- The SSO session
- OIDC authorization
- Authorization codes
- ID, access and refresh tokens
- Client registration
- Login and logout flows
- Authentication-side revocation
- **The WebAuthn ceremony and RP identity** (§13) **[RESOLVED]**

### Account is itself a first-party OIDC client of Auth **[RESOLVED]**

This is the decision that closes the loop in the architecture, and it deserves
stating plainly:

> **Account's authenticated surfaces authenticate through Auth.**
> Account's settings, profile and security pages are protected by Auth, exactly
> as Forge's or Nexus's would be. Account holds no session of its own beyond an
> ordinary application session established from an Auth authentication result.

| | |
| --- | --- |
| Account's authenticated surfaces | Settings, profile, security, deletion — **authenticate via Auth** |
| Account's unauthenticated surface | **Account creation (signup) remains unauthenticated** |
| Account's own login system | **Must never exist** |

**Why account creation stays unauthenticated:** the ecosystem has to bootstrap.
A person with no account cannot authenticate, so the surface that creates the
first account cannot require authentication. Signup is therefore permanently
outside the authenticated perimeter, and is protected by rate limiting and
validation rather than by a session. **[RESOLVED]**

**Why Account must never implement its own login:** Account holds the password
hashes. If it also performed its own login, it would become a second
authentication authority — with its own session semantics, its own logout, and
its own revocation behaviour, none of which Auth would know about. Every
argument in this document for centralising authentication applies to Account
with more force than to any other application, precisely because it is the one
platform that *could* implement login without asking anyone.

### Account holds two distinct credentials, and they must stay distinct **[RESOLVED]**

Account stands in two unrelated relationships to Auth, and each carries its own
credential:

| Credential | Purpose | Direction |
| --- | --- | --- |
| **Account's OIDC client credential** | Identifies Account as a first-party *client* when its management surfaces authenticate a user | Account → Auth, public OIDC surface |
| **Account's private service credential** | Identifies Account as the *callee* of the private service interface, and as the caller of lifecycle notifications | Private interface, both directions |

**These must be independent and independently rotatable.** **[RESOLVED]**

- Neither may be accepted where the other is expected. A client credential
  presented at the private interface, or a service credential presented at
  Auth's OIDC endpoints, is a rejection — not a fallback.
- **Compromise of one must not require rotating the other**, and rotating one
  must not invalidate the other. If they shared material, an incident affecting
  the public client surface would force an outage of credential verification —
  turning a contained problem into an ecosystem-wide authentication failure.
- They differ in exposure, blast radius and rotation cadence, and so must differ
  in material.

This is the concrete expression of invariants I6 and I7 in the private
interface design: **Account cannot mint Auth tokens, and Account cannot
impersonate an application** — including impersonating itself in its other
role.

### Operator break-glass is not a user authentication fallback **[RESOLVED]**

A distinction that must not be allowed to blur:

| | Operator recovery | User authentication fallback |
| --- | --- | --- |
| Who | The system operator | An end user |
| Purpose | Recover the system when Auth or Account is broken | Sign in when Auth is unavailable |
| Exposure | Out-of-band; never a route on a public site | Would be a public login path |
| Status | Legitimate and necessary | **Forbidden** (§16) |

Operator recovery — direct database access, infrastructure credentials,
platform consoles — exists because someone must be able to repair a broken
system. It is an administrative capability of the infrastructure, **not a
feature of the product**.

It must never be surfaced as a user-facing route, never be documented as a
"backup login", and never be reachable by anyone other than the operator. The
moment a break-glass path is exposed to users, it *is* a second authentication
system, and the architecture has failed. The mechanism is **[OPEN QUESTION]**
(§21).

### Applications — Forge, VR, Nexus, and future platforms

Applications — **[RESOLVED]** as the model, unimplemented:

- **never** implement primary password authentication
- **never** store the user's primary password
- authenticate through Auth
- maintain their own application session
- control their own application-specific authorization

### The first-party client set **[RESOLVED]**

**Account, Forge, VR, Nexus and future HarithKavish platforms are all
first-party clients of Auth.** They are operated by the same party, registered
ahead of time, and mutually trusted at the identity layer. Consequences in §7
(consent) and §4 (subject identifier).

---

## 3. Current state of Account **[FACT]**

Everything in this section is implemented, deployed, and verified against the
production database.

### What exists

- Account creation through a real form, persisted to PostgreSQL (Neon)
- Argon2id password hashing — `memoryCost` 19456 KiB, `timeCost` 2,
  `parallelism` 1
- Database-enforced uniqueness on the public user ID
- Internal UUID distinct from the public user ID
- Append-only audit trail
- Account-creation rate limiting (Upstash Redis)
- Deployed on Vercel, Node 22.x, serving `account.harithkavish.com`

### Schema

Two tables, one applied migration.

**`users`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()`. **The stable ecosystem identity.** |
| `user_id` | `text` NOT NULL | Public login identifier. Stored lowercase. Unique index. |
| `password_hash` | `text` NOT NULL | Argon2id encoded hash. Never leaves Account. |
| `first_name` | `text` NOT NULL | |
| `last_name` | `text` NOT NULL | |
| `status` | `account_status` NOT NULL | Default `active` |
| `created_at` | `timestamptz` NOT NULL | |
| `updated_at` | `timestamptz` NOT NULL | |
| `deletion_requested_at` | `timestamptz` NULL | |
| `deleted_at` | `timestamptz` NULL | |

Indexes: `users_user_id_unique` (UNIQUE on `user_id`), `users_status_idx`.

**`account_events`**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | |
| `user_id` | `uuid` NULL | FK → `users.id`, `ON DELETE SET NULL` |
| `type` | `account_event_type` NOT NULL | |
| `occurred_at` | `timestamptz` NOT NULL | |
| `metadata` | `jsonb` NULL | Non-sensitive context only. No credential material. |

**Enums**

```
account_status      active | deletion_requested | deleted

account_event_type  account_created | profile_updated | password_changed
                    account_deletion_requested | account_deletion_cancelled
                    account_deleted
```

**`account_status` contains exactly three values. There is no `suspended`
value, and none is to be added in V1** (§14).

### What deliberately does not exist in Account

| | |
| --- | --- |
| `/login` route | Returns **404**, and must continue to. Account authenticates its users *through Auth* as a client (§2) — it never operates a login of its own. |
| Session table | Sessions belong to Auth. Account's future application session is an ordinary client session, established from an Auth result. |
| Session cookie, auth middleware | None. |
| `passkeys` table | Not to be created yet (§13). |
| Any call to `auth.harithkavish.com` | Nothing in Account communicates with Auth. |
| OIDC client registration for Account | Account is not registered with anything, because Auth does not exist. |

The `account_event_type` enum already anticipates lifecycle events that Auth
will care about — `password_changed`, `account_deletion_requested`,
`account_deleted`. Those values exist today; **no delivery mechanism to Auth
exists** (§12).

---

## 4. Identity model

### The stable downstream identity **[RESOLVED]**

```
sub = Account internal UUID (users.id), immutable
```

The OIDC `sub` claim is the immutable Account internal UUID. Every application
keys its local user records on this value.

**The public user ID must never be used as the permanent identity key.** It is
user-facing, lowercase-normalised, and must be assumed mutable — a user may
reasonably expect to change it, and an email address used as a user ID is even
more likely to change. Any application that keyed records on it would silently
corrupt its data the first time one changed.

> **This is a high-cost, effectively irreversible decision.** Once applications
> have stored `sub` against their local records, changing what `sub` means
> requires a coordinated migration across every application in the ecosystem,
> with no safe automatic mapping.

### Subject identifier type — public **[RESOLVED]**

**All first-party clients receive the same `sub` for a given user. Pairwise
subject identifiers are not used for first-party clients.**

**Cross-application identity correlation is intended, not tolerated.** It is a
design goal: Forge, VR, Nexus and Account are one ecosystem, and a user's
identity is deliberately the same identity everywhere. Pairwise identifiers
exist to *prevent* independent relying parties from colluding to track a user
across services — a protection that is meaningless when all relying parties are
operated by the same party and already share an identity authority.

Choosing pairwise here would have added real cost — per-client mapping tables,
no ability to reconcile a user across products, harder support and debugging —
to defeat a correlation that is the point of the system.

> **If a third-party or lower-trust client is ever contemplated, this decision
> must be revisited for that client specifically.** Pairwise identifiers remain
> the correct tool for that case. Introducing one would be a contract revision,
> not a configuration change.

---

## 5. Single sign-on, as experienced

One HarithKavish authentication across the ecosystem. The user signs in once.

Once an Auth SSO session exists, another registered first-party platform must
not ask for the password **or for a passkey** again. **[RESOLVED]** A live SSO
session satisfies authentication for every registered first-party client
without re-presenting *any* factor — the point of an SSO session is that the
authentication event already happened.

```
Forge  → Auth → login prompt → Forge session

VR     → Auth → existing SSO (no prompt) → VR session

Nexus  → Auth → existing SSO (no prompt) → Nexus session
```

**Account participates in this on the same terms.** Opening account settings
after signing in to Forge should not re-prompt; the SSO session already exists
and Account is a client like any other. **[RESOLVED]**

The user experiences a single ecosystem-wide login.

> **One SSO does not mean one shared cookie.** The SSO session belongs to
> `auth.harithkavish.com` alone. Each application — Account included — receives
> an authentication *result* and establishes its own independent session. §6.

---

## 6. Session model

There are exactly two session layers.

### Layer 1 — the Auth SSO session

- Lives on `auth.harithkavish.com`
- Cookie scoped to that host only: `HttpOnly`, `Secure`, `SameSite=Lax`
- Its sole purpose is to let Auth recognise a returning user and skip the
  credential prompt
- **No application ever receives or reads this cookie**

### Layer 2 — the application session

- Lives on the application's own host — `forge.harithkavish.com`,
  `vr.harithkavish.com`, `nexus.harithkavish.com`, **and
  `account.harithkavish.com`**
- Established by the application after it completes the authentication exchange
- Its lifetime, storage and semantics are the application's own concern

**Account's authenticated surfaces use a Layer 2 session like any other client.**
Account has no privileged session type, and its session confers no additional
identity authority. **[RESOLVED]**

### No shared parent-domain cookie

A cookie scoped to `.harithkavish.com` and shared by every application is
explicitly forbidden.

It is the obvious shortcut, and it is rejected deliberately:

- It couples every application to one credential. A cross-site scripting flaw
  in **any** subdomain becomes ecosystem-wide compromise.
- It cannot express per-application scope, audience or lifetime.
- It cannot serve non-browser clients (native, VR runtimes, CLI).
- It makes per-application logout meaningless.

The two-layer model costs a redirect. That is the entire price.

---

## 7. Authentication versus authorization

| | Owned by | Scope |
| --- | --- | --- |
| **Authentication** | Auth | Centralised. One implementation for the ecosystem. |
| **Authorization** | Each application | Application-specific. Roles, entitlements, feature access. |

Auth establishes *that* a person authenticated and *who* they are. It does not
decide what they may do inside Forge. Forge decides that, using `sub` as the
key.

**This separation holds for Account too.** Auth authenticates the user; Account
then decides that this user may edit *their own* profile and no one else's.
That authorization decision is Account's, made against `sub`. **[RESOLVED]**

### Consent **[RESOLVED]**

**Basic first-party identity does not require an interactive consent screen.**
Account, Forge, VR, Nexus and future first-party platforms are operated by the
same party; a prompt reading "Forge would like to know who you are" is friction
that communicates nothing and trains users to click through dialogs.

**However**: applications must not automatically receive arbitrary Account data.
The default claim set is fixed and minimal (§10). Any additional data requires
an explicitly defined scope, and introducing such a scope is a deliberate
decision — including whether *that* scope warrants a consent step.

Consent for a hypothetical third-party client is a separate question, tied to
the pairwise-subject question in §4, and is not settled by this decision.

---

## 8. Protocol

The ecosystem uses **standard OIDC / OAuth 2.0**, not a custom SSO protocol.
**[RESOLVED]**

A bespoke ticket or token scheme would have to independently rediscover
protections that the standard already specifies and that have been attacked in
the field for years. The cost of the standard is complexity; the cost of a
custom protocol is a class of vulnerabilities that are hard to find by testing.

### Flow

**Authorization Code + PKCE**, for every client.

- **PKCE is mandatory for every client, including confidential ones.** It binds
  the authorization code to the client instance that requested it. Confidential
  clients are not exempt: PKCE defends against code interception regardless of
  whether a client secret exists.
- **Redirect URIs must be pre-registered and matched exactly.** No wildcards, no
  prefix matching, no path-suffix matching. Loose matching is the standard route
  to an open redirect and to code exfiltration.
- **Authorization codes are short-lived and single-use.**

### Endpoint concepts **[none of these exist]**

Described conceptually. Exact paths, parameters and error semantics are for the
Auth project to specify and are **not fixed by this document**.

| Concept | Purpose |
| --- | --- |
| `/authorize` | Front-channel entry point. Authenticates the user (or reuses the SSO session) and returns an authorization code to a pre-registered redirect URI. |
| `/token` | Back-channel exchange. Trades an authorization code plus PKCE verifier for tokens; also handles refresh. |
| `/jwks` | Public signing keys, so clients can validate tokens without contacting Auth per request. |
| `/userinfo` | Claims for a valid access token. Optional — the ID token may carry the minimal set directly. |
| `/end-session` | RP-initiated logout. Terminates the SSO session (§15). |

A discovery document (`/.well-known/openid-configuration`) is expected so
clients configure themselves from the issuer rather than from hardcoded paths.

### Client registration

Clients are registered ahead of time — there is no dynamic registration.
Each registration records: client ID; client type (confidential or public);
exact redirect URIs; permitted scopes; post-logout redirect URIs; and, for
confidential clients, an authentication method.

**Account is one of these registered clients** (§2). How Account's client
credentials are provisioned and rotated is **[OPEN QUESTION]** (§21).

---

## 9. Tokens and signing

No keys have been generated. No tokens are issued.

### Signing **[RESOLVED]**

**Asymmetric signing with published JWKS. A shared symmetric secret between
applications is forbidden.**

With a symmetric secret, every application that can *verify* a token can also
*mint* one. A single compromised application would be able to forge identity for
the entire ecosystem. Asymmetric signing means applications hold only a public
key and can verify without being able to issue.

| Property | Requirement |
| --- | --- |
| Algorithm | Asymmetric — RS256 or EdDSA. `alg: none` and HMAC algorithms must be rejected outright. |
| Key distribution | JWKS endpoint, cached by clients |
| Key ID (`kid`) | Every token header carries a `kid`; every JWKS entry is addressable by it |
| Rotation | Overlapping validity — a new key is published and cached before it signs, the old key remains published until every token signed with it has expired |

### Standard claims

| Claim | Meaning |
| --- | --- |
| `iss` | `https://auth.harithkavish.com` — a single fixed issuer |
| `aud` | The client ID the token was issued for |
| `sub` | Immutable Account internal UUID (§4) |
| `exp`, `iat`, `nbf` | Validity window; clients allow only small clock skew |
| `nonce` | Echoed from the authorization request; binds the ID token to it |
| `auth_time` | When the user actually authenticated — distinct from token issuance |

### Lifetimes

V1 revocation strategy depends on these being short (§15), so they are
load-bearing. Two are now fixed; the remainder are **explicitly still open** and
must not be defaulted into existence by an implementation.

| Token | V1 value | Status | Rationale |
| --- | --- | --- | --- |
| **Authorization code** | **60 seconds**, **single-use** | **[RESOLVED]** | Exists only for the immediate back-channel exchange. Single-use is mandatory; re-presentation revokes the resulting grant (§17). |
| **Access token** | **5 minutes** | **[RESOLVED]** | This is the exact upper bound on how long a session survives a global logout in V1 (§15). It is a security parameter. |
| ID token | — | **[OPEN QUESTION]** | Consumed at login; proves an authentication event, not an ongoing session |
| Refresh token | **Bounded** — value open | **Partly [RESOLVED]** | **Rotation on every use, reuse detection, and a *bounded* lifetime are [RESOLVED]. An unbounded or indefinitely-renewable refresh token is forbidden.** The concrete bound is **[OPEN QUESTION]** (OQ3). |
| SSO session | — | **[OPEN QUESTION]** | Governs how often a password is re-requested |

> **No other token lifetime is defined by this contract.** An implementation
> must not invent one. Any value not listed as **[RESOLVED]** above is an open
> decision requiring a contract revision (§21, OQ3).

### Refresh token rotation and reuse detection **[RESOLVED as a requirement]**

- Every refresh issues a **new** refresh token and invalidates the one used.
- Refresh tokens form a **family** descending from one authorization grant.
- **Reuse of an already-rotated refresh token is treated as compromise: the
  entire family is revoked immediately.** A legitimate client never replays an
  old refresh token, so replay means either theft or a bug — both warrant
  ending the grant.

---

## 10. Claims

The default claim set for first-party identity is **minimal and fixed**.
**[RESOLVED]**

| Claim | Source in Account |
| --- | --- |
| `sub` | `users.id` |
| `name` | Composed from `first_name` + `last_name` |
| `given_name` | `users.first_name` |
| `family_name` | `users.last_name` |
| `preferred_username` | `users.user_id` |

**No other Account field is exposed.** In particular `password_hash` is never
transmitted in any form, and account lifecycle timestamps are not part of the
identity claim set.

`preferred_username` is provided for display only. It is explicitly **not** an
identity key — see §4. Applications must not store it as their user key.

Any future claim requires a defined scope and an explicit decision to add it.

---

## 11. Password ownership

**Account remains the sole system of record for password credential material.**
**[FACT]** — Account holds `password_hash` today and nothing else does.
**[RESOLVED]** — it stays that way.

**Auth performs the authentication ceremony.**

The division:

| | |
| --- | --- |
| Account | Owns the credential record — created at signup, changed in settings, destroyed on deletion. Owns the hashing algorithm and its parameters. |
| Auth | Owns the act of authenticating. Presents the login UI, collects the credential, decides whether an authentication succeeded. |

### The hash never leaves Account **[RESOLVED]**

**Auth never receives, stores, caches or derives the `password_hash`.** Not in
a response, not in a log, not in a migration, not in a backup.

This keeps the hashing parameters, any future parameter upgrade, and
rehash-on-verify logic in exactly one place. If Auth held copies, every password
change would become a distributed synchronisation problem with a window in which
the two systems disagree about the user's password.

### The plaintext credential moves in one direction only **[RESOLVED]**

Auth hosts the login UI, so the user's password necessarily arrives at Auth.
From there:

- **Auth may submit the plaintext password to Account** — only over the
  authenticated private service interface (§12), and only for the verification
  operation.
- **Account verifies it against its Argon2id hash and returns a verdict.**
- **The plaintext exists only for the duration of that operation.** On both
  sides it must not be logged, must not be persisted, must not be written to
  the audit trail, and must not be returned in any response.

The *event* of a verification attempt — who, when, and the outcome — is
security-relevant and may be audited. **The submitted credential value must
never appear in any record, on either side.**

### Accepted consequence

This places Account on the critical path for **new** password authentications.
If Account is unavailable, new password logins fail. This is a deliberate trade:
one source of truth for credentials, in exchange for an availability dependency
that is bounded and understood (§16).

---

## 12. Private Account → Auth interface

> **None of this exists.** No endpoint, no route, no handler, no schema. This
> section defines *capabilities* the interface must eventually provide, so that
> Auth can be designed against a known shape. Exact paths, payloads, transport
> and authentication method are **not fixed here** and require their own design
> pass.

### Properties the interface must have

- **Private.** Not reachable from the public internet, not part of Account's
  user-facing surface.
- **Strongly mutually authenticated.** Account must know the caller is Auth;
  Auth must know it is talking to the real Account. **[RESOLVED]** that the
  mechanism must be a strong authenticated one — a bearer secret in a header
  alone is not sufficient. **[OPEN QUESTION]** whether that is mTLS, signed
  service assertions, or another equivalently strong mechanism (§21).
- **Rate limited independently** of the public site.
- **Audited** — the fact, actor, time and outcome of a verification attempt are
  recorded. **The submitted credential value is never recorded** (§11).
- **Minimal.** It returns verdicts and the minimum data required, never
  credential material.

### Capabilities

| Capability | Purpose | Must never return |
| --- | --- | --- |
| **Credential verification** | Auth submits a presented user ID and plaintext password; Account verifies against its Argon2id hash and returns a verdict plus the account UUID and status. | The hash, or any part of it; the submitted password |
| **Identity / profile lookup** | Given an account UUID, return the minimal claim set of §10 for token issuance. | Any field outside §10 |
| **Account status** | Report lifecycle state so Auth can apply the §14 authentication matrix. | — |
| **Passkey credential operations** | Retrieve stored passkey public keys and metadata for an account so Auth can verify an assertion; record signature-counter updates. Depends on a table that does not exist (§13). | Private key material — which Account never possesses by design |
| **Lifecycle / revocation information** | Inform Auth when a password changes, an account enters deletion, or an account is deleted, so Auth can revoke sessions and token families. | — |

### Status enforcement on refresh

The **policy** is settled by §14: a `deleted` account must not obtain fresh
access tokens from a refresh token issued while it was active.

The **mechanism** is **[OPEN QUESTION]** — whether Auth re-checks status with
Account on each refresh (fresher, more coupled, Account on the refresh path) or
relies on revocation events pushed from Account (looser, faster, but eventually
consistent). §21.

---

## 13. Passkeys and the RP ID

**Account owns passkey credential records.** No `passkeys` table exists today,
and **none is to be created yet** (§22).

**Auth hosts the WebAuthn ceremony and is the Relying Party.** **[RESOLVED]**

### RP ID = `auth.harithkavish.com` **[RESOLVED]**

```
RP ID:  auth.harithkavish.com
```

**Not** the parent domain. This is deliberate and is the tighter of the two
options that were considered.

### Why the RP ID is intentionally limited to `auth.harithkavish.com`

In WebAuthn, every credential is permanently bound to the RP ID it was created
under, and is usable only from an origin for which that RP ID is the host or a
registrable domain suffix. The RP ID therefore *is* the credential's trust
boundary.

**Binding to `auth.harithkavish.com` binds each passkey to exactly one origin —
the one whose only job is authentication.**

The alternative, a parent-domain RP ID of `harithkavish.com`, would have made
every passkey usable from *every* origin under `harithkavish.com`:

- every subdomain that exists today, and **every subdomain created in future**
- including any that serves user-supplied, third-party or experimental content
- including any that is compromised, misconfigured, or stood up quickly for an
  unrelated purpose

That would place the ecosystem's strongest authentication factor inside a trust
boundary that grows every time a subdomain is added, and that can be widened by
accident. A single compromised marketing or preview subdomain would sit inside
the passkey boundary.

**Limiting the RP ID to the authentication host means a compromise anywhere else
in the ecosystem cannot invoke a passkey.** The blast radius of any non-Auth
subdomain excludes the authentication factor entirely. That is the property
worth paying for.

### What this costs, and why the cost is acceptable

The cost is that **Account cannot run passkey registration ceremonies** — its
origin is not `auth.harithkavish.com`, so it cannot create or use credentials
under that RP ID.

That cost is largely neutralised by the decision in §2. Because **Account is
itself a first-party OIDC client of Auth**, a user managing their security
settings in Account is already authenticated through Auth. Account therefore
**links to Auth-hosted passkey registration and management** rather than
embedding a ceremony it is not permitted to run. The user is redirected to a
surface they have already authenticated against, and returns.

| | |
| --- | --- |
| Account's role | Owns the credential **records**; presents management UI; **links out** to Auth for registration and removal ceremonies |
| Auth's role | Hosts the ceremony as the Relying Party; performs registration and assertion |

This preserves the ownership split — Account owns the data, Auth owns the
ceremony — at the cost of a redirect the user is already accustomed to.

> **Reversibility:** neither RP ID choice is reversible. Changing the RP ID in
> either direction invalidates every passkey and requires every user to
> re-register every device. This decision must be treated as permanent (§20).

### Not yet

**No passkey schema is to be created.** The table, its columns, the credential
metadata to store, and the exact link/return flow between Account and Auth are
all still to be designed. §22.

---

## 14. Account status semantics

**V1 authentication matrix. [RESOLVED]**

| `account_status` | Authentication | Rationale |
| --- | --- | --- |
| `active` | **Allowed** | Normal operation |
| `deletion_requested` | **Allowed** | The user must be able to sign in **to cancel their own deletion**. Refusing would trap them in a state they cannot exit. |
| `deleted` | **Refused** | The identity no longer exists |

### Unknown status values fail closed **[RESOLVED]**

**If Auth receives a status value it does not recognise, authentication must be
refused.**

This is a forward-compatibility rule, and it matters because the two platforms
deploy independently. If a future revision adds a status — suspension being the
obvious candidate (see below) — Account may begin returning it before Auth has
been updated to understand it. The default must not be permissive.

| Auth receives | Behaviour |
| --- | --- |
| `active` | Allow |
| `deletion_requested` | Allow |
| `deleted` | Refuse |
| **Anything else** | **Refuse, and treat as a security-relevant anomaly** |

An unrecognised status must be refused *and* surfaced — logged and alerted, not
silently denied — because it means the two platforms disagree about the state
machine. Failing open here would mean a newly-added restrictive status has no
effect until every client is updated, which is precisely backwards: the
restriction would be absent exactly when it was newly considered necessary.

> **This corrects an inconsistency in revision 1**, which stated in two places
> that any non-`active` status refuses authentication. That would have made a
> pending deletion irreversible from the user's side — they could request
> deletion, then be locked out of the only surface that could cancel it. The
> `account_deletion_cancelled` event type already in the schema **[FACT]**
> anticipates a cancellation path that revision 1's rule would have made
> unreachable.

### `suspended` is not a V1 status **[RESOLVED]**

**`account_status` has exactly three values today — `active`,
`deletion_requested`, `deleted` — and no `suspended` value is to be added.**

Revision 1 referred to a "suspended" state that has never existed in the schema.
That reference is removed. **This is a documentation correction; no schema
change is required or permitted** (§22).

Suspension is a real capability the ecosystem may want later — it implies an
administrative actor, a reason, an appeal path and a restoration path, none of
which are designed. **Adding it requires a later contract revision**, at which
point both its schema representation and its effect on authentication and
refresh must be specified together.

### Effect on tokens

The same matrix governs refresh: a `deleted` account must not exchange a refresh
token for a new access token. A `deletion_requested` account may, since it may
still authenticate. The *mechanism* by which Auth learns of a status change
remains **[OPEN QUESTION]** (§12, §21).

---

## 15. Logout and revocation

Both logout types are required. **[RESOLVED]**

### Application logout — local

- Destroys **only** that application's session
- Does **not** destroy the Auth SSO session
- The user remains signed in to the ecosystem; returning to that application may
  sign them straight back in from the SSO session, which is correct and expected

### Global logout — terminates the SSO session

- **Destroys the Auth SSO session**
- Initiated from an application by redirecting to Auth's end-session concept,
  with a pre-registered post-logout redirect URI
- After it, no further authentication may be satisfied from SSO — the next
  authorization request must re-prompt for credentials

### V1 invalidation strategy — expiry **[RESOLVED]**

**V1 global logout propagation may rely on short-lived access tokens together
with refresh-token revocation and expiry.**

| | |
| --- | --- |
| **Required in V1** | A global logout **must prevent the issuance of any new application token through the revoked session or grant.** No refresh token descending from it may be exchanged; no new authorization may be satisfied from the terminated SSO session. |
| Accepted in V1 | Access tokens already issued remain valid until they expire — **at most 5 minutes** (§9). |
| Not required in V1 | Immediate termination of every established application session |

The distinction matters: V1 does not promise to *reach into* running
application sessions, but it does promise that **nothing new can be minted**
from a revoked session or grant. The blast radius of a logout is therefore
bounded by one access-token lifetime and nothing longer.

**Application sessions remain independent of the Auth SSO session** (§6).
Terminating the SSO session does not itself destroy an application session; it
removes that session's ability to renew.

With the access-token lifetime fixed at **5 minutes** (§9), the maximum window
in which a globally logged-out user retains any application access is five
minutes.

### Back-channel logout — future hardening **[PROPOSED, deferred]**

Direct notification from Auth to each client, terminating sessions immediately
rather than waiting for expiry, is **a future hardening capability and is
explicitly out of scope for V1.** It requires every client to implement and
secure a logout receiver.

Clients should be designed so that adding it later is not a breaking change.

### Revocation triggers from Account

| Event | Expected effect |
| --- | --- |
| Password changed | Revoke token families established with the old credential |
| Deletion requested | **No authentication change** — the user may still sign in to cancel (§14) |
| Account deleted | Revoke everything; refuse further authentication and refresh |

The corresponding `account_event_type` values already exist in Account's schema
**[FACT]**. **No mechanism delivers them to Auth** — see §12.

---

## 16. Failure model

Required behaviour once both systems exist.

### If Account is temporarily unavailable

| | |
| --- | --- |
| Existing application sessions | **Continue.** They do not depend on Account. |
| Token validation | **Continues** — clients validate signatures against cached JWKS without contacting Account or Auth. |
| New password authentication | **May fail** (§11) — Account verifies credentials. |
| Applications | **Must not fall back to local password authentication.** |

### If Auth is temporarily unavailable

| | |
| --- | --- |
| Existing application sessions | **Continue**, according to their own session and token policy. |
| New authentication | **Cannot occur.** |
| Applications | **Must not create an alternative login mechanism.** |
| **Account's authenticated surfaces** | **Unavailable** — settings, security and deletion require Auth like any other client (§2). |
| **Account creation** | **Continues to work** — signup is unauthenticated by design (§2). |

That last pair is a deliberate and useful property: **even with Auth entirely
down, the ecosystem can still take on a new user.** The account exists and
waits; the moment Auth returns, that user can sign in. Bootstrap never depends
on the component most likely to be mid-deployment.

### The rule that matters **[RESOLVED]**

A fallback login path, added under outage pressure, would permanently recreate
exactly what this architecture exists to prevent: an application implementing
its own password authentication. **The correct degraded behaviour is a clear
error and a signed-out or reduced-capability state — never a second way in.**

The rule binds all three parties, and the third is the one most easily
overlooked:

| Party | Prohibition |
| --- | --- |
| **Applications** | Must not implement local password authentication when Auth is unavailable. |
| **Account** | Must not add a local login when Auth is unavailable — **least room for exception of all**, since it holds the hashes and could do so trivially. |
| **Auth** | **Must not fall back to any local authentication when Account is unavailable.** |

**The prohibition on Auth is the subtle one.** Auth cannot verify a password
without Account (§11), and the tempting mitigation — caching verified
credentials, or holding a local copy of hashes to survive an Account outage —
would break the invariant that the hash never leaves Account, and would create
exactly the second credential store this architecture exists to prevent. **Auth
must have no local credential store of any kind, and no ability to authenticate
a password without Account.** When Account is unavailable, password
authentication simply fails.

The same applies to passkeys: if Account cannot supply the credential record,
passkey authentication fails. It must not silently downgrade to a password
prompt, which would be an unannounced reduction in authentication strength.

Operator recovery (§2) is a separate, out-of-band capability and is not a
counter-example to this rule.

Mitigations are a matter of tuning session and token lifetimes, and of caching
JWKS so that validation survives an Auth outage. They are not a licence for a
fallback.

---

## 17. Security requirements

Required properties of the eventual implementation.

| Threat | Required protection |
| --- | --- |
| **CSRF** | A `state` parameter, cryptographically random, bound to the application's pre-authorization session and verified on return. Session cookies `SameSite`-constrained. |
| **Authorization-code replay** | Codes single-use and short-lived; bound to `client_id`, `redirect_uri` and the PKCE challenge. **Re-presentation of a used code revokes the resulting grant.** |
| **Forged callbacks** | `state` verification; exact redirect-URI matching; issuer identification on the response so a callback cannot be attributed to the wrong issuer. |
| **Redirect URI attacks** | Exact-match registered URIs only. No wildcards, no prefix or suffix matching, no user-supplied redirect targets. HTTPS only. |
| **Token forgery** | Asymmetric signatures verified against JWKS. `alg: none` and HMAC rejected. `iss`, `aud`, `exp` and signature all validated — never decoded without verification. |
| **Token replay** | Short access-token lifetimes; `nonce` binding ID tokens to their authorization request; TLS throughout. Sender-constrained tokens (e.g. DPoP) remain available as a future hardening step. |
| **Refresh-token reuse** | Rotation on every use, with reuse detection revoking the whole family (§9). |
| **Session fixation** | Session identifiers regenerated upon authentication, in both the Auth SSO session and each application session. |
| **Cross-client token usage** | Every application validates that `aud` names **itself** and rejects tokens issued for another client. A token minted for Forge must be useless at Nexus — **and useless at Account**. |
| **Credential exposure in transit** | The plaintext password crosses exactly one internal boundary (Auth → Account) over the authenticated private interface, and is never logged, persisted, audited or returned (§11). |

Two further standing requirements:

- **Transport.** HTTPS everywhere, HSTS. Account already sets HSTS **[FACT]**.
- **Logging.** No credential material, token, code or `state` value in logs, on
  either side.

---

## 18. Hosting

**[OPEN QUESTION] — no provider is prescribed.**

Auth may have materially different hosting requirements from Account, and should
not be assumed to fit the same model simply because it is part of the same
ecosystem.

Account is a request-scoped web application backed by managed Postgres and
Redis, and fits a serverless platform well **[FACT]** — it runs on Vercel today.

An authorization server has different characteristics:

- **Persistent, security-critical state** — authorization codes, refresh-token
  families and their reuse history, SSO sessions, client registrations
- **Signing key custody** — private keys that must be held securely, rotated on
  a schedule, and never leave their boundary
- **Correctness under concurrency** — single-use codes and refresh rotation with
  reuse detection require strict guarantees, not best-effort ones
- **Stable issuer identity** — one fixed issuer URL, indefinitely

Whether these are best served by the same platform as Account, a container
host, or a purpose-built identity server used as a component, is an open
decision. **It should be settled before Auth implementation begins**, because it
constrains the choice of libraries and the shape of the deployment.

---

## 19. Resolved decisions

Settled in joint Account/Auth review. **None of these are implemented** — they
are architecturally closed, not built.

| # | Decision | Section |
| --- | --- | --- |
| **R1** | `sub` = **immutable Account UUID**. Never the user ID. | §4 |
| **R2** | **Public** subject identifier for all first-party clients. Pairwise not used. | §4 |
| **R3** | **Cross-application identity correlation is intended**, not merely tolerated. | §4 |
| **R4** | **Account is itself a first-party OIDC client of Auth.** Its settings, profile and security surfaces authenticate through Auth. | §2 |
| **R5** | **Account must never implement an independent user login system.** | §2, §16 |
| **R6** | **Account creation remains unauthenticated**, so the ecosystem can bootstrap. | §2, §16 |
| **R7** | **Operator break-glass is not a user authentication fallback.** Out-of-band, never a user-facing route. | §2 |
| **R8** | **RP ID = `auth.harithkavish.com`.** Not the parent domain. | §13 |
| **R9** | **Auth hosts the WebAuthn ceremony** and is the Relying Party. | §13 |
| **R10** | **Account owns passkey credential records**; links out to Auth for registration and management. | §13 |
| **R11** | **Status V1:** `active` → allowed; `deletion_requested` → **allowed** (so deletion can be cancelled); `deleted` → refused. | §14 |
| **R12** | **`suspended` is not a V1 status** and is not to be added to the schema. Future revision required. | §14 |
| **R13** | **Application logout is local**; **global logout terminates the SSO session.** Both required. | §15 |
| **R14** | **V1 invalidation may rely on short lifetimes and expiry.** Refresh must be refused after global logout. | §15 |
| **R15** | **Back-channel logout is future hardening**, explicitly out of scope for V1. | §15 |
| **R16** | **Account is the sole owner of password hashes**; Auth never receives or stores `password_hash`. | §11 |
| **R17** | **Auth may submit a plaintext password to Account** via the authenticated private interface, **for verification only** — never logged, persisted, audited or returned. | §11, §12 |
| **R18** | **Service-to-service authentication must be a strong authenticated mechanism.** (Which one is still open — OQ4.) | §12 |
| **R19** | **Account, Forge, VR, Nexus and future platforms are first-party Auth clients.** | §2 |
| **R20** | **Basic identity requires no interactive consent screen** for first-party clients. | §7 |
| **R21** | **Application-specific authorization remains separate** from authentication. | §7 |
| **R22** | **Standard OIDC/OAuth**, Authorization Code + PKCE, PKCE mandatory for all clients. | §8 |
| **R23** | **Asymmetric signing with JWKS.** No shared symmetric secret. | §9 |
| **R24** | **Two session layers; no shared parent-domain cookie.** | §6 |
| **R25** | **Minimal fixed claim set**: `sub`, `name`, `given_name`, `family_name`, `preferred_username`. | §10 |
| **R26** | **Access token lifetime = 5 minutes.** | §9 |
| **R27** | **Authorization code lifetime = 60 seconds**, and **single-use**. | §9 |
| **R28** | **Refresh tokens rotate on every use**; **reuse revokes the entire family**. | §9 |
| **R29** | **Global logout must prevent issuance of new application tokens** through the revoked session or grant. | §15 |
| **R30** | **Application sessions remain independent** of the Auth SSO session. | §6, §15 |
| **R31** | **No token lifetime other than R26 and R27 is defined.** ID token, refresh token and SSO session lifetimes remain open (OQ3). | §9 |
| **R32** | **Auth is the sole authentication authority** for the entire first-party ecosystem. No second authenticator, no per-application exception. | §2 |
| **R33** | **A live SSO session requires no factor to be re-presented** — neither password nor passkey — for any registered first-party client. | §5 |
| **R34** | **Exact redirect-URI matching is mandatory.** No wildcard, prefix or suffix matching. | §8 |
| **R35** | **Refresh tokens must have a bounded lifetime.** Unbounded or indefinitely-renewable refresh tokens are forbidden. *The concrete bound remains OQ3.* | §9 |
| **R36** | **Unknown or unrecognised account status values fail closed** — authentication refused, and treated as a security-relevant anomaly. | §14 |
| **R37** | **Auth must never fall back to local authentication.** Auth holds no local credential store and cannot authenticate a password without Account. Passkey failure must not downgrade to a password prompt. | §16 |
| **R38** | **Account's OIDC client credential and its private service credential are independent and independently rotatable.** Neither is accepted where the other is expected; compromise or rotation of one must not affect the other. | §2 |

---

## 20. Irreversible decisions

Decisions that are expensive or impossible to reverse once real users and real
applications exist.

| # | Decision | Status | Cost of changing later |
| --- | --- | --- | --- |
| 1 | **`sub` = immutable Account UUID** | **[RESOLVED]** R1 | Coordinated migration across every application, with no safe automatic mapping |
| 2 | **WebAuthn RP ID = `auth.harithkavish.com`** | **[RESOLVED]** R8 | Every passkey invalidated; every user re-registers every device. **Irreversible in both directions.** |
| 3 | **Public subject identifier** | **[RESOLVED]** R2 | Changing to pairwise changes every `sub` every client has stored |
| 4 | **Asymmetric signing with JWKS** | **[RESOLVED]** R23 | Migrating from a shared secret means reissuing all tokens and re-trusting every client |
| 5 | **Two-layer sessions, no parent-domain cookie** | **[RESOLVED]** R24 | Retrofitting session isolation after applications depend on a shared cookie |
| 6 | **Account owns credentials; Auth reads via private interface** | **[RESOLVED]** R16 | Moving hashes later means a migration with a window of divergent truth |
| 7 | **Standard OIDC rather than a custom protocol** | **[RESOLVED]** R22 | Replacing a bespoke protocol after clients depend on it |
| 8 | **Account is a client of Auth, not its own authenticator** | **[RESOLVED]** R4, R5 | Unwinding a second authentication authority after users depend on it |

---

## 21. Open questions

Everything still requiring an explicit decision before implementation.
**These are not resolved and must not be treated as settled.**

### The pre-implementation gate

Seven concrete areas must be closed before implementation begins. Each maps to
the open questions below; none may be resolved by an implementation choosing a
default.

| # | Area | Open questions |
| --- | --- | --- |
| **G1** | **Refresh, ID and SSO lifetimes** — including the concrete bound required by R35 | OQ3 |
| **G2** | **Private service authentication mechanism** | OQ1 |
| **G3** | **Account client registration and rotation** — and its independence from the service credential (R38) | OQ7 |
| **G4** | **Passkey schema and ceremony-write consistency** | OQ8 |
| **G5** | **Signature-counter policy** | OQ9 |
| **G6** | **Operator break-glass mechanism** | OQ6 |
| **G7** | **The exact Account ↔ Auth private API contract** | OQ5, and the private-interface design document in full |

**G2 is the critical path.** It is blocked on a platform feasibility check —
whether Account's host can expose and verify a client certificate at all — and
its answer constrains transport, request binding and replay protection for
every operation in G7.

| # | Question | Blocks | Section |
| --- | --- | --- | --- |
| **OQ1** | **Account → Auth service authentication mechanism** — mTLS, signed service assertions, or another equivalently strong mechanism? *Resolved that it must be strong (R18); not resolved which.* | Private interface | §12 |
| **OQ2** | **Status enforcement on refresh** — does Auth re-check status with Account per refresh, or rely on revocation events pushed from Account? *Policy is settled (R11); mechanism is not.* | Refresh design | §12, §14 |
| **OQ3** | **Remaining lifetimes** — **ID token**, **refresh token**, and **SSO session**. *Access token (5 min) and authorization code (60 s) are settled (R26, R27); these three are not, and must not be defaulted.* The refresh-token lifetime is the more consequential of the three: with V1 relying on expiry (R14), it bounds how long a grant persists. | Token issuance; V1 security posture | §9, §15 |
| **OQ4** | **Auth hosting model** — same platform as Account, container host, or a purpose-built identity server as a component? | Library and deployment choice | §18 |
| **OQ5** | **Private interface shape** — paths, payloads, transport, versioning, error semantics. | Both projects | §12 |
| **OQ6** | **Operator break-glass mechanism** — what it is, how it is secured, and how it is structurally prevented from becoming a user-facing login path. *The distinction is settled (R7); the mechanism is undefined.* | Operational readiness | §2 |
| **OQ7** | **Account's own client registration and rotation** — how Account's OIDC client credential is provisioned, stored and rotated, given Account is a client of a system it also underpins. **R38 additionally requires that this credential be rotatable without touching the private service credential**, so the two rotation procedures must be designed together to confirm they are genuinely independent. | Account-as-client work | §2, §8 |
| **OQ8** | **Passkey record schema and the Account ↔ Auth management flow** — what Account stores per credential, and the shape of the link/return flow to Auth-hosted registration. *RP ID and ownership are settled (R8–R10); the schema and flow are not.* | Any passkey work | §13 |
| **OQ9** | **Passkey signature-counter policy** — whether counters are enforced, and what a regression means. | Passkey verification | §12, §13 |

---

## 22. Implementation boundary

**This document does not authorize implementation of Auth.**

It records an agreed architecture and the decisions still outstanding. It is a
contract to design against, not a work order. **Resolving a decision does not
authorize building it.**

### Explicitly not authorized by this document

- Implementing the Auth platform
- Implementing OIDC — any endpoint, flow, or discovery document
- Implementing passkeys, or creating any passkey schema
- Adding authentication endpoints to Account
- **Making Account an OIDC client** — the decision is settled (R4), the work is
  not authorized
- Adding the private Account → Auth interface
- Generating signing keys, or issuing any token
- Registering OIDC clients, including Account's own
- **Modifying Account's database schema** — including adding a `suspended`
  status (R12) or a `passkeys` table
- Changing Account's deployment or infrastructure

The one exception, deliberately narrow: a schema change is permitted **only**
where required to correct a contradiction between this contract and the
existing schema. **No such change is required by this revision** — the §14
correction was to the document, not the database. `account_status` already
holds exactly the three values V1 requires.

### Account's current state is unchanged

Account remains what §3 describes: an account-lifecycle platform with real
account creation, no login, no sessions, and no communication with
`auth.harithkavish.com`. **This document changes nothing about the running
system.**

### Before implementation may begin

1. **All seven gate items G1–G7 (§21) are closed**, with G2 first — it is on the
   critical path and blocked on a platform feasibility check.
2. The private interface is specified in detail — see
   [`account-auth-private-interface.md`](./account-auth-private-interface.md),
   whose own open questions P1–P11 form part of gate G7.
3. The Auth hosting model (§18, OQ4) is decided.
4. This revision is reviewed and accepted by both projects.

**No implementation is authorized by closing these questions.** Answering them
unblocks a decision to build; it is not itself that decision (§22).

Until then, the correct state of the Auth integration is exactly what Account
displays today: **pending**.
