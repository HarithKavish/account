# Account ↔ Auth — Canonical Integration Contract

The single reconciled contract for `account.harithkavish.com` and
`auth.harithkavish.com`. Both projects implement against this document.

| | |
| --- | --- |
| **Version** | Canonical v1.5 — one deployable, boundary retained |
| **Supersedes** | Account: `account-auth-contract.md` (Rev 3), `account-auth-private-interface.md` (Rev 1) |
| **Reconciles** | Auth: `auth-implementation-contract.md`, `account-integration-review.md` (Rev 2) |
| **Implementation status** | **None.** No code, endpoint, schema, key, migration or deployment resulted from this document. |
| **Amends** | v1.2 adds §0.4, V23–V28, §5.10, §6.3, §7.6, X32–X37 — federated sign-in. v1.4 resolves X32 (§6.4) and extends §5.2. v1.5 collapses Account and Auth into one deployable (§0.5, §15), retaining every ownership boundary. |

Auth should be able to build without inventing Account behaviour; Account should
be able to build without inventing Auth behaviour.

## Markers

| Marker | Meaning |
| --- | --- |
| **[FACT]** | True of a deployed system today, verified against the running system. |
| **[RESOLVED]** | Settled. Binding on both projects. Not built. |
| **[OPEN]** | Genuinely undecided. **Must not be resolved by implementation default.** |

---

## 0. Reconciliation record

### 0.1 The blocker that is not technical

> **[FACT] Auth could not read Account's private-interface specification.** Auth's
> contract §25 records: *"exists but is uncommitted and unreachable from this
> repository — confirmed by checking `account` main, which has no `docs/`."*
> This is the origin of Auth's largest blocker, **U6**, which gates its
> critical-path Phase 3.
>
> **The cause is that Account's `docs/` directory has never been committed.** No
> design decision fixes it. Until those documents are on `main`, Auth is
> specifying against a summary. Committing is currently withheld, so **U6 remains
> open for a reason unrelated to its content.**

### 0.2 Disagreements identified and dispositioned

| # | Subject | Account said | Auth said | Disposition |
| --- | --- | --- | --- | --- |
| X1 | Lifetime guard scope | §9: "no other token lifetime is defined; must not invent one" | U21: the guard also catches WebAuthn challenge TTL, authorization-request and replay windows, which are not tokens — blocks WebAuthn | **RESOLVED** — guard applies to credentials issued to clients only. Carve-out in §2.2. Determined by the guard's own purpose. |
| X2 | Access token lifetime | 5 minutes **[RESOLVED]** | Implementation contract: 5 min `[SETTLED]`. **Review §6.3 says 10 min** | **RESOLVED — 5 minutes.** The review is stale; its own implementation contract already corrected it. |
| X3 | Status delivery | Separate operation, marked open (P8) | U9/PI-3: prefers folded onto verification and lookup | **RESOLVED — folded.** Account's verification already returned status; folding onto lookup removes a round trip on every refresh. No separate status operation exists. |
| X4 | Revocation mechanism | Push or pull, open (P10/OQ2) | AR-29/§14.3: pull-based `credentials_changed_at` | **RESOLVED — pull.** §4. Removes the entire Account→Auth channel from V1. |
| X5 | Account→Auth channel | Operation 8 (lifecycle push), authenticated inbound at Auth | §5.8 inbound replay cache "only if U5 resolves to push" | **RESOLVED — not in V1.** Consequence of X4. |
| X6 | `credentials_changed_at` storage | Not in schema | Required field | **RESOLVED — derived from `account_events`,** not a new column. §4.2. Avoids a forbidden schema change. |
| X7 | User ID normalization | Account lowercases **[FACT]** | AR-33: Auth sends verbatim, Account normalizes | **RESOLVED — Account normalizes.** It owns the uniqueness index. Auth trims surrounding whitespace only. |
| X8 | `deleted` in verification response | Status returned on success | PI-1: is `deleted` distinguishable? Tension with anti-enumeration | **RESOLVED — uniform failure.** §5.2. Determined by I3 + status semantics together. |
| X9 | Which scope yields the claim set | Fixed minimal set, no scope named | U10/AR-36 open | **RESOLVED — `openid` yields `sub`; `openid profile` yields the full set.** Determined by OIDC conformance (R22). |
| X10 | Status as a client claim | Not in the §10 claim set | U20/AR-31 open | **RESOLVED — no.** The claim set is fixed; adding one requires a defined scope and a deliberate decision. |
| X11 | `preferred_username` may be an email | Claim set fixed | AR-37: disclosed to every client without an `email` scope | **RESOLVED — accepted for first-party.** Reopens with any lower-trust client, on the same trigger as pairwise subjects. |
| X12 | Service auth mechanism | Open (P1), strength required | U4/PI-7 open, bearer rejected | **RESOLVED — asymmetric signed service assertions.** §3. No contradiction found. |
| X13 | Counter regression | Open (P9) | U8/PI-5, with the both-zero distinction | **RESOLVED** — §7.3. |
| X14 | Failed counter update | Open | PI-17: does sign-in still succeed? | **RESOLVED — sign-in succeeds**; update retried durably. §7.4. |
| X15 | Attestation | Not addressed | Proposes `none` | **RESOLVED — `none`.** §7.1. |
| X16 | Interface audit location | Open (P4) | AR-34: `account_events` stays lifecycle-only | **RESOLVED — structured logs for V1.** A dedicated table needs a schema change. §9.4. |
| X17 | Account's client auth method | Not specified | §5.1 `auth_method`, confidential | **RESOLVED — `private_key_jwt`.** §3.3. Consistent with no-shared-secret. |
| X18 | Refresh lifetime vs rotation | Bounded (R35), value open | U1 open | **RESOLVED — 30 days absolute, and rotation does not extend it.** Without that, "bounded" is false in practice. §2.1. |
| X19 | Cached claims at refresh during an Account outage | §16: "existing sessions continue" | PI-17/U6: refuse, or serve cached | **RESOLVED — bounded grace, 15 minutes, security state only.** §11. |
| X20 | Account recovery | Not addressed | U19/AR-28 named as a dependency | **RESOLVED — recovery codes, producing a restricted recovery session.** §7.5. |

### 0.3 What Auth must re-check

Auth's contract cites **Account Revision 2**. Revision 3 added R32–R38, of which
three change Auth's requirements: **R36** (unknown status fails closed — Auth
already has this as §8.3), **R37** (Auth itself may not fall back — Auth already
has this as §1.3), and **R38** (Account's two credentials independent — reflected
in Auth §6, extended here in §3.3).

---

### 0.4 Amendment record — federated sign-in (v1.3)

**[FACT] v1.2 does not mention federated sign-in anywhere.** No occurrence of
Google, federation, social login, or an upstream identity provider. It is
specified end to end around a chosen `user_id`, a password, and passkeys.

That is not an oversight to be patched by whichever project builds first. Four
surfaces are already signing people in with Google today — Forge with its own
OAuth client and its own `users`, `accounts` and `sessions` tables, and the
static sites with a browser-side client — none of which this contract governs.
Every day that continues, the ecosystem accumulates a second identity origin.

This amendment states where federated sign-in belongs, so those surfaces have
something to converge on. It authorizes nothing (§13).

**Two invariants had to be examined rather than assumed.**

| Invariant | Tension | Disposition |
| --- | --- | --- |
| **V21** — no second authentication mechanism or fallback path | A provider is a new way to authenticate | **V21 stands, and federation is inside it.** V21 forbids a path *around* Auth, not a mechanism *within* it. Google is a mechanism Auth operates, exactly as V9 gives Auth the WebAuthn ceremony. A surface talking to Google itself is precisely what V21 forbids — see V23. |
| **V22** — Account signup remains unauthenticated, the bootstrap path | First federated sign-in must create an account, and it arrives over the authenticated private interface | **Architecture change, recorded.** V22 governs the public path and is unchanged. Federated creation is a second creation path with a different trust basis, stated as V25 rather than folded into V22 silently. |

---

### 0.5 Amendment record — one deployable (v1.5)

**The boundary was right. The network between the two halves was not.**

Everything this contract says about *who owns what* is retained without
exception. What changes is that Account and Auth are **one deployable at one
origin**, and the private interface of §5 is a module boundary inside it rather
than HTTP between two services.

**Why now, and why it is not a compromise.**

This document is unusually complete and authorizes nothing. Meanwhile four
surfaces sign people in with Google outside it — Forge with its own `users`,
`accounts` and `sessions` tables, and three static sites with a browser-side
client. The risk to this architecture was never that it is wrong. It is that it
never ships, and the deviation becomes the system.

A large part of the specified work exists **only because there are two
processes**: signed service assertions and their key custody (§3), the outage
grace window (§11), the replay cache (X22), the network topology (X21), and much
of the timeout budget (X26). None of that protects a user. It protects a network
hop that a single-operator ecosystem does not need to have.

**V11 is why this had to be decided now.** It records the WebAuthn RP ID as
`auth.harithkavish.com` and calls it *irreversible* — correctly, because a
passkey is bound to the RP ID that registered it. **[FACT] No passkey exists:
no table, no WebAuthn code, no registration.** So the choice was still free, and
this was the last point at which it would be. It is exercised deliberately
rather than allowed to lapse.

**The origin is `account.harithkavish.com`.** It already serves the real
application **[FACT]** — the README's claim that DNS has not been cut over is
stale. `auth.harithkavish.com` is retained as an alias so nothing that already
points at it breaks, and so the split remains available.

**Splitting later is a refactor; un-splitting a live authorization server is
not.** The boundary is kept in the code precisely so that a future third-party
client, or a decision to operate a standalone AS, is a promotion of a module
edge to a network edge — not a rewrite of who owns identity.

---

## 1. Invariants

Binding, not reopened. Any change here is an architecture change.

| # | Invariant |
| --- | --- |
| V1 | The **identity service** is the sole authentication authority for the first-party ecosystem. Account and Auth are its two halves, in one deployable (§0.5). |
| V2 | A valid SSO session admits the user to every registered first-party platform **without re-presenting a password or passkey**. |
| V3 | Each application maintains its **own** application session. |
| V4 | **No shared `.harithkavish.com` authentication cookie.** Enforced by the `__Host-` prefix. |
| V5 | ~~Account is itself an OIDC client of Auth.~~ **Superseded by §0.5.** One deployable is not a client of itself. The account dashboard and the authorization server share a session directly; the ownership boundary of V6–V10 is unchanged. |
| V6 | Account owns identity records and password hashes. |
| V7 | **The authentication half never receives or stores `password_hash`**, in any form or derivative. A module boundary, not a network one — it reads no credential column. |
| V8 | The authentication half may submit a plaintext password to the account half **only** through the §5 interface, for verification; never logged, persisted or returned. |
| V9 | Auth performs WebAuthn ceremonies. |
| V10 | Account owns the passkey credential records. |
| V11 | **WebAuthn RP ID = `account.harithkavish.com`.** Changed under §0.5 while no passkey existed. Irreversible **from the first registered passkey**, not before. |
| V12 | `sub` = immutable Account UUID (`users.id`). Public subject identifiers. |
| V13 | Authorization Code + **PKCE mandatory for all clients**, `S256` only. |
| V14 | **Exact** redirect-URI matching. No wildcards, prefixes or suffixes. HTTPS only. |
| V15 | Access tokens live **5 minutes**. |
| V16 | Authorization codes are **short-lived and single-use**. |
| V17 | Refresh tokens **rotate**, have a **bounded** lifetime, and **reuse revokes the family**. |
| V18 | **Both** application logout and global logout exist. |
| V19 | Status `active` and `deletion_requested` **may** authenticate; `deleted` **must not**. |
| V20 | **Unknown status values are rejected** and treated as a security anomaly. |
| V21 | **No application, Account or Auth may create a second authentication mechanism or fallback authentication path.** |
| V22 | Account signup remains **unauthenticated** — the bootstrap path. |
| V23 | **Only the identity service communicates with an external identity provider.** No application performs a provider flow. |
| V24 | **A HarithKavish account is the identity.** A provider identity is a *link* to an account, never an account, and never a `sub`. |
| V25 | **First federated sign-in creates a HarithKavish account**, over the private interface, at Auth's request. A second creation path to V22, with a different trust basis. |
| V26 | **Auth does not persist provider tokens.** A provider assertion is consumed to establish identity and discarded — the discipline of V7/V8, applied to federation. |
| V27 | **A provider-verified email address never links to an existing account automatically.** Linking an additional provider requires an authenticated Account session. |
| V28 | **Google is the only provider in V1.** Adding another is a change to this contract, not a configuration change. |

---

## 2. Lifetimes **[RESOLVED]**

### 2.1 Values

| Item | Value | Note |
| --- | --- | --- |
| Authorization code | **60 seconds**, single-use | Redemption of a consumed code **revokes the resulting grant** |
| Access token | **5 minutes** | The revocation window under V1 expiry-based propagation |
| ID token | **5 minutes** | Consumed at login; proves an authentication event |
| Refresh token — absolute | **30 days** from the authorization grant | **Rotation does not extend it.** The family expires 30 days after the grant regardless of how often it rotates. |
| Refresh token — individual | Inherits the family's absolute expiry | |
| SSO session — idle | **12 hours** | |
| SSO session — absolute | **30 days** | |
| Clock skew tolerance | **60 seconds** | Applies to token validation and to §3.2 |

**Why rotation must not extend the family bound.** If each rotation reset the
clock, a client refreshing within the window would hold an indefinitely
renewable grant and V17's "bounded" would be false in practice. The bound is
fixed at grant time.

### 2.2 The guard, corrected — resolves X1 / U21

The guard is: **no lifetime for a credential issued to a client may be invented
by an implementation.** It binds authorization codes, access tokens, ID tokens,
refresh tokens and the SSO session — all fixed above.

It **does not** bind Auth-internal ceremony and transport state, which is not a
credential issued to anyone:

| Auth-internal value | Owner | Constraint |
| --- | --- | --- |
| WebAuthn challenge TTL | Auth | Single-use, short-lived, bound to the requesting session |
| Authorization-request lifetime | Auth | Bounded |
| Replay acceptance window | Both | **60 seconds**, per §3.2 |

Auth may set the first two within those constraints without a contract revision.
This unblocks Auth's §10.

---

## 3. Service authentication **[RESOLVED]** — resolves X12 / U4 / P1

### 3.1 Mechanism: asymmetric signed service assertions

**Not mTLS.** The concrete technical contradiction that decides it:

> **[FACT]** Account is deployed on Vercel, which terminates TLS at the edge.
> A client certificate is not presented to the application, so mTLS cannot be
> verified by Account without changing Account's hosting. mTLS is eliminated on
> **feasibility**, not merit.

Signed assertions also reuse machinery both sides have already committed to —
asymmetric signing, published keys, `kid`-addressed rotation — and bind
**per request** rather than per channel, satisfying audience, integrity and
replay in one construct.

**Network restriction remains required in addition**, never instead (Auth §11.5,
Account §1).

### 3.2 The assertion

Signed with Auth's **service key**, verified by Account against Auth's service
JWKS (cached, `kid`-addressed).

| Claim | Value |
| --- | --- |
| `iss` | `https://auth.harithkavish.com` |
| `sub` | `auth-service` — the service identity |
| `aud` | The interface base URI. A credential for one service is useless at another. |
| `jti` | Unique per request — the replay nonce |
| `iat`, `exp` | `exp − iat` ≤ **60 seconds** |
| `htm` | HTTP method |
| `htu` | Full request URI |
| `bdh` | base64url(SHA-256(request body)); empty string for bodyless requests |
| `cap` | The capability invoked — §3.4 |

`alg`: **EdDSA (Ed25519)**, falling back to RS256 only if a required library
lacks Ed25519. `alg: none` and all HMAC algorithms rejected. Every assertion
carries `kid`.

Covering `htm`, `htu` and `bdh` is what stops an assertion captured for one
capability being replayed against another.

### 3.3 Credential domains — resolves X17, extends R38

Five domains. Each separately stored, separately permissioned, independently
rotatable. **Compromise of one confers none of the others.**

| # | Credential | Held by | Purpose |
| --- | --- | --- | --- |
| 1 | **Auth service signing key** (private) | Auth | Signs §3.2 assertions |
| 2 | **Auth service public JWKS** | Published; cached by Account | Verifies §3.2. Not a secret. |
| 3 | **Auth token signing keys** (private) | Auth / KMS | Signs ID and access tokens |
| 4 | **Account OIDC client key** (private) | Account | `private_key_jwt` client authentication |
| 5 | **SSO session cookie** | User's browser | Recognising a returning user |

**Domains 1 and 3 must be different keys.** Sharing them would let a token be
presented as a service assertion or the reverse, and would couple two rotation
schedules with very different exposure.

**Domains 1 and 4 are the pair most likely to be conflated** — same two parties,
opposite directions. They must not share a store, a rotation schedule, or a
configuration entry. Rotating either must not require touching the other; this
must be demonstrated, not assumed.

Account authenticates as a **confidential client using `private_key_jwt`** —
no shared client secret anywhere in the ecosystem.

**In V1 Account holds no outbound service credential**, because pull-based
revocation (§4) removes the Account→Auth channel entirely. Account holds one
private key (domain 4) and verifies against one public JWKS (domain 2).

### 3.4 Least privilege

The assertion's `cap` claim names one capability. Account authorizes per
capability, so a compromise limited to one path does not confer the others.

`credentials.verify` · `credentials.verify_recovery` · `accounts.read` ·
`passkeys.read` · `passkeys.create` · `passkeys.delete` · `passkeys.counter`

`credentials.verify_recovery` is a **separate capability from
`credentials.verify`**, not a parameter of it: it consumes a single-use
credential, carries different rate limits, and a compromise confined to one path
must not confer the other.

**Recovery code *generation* needs no capability.** Account generates codes on
its own surfaces — at signup, and on regeneration from an authenticated session
— so generation never crosses the interface. Only verification does.

### 3.5 Explicitly denied

Auth's client must have **no code path** capable of requesting: `password_hash`
or any derivative; listing, searching, counting or exporting accounts; any field
outside §5.3; `account_events`; another user's data during a session for one
user; or existence testing other than the uniform verdict of §5.2.

*A capability the client cannot express cannot leak under compromise.*

---

## 4. Revocation **[RESOLVED]** — resolves X4, X5, X6 / U5 / P10 / OQ2

### 4.1 Pull, not push

**V1 is pull-based.** Account exposes `credentials_changed_at`; Auth compares it
against each token family's `auth_time` at every refresh and revokes on
mismatch.

Chosen because it eliminates a whole class of problems rather than solving them:
no delivery infrastructure, no at-least-once semantics, no ordering, no
inbound authentication surface at Auth, and nothing lost while Auth is down. It
also deletes the "undelivered revocation is a security-relevant backlog" failure
mode that a push design must carry.

Push is **deferred, and strictly additive** — it would reduce latency, not change
correctness.

### 4.2 `credentials_changed_at` is derived, not stored — resolves X6

Account has no such column and **adding one is a schema change, which is not
authorized**. It is derived:

```
credentials_changed_at =
  MAX(account_events.occurred_at)
  WHERE user_id = <account>
    AND type IN ('password_changed', 'account_deleted', 'recovery_code_used')
```

`recovery_code_used` does not exist in the enum today and would require a schema
change — **not authorized** (§13).

Null when no such event exists. A denormalized column is a later optimisation
requiring its own authorization.

### 4.3 Semantics

| Account event | Effect at Auth |
| --- | --- |
| `password_changed` | Revoke families whose `auth_time` precedes it. **The SSO session is terminated too.** |
| `recovery_code_used` | **Same as `password_changed`** — revoke families, terminate SSO sessions. Applied on **consumption**, not on completion of the recovery flow (§7.5.3 #6). |
| `account_deleted` | Revoke everything; refuse authentication and refresh |
| `account_deletion_requested` | **No effect** — the user must reach Account to cancel |
| `account_deletion_cancelled` | **No effect** |
| Refresh token reuse | Revoke the entire family immediately |
| Global logout | Terminate the SSO session; refuse renewal for its grants |

**"Revoke" includes the SSO session on a password change.** Leaving it alive
would let the old session immediately mint new families, defeating the
revocation entirely.

### 4.4 Enforcement points

Every refresh, and every SSO session resume. Both re-check status (§5.3) and
`credentials_changed_at`.

---

## 5. The private interface

Base URI configured out-of-band; not reachable from the public internet.
Version in the path: `/internal/v1/…`. **[OPEN — X21]** the network topology and
hostname.

### 5.1 Common rules

**Request** — every request carries the §3.2 assertion, plus
`X-HK-Correlation-Id` (generated by Auth at the start of a user-facing flow,
echoed by Account, present in both audit trails).

**Mutations** additionally carry `X-HK-Idempotency-Key`.

**Errors** — uniform shape, no stack traces, no internal identifiers, no schema
detail:

```json
{ "error": "<code>", "error_description": "<safe generic text>",
  "request_id": "<uuid>", "retryable": true }
```

| Code | HTTP | Retryable |
| --- | --- | --- |
| `unauthenticated` | 401 | No |
| `replay_detected` | 401 | No |
| `forbidden` | 403 | No |
| `invalid_request` | 400 | No |
| `unsupported_version` | 400 | No |
| `not_found` | 404 | No |
| `conflict` | 409 | No |
| `idempotency_conflict` | 409 | No |
| `rate_limited` | 429 + `Retry-After` | Yes, after the delay |
| `internal_error` | 500 | Yes |
| `unavailable` | 503 | Yes |

**Retryability is explicit in the body**, not inferred from the status code.

> **The distinction that governs everything.** A **negative credential verdict is
> `200 OK` with `verified: false`** — never a 4xx. Transport and application
> failures are 4xx/5xx. *"This credential is wrong"* and *"I could not determine
> whether this credential is wrong"* are therefore structurally
> indistinguishable-proof: Auth cannot conflate them even by accident.

**Replay protection** — Account rejects an assertion whose `jti` has been seen
within the acceptance window, or whose `exp` has passed. Nonce cache retention
must exceed the window. **[OPEN — X22]** cache location; Account's existing
Upstash Redis is the obvious home.

**Idempotency** — a repeat with the same key **and the same request digest**
returns the original response without re-executing. Same key, different digest →
`idempotency_conflict`. Records must outlive Auth's maximum retry budget.

*Replay protection rejects a hostile repeat; idempotency absorbs a legitimate
one. A retry reuses the same idempotency key with a **fresh** assertion.*

### 5.2 `POST /internal/v1/credentials/verify`

| | |
| --- | --- |
| **Caller** | Auth · `cap: credentials.verify` |
| **Purpose** | Verify a presented password against Account's Argon2id hash |
| **Idempotent** | In effect; consumes rate budget and produces an audit record |
| **Replay-sensitive** | **Highest on the interface** — the body carries a plaintext password |

```json
POST  { "user_id": "<verbatim as typed>", "password": "<plaintext>",
        "client_context": { "ip": "…", "user_agent": "…", "client_id": "…" } }
```

- `user_id` is sent **verbatim**, trimmed of surrounding whitespace only.
  **Account normalizes** (X7) — it owns the uniqueness index. Auth must not
  implement normalization.
- `password` **maximum 128 characters**, enforced **before hashing** — matches
  Account's existing limit **[FACT]** and bounds an Argon2id DoS.
- Body only. Never a query parameter, path segment or header.
- `client_context` is for Account's rate limiting and audit.

```json
200  { "verified": true,
       "account": { "id": "<uuid>", "status": "active",
                    "credentials_changed_at": "<ts|null>" } }

200  { "verified": false }
```

**The negative verdict is uniform** — no such account, wrong password, **and
`deleted`** all return exactly `{"verified": false}` (X8). Revealing that an
account exists but is deleted would be an enumeration oracle; Auth does not need
the distinction, because it refuses either way.

**Account must perform equivalent hashing work when no account matches** — a
dummy verification against a fixed hash. Short-circuiting makes timing an
enumeration oracle regardless of the response body.

An account whose `password_hash` is NULL — federated-only (§6.4) — returns the
same uniform `{"verified": false}`, and Account performs the same dummy hashing.
Revealing "this account exists but has no password" would tell an attacker
exactly which accounts to attack through their provider instead.

`deletion_requested` returns `verified: true` with that status; Auth proceeds
(V19).

Rehash-on-verify is internal to Account and must not alter response shape or
observable timing.

### 5.3 `GET /internal/v1/accounts/{account_id}`

| | |
| --- | --- |
| **Caller** | Auth · `cap: accounts.read` |
| **Purpose** | Claims, status and revocation baseline for token issuance and refresh |
| **Idempotent** | Yes, read-only |

**By UUID only.** The public user ID is not accepted as a key — that would make
lookup an identifier-resolution oracle.

```json
200  { "sub": "<uuid>",
       "name": "<composed by Account>",
       "given_name": "…", "family_name": "…",
       "preferred_username": "<user_id>",
       "status": "active" | "deletion_requested" | "deleted",
       "credentials_changed_at": "<ts|null>" }
```

- **`name` is composed by Account** (X7/AR-15). Auth must never concatenate
  parts, so a future change to name rendering propagates.
- **Status and `credentials_changed_at` ride on this response** (X3) — no
  separate status operation exists, and refresh needs no second round trip.
- A `deleted` account returns `200` with `status: "deleted"`, not `404`. Auth
  already legitimately holds the UUID, so this leaks nothing, and a tombstone is
  more useful than an ambiguous not-found.
- Lookup is permitted **without a preceding verification** — refresh requires it.

**Unknown status handling is Auth's** and is a security property: any value
outside the three above **refuses authentication and refresh** (V20).

### 5.4 `GET /internal/v1/accounts/{account_id}/passkeys`

| | |
| --- | --- |
| **Caller** | Auth · `cap: passkeys.read` |
| **Purpose** | Candidate credentials for assertion; `excludeCredentials` for registration |
| **Idempotent** | Yes |

```json
200  { "credentials": [
        { "credential_id": "<base64url>", "public_key": "<base64url COSE>",
          "sign_count": 0, "transports": ["internal","hybrid"],
          "aaguid": "<uuid|null>", "rp_id": "auth.harithkavish.com",
          "label": "…", "created_at": "…", "last_used_at": "…" } ] }
```

Registration depends on this (`excludeCredentials`), so read is a prerequisite
of create, not only of assertion.

### 5.5 `GET /internal/v1/passkeys/by-credential-id/{credential_id}`

| | |
| --- | --- |
| **Caller** | Auth · `cap: passkeys.read` |
| **Purpose** | **Discoverable-credential (usernameless) sign-in**, where Auth has a credential ID and no identifier |
| **Idempotent** | Yes |

Returns the single credential **and its owning account UUID**. Omitting this
direction silently prevents usernameless sign-in.

Acceptable within the anti-enumeration invariant because credential IDs are
high-entropy and unguessable — but it requires a **uniform miss response**, no
timing differential, and its own rate limit.

### 5.6 `POST /internal/v1/accounts/{account_id}/passkeys`

| | |
| --- | --- |
| **Caller** | Auth · `cap: passkeys.create` — after a verified ceremony |
| **Idempotent** | **Required.** Natural key: `credential_id` |
| **Replay-sensitive** | Yes — a mutation |

```json
POST  { "credential_id": "<base64url>", "public_key": "<base64url COSE>",
        "sign_count": 0, "transports": [...], "aaguid": "<uuid|null>",
        "rp_id": "auth.harithkavish.com", "label": "<user-supplied|null>" }

201  { "credential": { … }, "created": true }
200  { "credential": { … }, "created": false }   ← idempotent repeat
409  conflict — credential_id bound to a different account
409  conflict — per-account passkey limit reached
```

- **`created` distinguishes a fresh write from an idempotent repeat** — both are
  success. This is what lets Auth reconcile without guessing.
- A `credential_id` already bound to a **different** account is a conflict, never
  a reassignment.
- `rp_id` is recorded so a future audit is answerable at nil cost.
- **Auth may not modify a credential after creation** except the counter (§5.8).
  Rename and delete are user-initiated; delete is §5.7.

### 5.7 `DELETE /internal/v1/accounts/{account_id}/passkeys/{credential_id}`

| | |
| --- | --- |
| **Caller** | Auth · `cap: passkeys.delete` — after Auth-hosted management |
| **Idempotent** | **Yes.** Deleting an already-deleted credential **succeeds** |

```json
200  { "deleted": true,  "existed": true }
200  { "deleted": true,  "existed": false }
```

A credential not belonging to the named account is `404`, not a silent no-op.
**Account must not report success on an ambiguous outcome** — a user told a
credential was removed may believe a lost device is no longer a risk.

Account may also delete records locally (account deletion); that is internal and
uses no interface operation.

### 5.8 `POST /internal/v1/accounts/{account_id}/passkeys/{credential_id}/counter`

| | |
| --- | --- |
| **Caller** | Auth · `cap: passkeys.counter` — after a successful assertion |
| **Idempotent** | **Yes, by monotonic application** |

```json
POST  { "sign_count": 42, "last_used_at": "…" }
200   { "sign_count": 42 }
```

**Applied monotonically** — Account stores `MAX(stored, submitted)`. A replayed
older value can never lower the stored counter. This is required regardless of
the regression policy in §7.3.

Auth may not alter the public key, credential ID or account binding here.

---

### 5.9 `POST /internal/v1/credentials/verify-recovery`

| | |
| --- | --- |
| **Caller** | Auth · `cap: credentials.verify_recovery` |
| **Purpose** | Verify **and atomically consume** a single-use recovery code |
| **Idempotent** | **No** — consumption is a one-way state change. Requires `X-HK-Idempotency-Key`. |
| **Replay-sensitive** | **Yes** — the body carries a bearer credential |

```json
POST  { "user_id": "<verbatim as typed>", "recovery_code": "<code>",
        "client_context": { "ip": "…", "user_agent": "…" } }

200  { "verified": true,
       "account": { "id": "<uuid>", "status": "active",
                    "credentials_changed_at": "<ts>" },
       "remaining_codes": 7 }

200  { "verified": false }
```

- **Verification and consumption are one atomic operation.** A
  verify-then-consume sequence permits a race in which one code is redeemed
  twice — the failure this operation exists to prevent.
- The negative verdict is **uniform**: unknown account, wrong code, already-used
  code and `deleted` account all return exactly `{"verified": false}`.
  As with §5.2, equivalent work must be performed when no account matches.
- `credentials_changed_at` in the success response **already reflects this
  consumption**, so Auth revokes prior families immediately (§4.3).
- `remaining_codes` lets Account's UI warn a user who is running low. It reveals
  nothing an authenticated user does not already own.
- **Retry semantics:** a retry carrying the same idempotency key returns the
  original response without consuming a second code. This is the only thing
  standing between a network timeout and a silently burned recovery code.

---

### 5.10 `POST /internal/v1/identities/resolve` **[RESOLVED as design; NOT authorized to build]**

| | |
| --- | --- |
| **Caller** | Auth · `cap: identities.resolve` |
| **Purpose** | Exchange a provider subject Auth has already verified for the HarithKavish account it belongs to, creating one if the subject is new |
| **Idempotent** | **Yes**, on `(issuer, subject)`. A repeat returns the same account and creates nothing |
| **Replay-sensitive** | Moderate — the body carries no credential, but a replay could create an account |

```json
POST  { "issuer": "https://accounts.google.com",
        "subject": "<provider sub, verbatim>",
        "email": "<as asserted|null>",
        "email_verified": true,
        "name": "<as asserted|null>",
        "picture": "<as asserted|null>",
        "client_context": { "ip": "…", "user_agent": "…", "client_id": "…" } }
```

- **Auth calls this only after it has verified the assertion itself** — signature,
  issuer, audience, expiry, nonce. Account performs no provider validation and
  must not be the thing that trusts the token; it trusts *Auth*, through §3.
- `subject` is opaque. Account stores it verbatim and never parses it.
- `email` is carried for **display and for a later, deliberate link** (V27). It is
  **not** a lookup key. Account must not resolve an account by it.

```json
200  { "account": { "id": "<uuid>", "status": "active",
                    "credentials_changed_at": "<ts|null>" },
       "created": true }
```

`created` tells Auth whether this sign-in brought a new person into the
ecosystem. Auth needs it to decide whether a first-run experience is owed — and,
under §7.6, whether recovery codes must be presented before the session is
usable.

**There is no negative verdict.** Unlike §5.2, this operation cannot fail with
"no such account": an unknown subject *is* the create case. The enumeration
concern of X8 does not arise, because nothing here is keyed by anything a
stranger can guess.

**`deleted` is the exception, and it is not settled** — see X33. Until it is,
Account returns `409` and Auth refuses, which is the only behaviour that cannot
silently resurrect a deleted person.

**Rate limiting is Account's** (§9.3), and it is the account-creation budget, not
the verification budget. A provider that will mint subjects on demand is
otherwise a way to mint accounts.

---

## 6. Passkey record — schema design **[RESOLVED as design; NOT authorized to create]**

```
passkeys
  id               uuid        PK, default gen_random_uuid()
  account_id       uuid        NOT NULL  FK → users.id  ON DELETE CASCADE
  credential_id    text        NOT NULL  UNIQUE          ← base64url; global uniqueness
  public_key       text        NOT NULL                  ← base64url COSE
  sign_count       bigint      NOT NULL  DEFAULT 0
  transports       text[]      NULL
  aaguid           uuid        NULL      ← may be zero under attestation=none
  rp_id            text        NOT NULL
  label            text        NULL
  created_at       timestamptz NOT NULL  DEFAULT now()
  last_used_at     timestamptz NULL

  INDEX (account_id)
```

**`ON DELETE CASCADE`, deliberately unlike `account_events`.** The audit trail
outlives the account by design; credentials must not — an orphaned credential is
an authentication factor for an account that no longer exists.

**`credential_id UNIQUE` is the structural mechanism behind idempotent creation
(§8).** It makes duplicate creation impossible rather than merely unlikely.

### 6.1 Recovery codes — schema design **[RESOLVED as design; NOT authorized to create]**

```
recovery_codes
  id           uuid        PK, default gen_random_uuid()
  account_id   uuid        NOT NULL  FK → users.id  ON DELETE CASCADE
  batch_id     uuid        NOT NULL                  ← regeneration invalidates a batch
  code_hash    text        NOT NULL  UNIQUE          ← SHA-256 hex; NOT Argon2id (§7.5.1)
  used_at      timestamptz NULL                      ← NULL = unused
  created_at   timestamptz NOT NULL  DEFAULT now()

  INDEX (account_id, batch_id)
```

- **`ON DELETE CASCADE`**, as with `passkeys` — a code outliving its account
  would be a credential for an identity that no longer exists.
- **Consumption is a conditional update** — set `used_at` only where it is
  currently `NULL`, and treat "zero rows affected" as already-used. That is what
  makes §5.9 atomic; a read-then-write cannot be.
- Regeneration invalidates the prior batch **in the same transaction** as
  inserting the new one, so an account is never briefly without codes or
  briefly holding two live batches.

### 6.2 Also required, also not authorized

An idempotency-record store (key, capability, request digest, stored response,
expiry), and two `account_event_type` values — `recovery_codes_generated` and
`recovery_code_used`.

> **No migration is authorized.** `account_event_type` gains no passkey value
> either; passkey events are Auth's to audit (§9.4).

---

### 6.3 `user_identities` — schema design **[RESOLVED as design; NOT authorized to create]**

The link V24 describes. One row per provider identity; a person may hold several.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `user_id` | `uuid` NOT NULL | FK → `users.id`, `ON DELETE CASCADE` |
| `issuer` | `text` NOT NULL | e.g. `https://accounts.google.com`. Stored verbatim |
| `subject` | `text` NOT NULL | The provider's `sub`. Opaque, never parsed |
| `email_at_link` | `text` NULL | What the provider asserted when linked. Display and audit only |
| `linked_at` | `timestamptz` NOT NULL | `now()` |
| `last_authenticated_at` | `timestamptz` NULL | |

- `user_identities_issuer_subject_unique` — **UNIQUE** on `(issuer, subject)`.
  This is what makes §5.10 idempotent, and what stops one provider identity
  reaching two accounts.
- `user_identities_user_id_idx` — on `user_id`.
- **No index on `email_at_link`.** It is not a lookup key (V27), and an index
  would invite it to become one.

**Two existing columns block a federated-only account, and neither may be changed
here.** `users.password_hash` is `NOT NULL` **[FACT]**, and `users.user_id` is a
`NOT NULL` **UNIQUE** identifier the person chooses **[FACT]**. Someone who only
ever signs in with Google supplies neither. What that account's `password_hash`
and public `user_id` should be is **X32**, and it must not be answered by
whatever the first migration finds convenient.

**Two `account_event_type` values are required**: `identity_linked`,
`identity_unlinked`. Both are schema changes, and inherit §13's authorization
requirement alongside the two already named in §6.2.

**Their effect on `credentials_changed_at` (§4.2) is not symmetrical.**
Unlinking **is** a credentials change — it removes a way in, and sessions
established through it must not outlive it. Linking is **not** — adding a second
way in invalidates nothing, and treating it as a change would sign a person out
for improving their own security.

---

### 6.4 A federated-only account's `password_hash` and `user_id` **[RESOLVED]** — resolves X32

Both columns are `NOT NULL` today **[FACT]**, and someone who only ever signs in
with Google supplies neither. Nothing federated can be written until this is
answered, so it is answered here rather than by the first migration to need it.

**`password_hash` becomes nullable. NULL means: this account has no password.**

The alternative — storing a sentinel or a hash of a random value — was rejected.
It puts a credential-shaped value in a credential column, where every future
reader must know it is not one. §5.2 already hashes against a fixed dummy when no
account matches; a *stored* sentinel is a different thing, and the first code to
treat it as real is a password bypass. NULL cannot be verified against by
accident.

**`user_id` becomes nullable. NULL means: this person has not chosen a public
identifier.**

`user_id` is the identifier *the person chooses to log in with* **[FACT]**. A
federated-only account has no such thing, and generating one manufactures a
choice they did not make — one they may want later, and which would then be
taken by a string the system invented. Postgres permits many NULLs under a
UNIQUE index, so `users_user_id_unique` is unaffected for accounts that do have
one.

A person may claim a `user_id` later, which is also how they would add a password
sign-in. That is an Account operation and needs an authenticated session; it is
not part of any ceremony here.

**Consequences, which are the point of resolving this centrally:**

| Where | Rule |
| --- | --- |
| §5.2 verify | An account with `password_hash IS NULL` returns the **uniform negative**, and Account still performs equivalent hashing work. A federated-only account must not be distinguishable from a wrong password or a missing account |
| §5.2 lookup | `user_id IS NULL` matches nothing. A federated-only account is unreachable by password sign-in, which is correct rather than a gap |
| §5.10 create | Writes neither column. The account is defined by its `user_identities` row |
| Display | Anything showing `user_id` must tolerate NULL. It is not a fallback for a name |
| Invariant | **An account must retain at least one usable way in.** With both columns nullable, an unlink can otherwise leave an account no one can reach — the substance of X34 |

**This does not authorize the migration.** Making two columns nullable is a
schema change and falls under §13 like every other.

---

## 7. Authentication ceremonies

Auth performs every authentication ceremony (V1, V9). This section covers
WebAuthn (§7.1–§7.4) and account recovery (§7.5).

### 7.1 WebAuthn parameters **[RESOLVED]**

| | |
| --- | --- |
| RP ID | `auth.harithkavish.com` — irreversible |
| Expected origin | `https://auth.harithkavish.com` |
| RP name | `HarithKavish` |
| Attestation | **`none`** (X15) — first-party use; avoids a verification path and privacy considerations |
| User verification | **[OPEN — X23]** required vs preferred |
| Max passkeys per account | **[OPEN — X24]** a bound is required; unbounded growth degrades assertion |

### 7.2 Registration handoff

1. Account's security page sends the user to Auth.
2. **Auth determines the account from its own authenticated SSO session — never
   from an identifier in the redirect.** Accepting one would make the handoff a
   mechanism for registering a credential against someone else's account.
3. Auth reads existing credentials (§5.4) for `excludeCredentials`.
4. Auth issues a challenge and runs the ceremony.
5. Auth verifies the result.
6. **Auth persists the verified result locally before calling Account** (§8 G1).
7. Auth writes to Account (§5.6), idempotent on `credential_id`.
8. Auth reconciles to a terminal state and returns the user to Account.

**[OPEN — X25]** the exact handoff — dedicated scope, ACR value, or a distinct
redirect contract.

### 7.3 Signature-counter policy **[RESOLVED]** — resolves X13 / U8 / P9

| Stored | Presented | Outcome |
| --- | --- | --- |
| `0` | `0` | **Accept.** No update. The authenticator does not implement counters — common for platform authenticators, and not a regression. |
| any | `> stored` | **Accept.** Update to the presented value. |
| `> 0` | `≤ stored` | **Reject the assertion. Audit at high severity.** |

The third row is the only genuine clone signal WebAuthn provides, and the
first-row carve-out is what stops the naive rule breaking ordinary platform
authenticators.

Rejecting rather than logging is the conservative choice for an identity
provider, and it is not a lockout: the user retains their password and any other
passkey. A false positive from a buggy authenticator is remediated by deleting
and re-registering that credential — an operator-visible, user-recoverable path.

### 7.4 Failed counter update **[RESOLVED]** — resolves X14

**The sign-in succeeds.** The assertion was cryptographically valid; failing it
would punish the user for an infrastructure fault.

The update is persisted to Auth's durable pending-write store and retried — the
same pattern as §8. A permanently unreconcilable update is an **operator alert**,
not a silent drop, because a persistently stale counter degrades clone detection
for that credential.

---

### 7.5 Account recovery **[RESOLVED]** — X20

**Recovery codes are the V1 recovery mechanism. Email and phone recovery are not
adopted.** Multiple passkeys are encouraged but are **redundancy, not
recovery** — registering one requires an already-authenticated session, so it
must be established before loss and does not help a locked-out user.

Recovery codes are **credential material owned by Account** (V6). **Auth performs
the recovery ceremony** (V1, V9).

> **This division is load-bearing, not stylistic.** If Account implemented
> "reset with this code" on its own surface, that would be a second
> authentication path and a **V21 violation**. Account stores and verifies the
> codes; Auth is the only party that may run the ceremony and mint a session
> from it — exactly as with passwords and passkeys.

#### 7.5.1 Code properties

| Property | Requirement |
| --- | --- |
| Count | **10 codes**, generated **at account creation** |
| Acknowledgement | The user **must explicitly acknowledge having saved them before signup completes** |
| Entropy | High — CSPRNG, not derived from anything user-supplied |
| Hashing | **SHA-256. Not Argon2id.** |
| Use | **Single-use**, verified and consumed **atomically** |
| Low-code warning | Warn the user at **3 or fewer remaining** |
| Regeneration | Creates a **new batch** and **invalidates unused codes from the previous batch** |

**Why not Argon2id.** Argon2id exists to make low-entropy secrets expensive to
guess. Recovery codes are high-entropy, so brute force is infeasible regardless
of hash cost — while verifying an attempt against *N* stored codes would mean
*N* Argon2id verifications per request, a self-inflicted denial of service on
the recovery path. Two hashing regimes, deliberately: Argon2id for passwords,
a fast cryptographic hash for recovery codes.

**Verification and consumption must be one atomic operation** (§5.9). A
verify-then-consume sequence permits a race in which one code is redeemed twice.

#### 7.5.2 The restricted recovery session

Successful recovery does **not** produce a normal session. It produces a
**restricted recovery session** whose sole purpose is to re-establish a normal
authentication factor.

**Signalled via `amr` / `acr`, not a new identity claim.** These are the
standardised authentication-context mechanisms and are already carried in the ID
token; using them keeps the fixed identity claim set of §9.5 unchanged (X10).

**Enforcement is at Auth, not at the client.** Auth **must not issue tokens to
any client except Account** while the session is recovery-grade. Relying on each
application to inspect `amr` and refuse would make ecosystem security depend on
every client implementing a check correctly — the failure mode V21 exists to
prevent. Account applies its own restriction as defence in depth.

#### 7.5.3 What a recovery session may and may not do

**A recovery-grade session has exactly two capabilities:**

| # | May |
| --- | --- |
| 1 | **Identify the account being recovered** |
| 2 | **Register a new passkey** |

**It may not:**

| # | May not | |
| --- | --- | --- |
| 1 | **Change the password** | Recovery re-establishes a factor; it does not reset the old one |
| 2 | **Remove existing passkeys** | §7.5.4 |
| 3 | **Access any ecosystem application** | Forge, VR, Nexus, or any future client |
| 4 | **Receive application tokens** | **No token is issued to any client, including Account.** The session lives entirely inside Auth's own surfaces. |
| 5 | **Become a normal session** | §7.5.5 |
| 6 | **Remove existing factors** | *Recovery adds; it never removes.* |

**Termination.** After a passkey is registered, **the recovery session
terminates.** The user must then perform a **fresh normal authentication with
the new passkey** before any account or security management is available.

**Revocation.** Consuming a recovery code bumps `credentials_changed_at`
**on consumption**, not on completion — revoking existing refresh-token families
and terminating existing SSO sessions through §4.

**Effect on existing factors: none.** Existing passkeys remain valid; an
existing password remains valid. Removal and password change require a normal
authenticated session.

#### 7.5.4 Why removal is denied

The asymmetry decides it. If an attacker with a stolen recovery code **can**
remove passkeys, they strip every factor and the legitimate user is locked out
completely. If they **cannot**, the user's existing passkeys still work — the
legitimate user **retains a foothold and can fight back**.

The honest user pays one extra step: recover → register a passkey →
authenticate normally → remove the lost credential. The attacker is denied a
lockout weapon.

#### 7.5.5 Why the session never becomes a normal session

Requiring a fresh authentication **proves the new passkey actually works**
before the recovery session ends.

§8 G7 already establishes that what the user is told must come from Account's
state, not from ceremony success. A passkey registration whose write to Account
silently failed would, under an upgrading session, leave the user holding a
working session, no usable factor, and a **recovery code already consumed** —
locked out again, with one fewer way back.

#### 7.5.6 Session bounds

| Property | Value |
| --- | --- |
| Lifetime | **15 minutes**, non-renewable |
| Ends on | Passkey registration, expiry, or abandonment |
| Tokens | **None.** No access, ID or refresh token is issued to any client. |
| Concurrency | One active recovery session per account; initiating a new one invalidates any prior |

#### 7.5.7 Consequence of the passkey-only outcome

Recovery terminates in a **passkey**, so completing it requires a
WebAuthn-capable authenticator. A user with no such authenticator cannot
complete recovery. This is a direct and accepted consequence of the decision,
recorded so it is not discovered later.

#### 7.5.8 Consequences and constraints

- **Recovery requires Account to be available**, since code verification is an
  Account operation. Recovery is therefore unavailable during an Account outage.
  This is consistent with §11 and creates no conflict: if recovery succeeded,
  Account was reachable, so the `credentials_changed_at` bump is immediately
  visible and grace never masks it.
- **Recovery verification must be rate-limited independently** of password
  verification, and must return a **uniform failure** that does not reveal
  whether the account exists (§3.5).
- **Recovery is refused for a `deleted` account** and permitted for
  `deletion_requested` (V19) — a user with a pending deletion must be able to
  recover in order to cancel it.
- **Codes are credential material in transit and at rest**: never logged, never
  persisted in cleartext, never returned after generation (§10.4).

---

### 7.6 Federated ceremony **[RESOLVED]** — V23–V28

Auth runs the provider flow. Account owns what it produces. The division is V9
and V10 again, with Google in place of WebAuthn.

1. The person chooses **Continue with Google** at Auth. No application shows a
   provider button; an application that does is a path around Auth (V21, V23).
2. Auth performs the OIDC Authorization Code flow with the provider, PKCE
   included, and **verifies the resulting assertion itself** — signature against
   the provider's keys, issuer, audience, expiry, and the nonce it issued.
3. Auth calls §5.10 with the verified `(issuer, subject)`.
4. Account resolves the link, or creates an account and the link together, and
   returns the Account UUID.
5. Auth mints its own session and tokens. **`sub` is the Account UUID** (V12).
   The provider's subject never leaves Account's storage and never appears in a
   token, a claim, or a log line.
6. Auth discards the provider's tokens (V26).

**A person who signs in with Google and later adds a passkey is one account with
two ways in.** That is the whole purpose of the indirection at step 4: without
it, each provider would grow its own population of users.

**Linking a second provider to an existing account is not this ceremony.** It
requires an authenticated Account session and is initiated from Account (V27).
An unauthenticated flow that links on a matching email would make any provider
willing to assert an address into an account-takeover path — the address proves
the provider checked an inbox, never that the holder controls a HarithKavish
account.

**Recovery is the sharp edge, and it is worse here than for passwords.** A
federated-only account has exactly one way in, and it is one the ecosystem does
not control: a disabled Google account, a revoked grant, or a workspace closing
locks the person out permanently. **Recovery codes (§7.5) must therefore be
issued and acknowledged at federated creation**, not offered later — `created:
true` in §5.10 exists partly to force that moment. This inherits the recovery
gap already recorded in §12: recovery codes need the `recovery_codes` table,
which §13 does not authorize. **Federated sign-in must not ship before recovery
does**, for the same reason passkeys must not.

---

## 8. Ceremony-write consistency **[RESOLVED]**

The failure the RP ID decision introduces: **the user completes a device prompt
for a credential Account never recorded.**

Both projects independently specified the same eight guarantees. They are
identical and are now canonical.

| # | Guarantee |
| --- | --- |
| **G1** | The verified ceremony result is persisted at **Auth** *before* Account is called. |
| **G2** | **Retry the write, never the ceremony.** Re-running the ceremony mints a new `credential_id` and is the direct cause of duplicates. |
| **G3** | Creation is idempotent on the authenticator-generated `credential_id`, enforced by a **uniqueness constraint** (§6), not by application care. |
| **G4** | Retries reuse the **same idempotency key** with a **fresh assertion**. |
| **G5** | Retries are bounded and terminate in a definite state. |
| **G6** | If retries are exhausted, a **reconciliation query** (§5.5) resolves whether the write committed. **"Unknown" must not be a resting state.** |
| **G7** | What the user is told comes from **Account's state**, not from ceremony success. |
| **G8** | An unreconcilable pending write is **surfaced to operators**, never silently dropped. |

**Residual case, stated honestly.** If Account commits, the response is lost,
*and* reconciliation is also unavailable, the user retries and obtains a second
legitimate credential. Untidy, not unsafe — both belong to the user, neither is
attacker-controlled.

> The mitigation is management UI, not protocol machinery — **and it is only
> benign if Account's list shows label, creation time and last-used**. Two
> indistinguishable rows means the user cannot safely delete either, which turns
> tidiness into a lockout risk.

---

## 9. Cross-cutting requirements

### 9.1 Versioning

Path-based `/internal/v1/`. Additive-only within a version: adding an optional
field is permitted; removing, renaming, narrowing a type, changing a default or
altering the meaning of a value is breaking and requires `v2`. Both versions
served during migration — the two platforms deploy independently and are never
in lockstep. Unknown **fields** are ignored; unknown **enum values fail closed**
(a security property, not a convention). Version mismatch is an explicit audited
error, never a silent fallback.

### 9.2 Timeouts

**[OPEN — X26]** concrete values, pending measured Argon2id cost on production
hardware.

Required properties: separate connect and read timeouts; **verification gets a
materially longer budget than lookup**, derived from measured hashing cost — a
single global timeout will either cut off legitimate verifications or leave
lookups hanging; bounded retries with backoff and jitter; only idempotent
operations retried, and mutations only with an idempotency key; **the retry
budget must be shorter than the idempotency record's lifetime**; and a total
user-facing budget so a login fails visibly rather than hanging.

### 9.3 Rate limiting

**Split** (AR-35): **Auth owns user-facing lockout and throttling** — it holds
client, IP, session and factor context. **Account owns interface limiting as a
backstop** against a compromised or malfunctioning Auth.

Account's backstop must sit high enough that it never trips in normal operation;
if it trips first, users see an infrastructure error where they should see a
credential error. Thresholds are **[OPEN — X27]** and must be documented on both
sides so they cannot silently diverge.

**A limit response must not reveal whether the account exists.**

### 9.4 Auditing

| Where | What |
| --- | --- |
| **Auth** `auth_events` | Authentication attempted/succeeded/failed, token issued, family revoked, logout, ceremony outcomes |
| **Account** structured logs | Every interface call: caller, capability, account UUID, outcome, timestamp, correlation ID |
| **Account** `account_events` | **Unchanged.** Lifecycle only. **No new enum values.** |

**A shared `X-HK-Correlation-Id`** joins the two, so one authentication is
reconstructable end to end.

**Interface audit goes to structured logs in V1** (X16) — a dedicated table would
require a schema change. Retention **[OPEN — X28]**.

**Never in any log, on either side:** plaintext password, `password_hash`,
tokens, authorization codes, `state`, or service assertions — **including in
error paths, stack traces and request dumps, which is where they usually
appear.** Verification's request body must be structurally excluded from error
serialisation, not merely disabled by configuration.

### 9.5 Scopes and claims — resolves X9, X10, X11

| Scope | Claims |
| --- | --- |
| `openid` | `sub` |
| `openid profile` | `sub`, `name`, `given_name`, `family_name`, `preferred_username` |

Clients request `openid profile`. **Status does not travel to clients as a
claim** (X10). No other Account field is exposed under any scope.

`preferred_username` is **display-only** and must never be an application's user
key. It **may be an email address**, since Account permits one as a user ID —
accepted for first-party clients under V12's intended correlation (X11), and a
trigger to revisit alongside pairwise subjects if a lower-trust client is ever
registered.

---

## 10. Operator break-glass **[RESOLVED]** — resolves U18 / OQ6

**Infrastructure-only. Never a user-facing authentication path.**

| | Operator recovery | User authentication fallback |
| --- | --- | --- |
| What it is | Direct database, platform-console and infrastructure access | A login route |
| Purpose | **Repair a broken system** | Sign in when Auth is down |
| Exposure | Out-of-band; no application route, no credential in application config | Public |
| Status | Legitimate and necessary | **Forbidden by V21** |

**Break-glass confers no ability to authenticate as a user.** There is no
impersonation capability, no "log in as", no operator-minted session or token.
An operator can restore service; an operator cannot become a user. Any mechanism
that let them would be a second authentication path and is prohibited by V21
regardless of how it is labelled or how restricted its access.

When Auth is unavailable, the operator's remedy is **service restoration**, not
an alternative way in — and because Account is itself an OIDC client (V5),
Account's own management surfaces are unavailable during that window. That is
accepted.

Every use is an **audited incident**, recorded out-of-band.

**[OPEN — X29]** the concrete mechanism: which credentials, held where, under
what access control, and how use is detected and reviewed.

---

## 11. Failure behaviour

| Situation | Behaviour |
| --- | --- |
| Account unavailable — verification | **Authentication fails** with a clear service error, **not** a wrong-password error. No fallback, no cache, no local verification. |
| Account unavailable — refresh of an existing grant | **Bounded grace, ≤15 min** on stale security state, then fail closed — §11.1 |
| Account unavailable — status | **Fail closed.** Refuse. |
| Counter update fails after a valid assertion | Sign-in succeeds; update retried durably (§7.4) |
| Passkey create fails after a ceremony | §8, G1–G8 |
| Account degraded but responding | Circuit breaker; thresholds **[OPEN — X26]** |
| Auth unavailable | No new authentication anywhere. Existing application sessions continue per their own policy. Validation continues against cached JWKS. **Account's own management surfaces are unavailable** (V5); **account creation continues** (V22). |

**Auth caches nothing that would let it authenticate a password while Account is
unavailable.** That is not an oversight to optimise away later — it is what makes
"no fallback" enforceable rather than aspirational.

### 11.1 Outage grace **[RESOLVED]** — X19

The contradiction it resolves: Account §16 said *"existing application sessions
continue"*; Auth PI-17 asked whether refresh should refuse or serve cached
state. Strict fail-closed would end **every session in the ecosystem within 5
minutes of any Account blip** — including Account's own, since it is a client.

**Policy:**

| # | Rule |
| --- | --- |
| 1 | Access token: **5 minutes** (V15, unchanged) |
| 2 | Auth caches `{status, credentials_changed_at}` per account with a **normal TTL of 60 seconds** |
| 3 | When Account is unavailable, an **existing grant** may refresh on stale security state for a maximum of **15 minutes after the last successful Account read**, then fails closed |
| 3a | Grace **also covers an already-authenticated SSO session resuming into another first-party application**, within the same 15-minute bound. Resuming is continuation of an authentication that already happened, not a new one. |
| 4 | **Grace never permits password or passkey authentication while Account is unavailable.** New authentication always requires a live Account read — structurally, since both verification and passkey lookup are Account operations |
| 5 | **Unknown status always fails closed and is never covered by grace** (V20) |
| 6 | **A cached `deleted` status is never covered by grace** |
| 7 | Grace **never extends the refresh-family absolute lifetime (30 d) or the SSO absolute lifetime (30 d)** |
| 8 | **Applications may not extend their own sessions indefinitely without successful token renewal** |
| 9 | **No operator-controlled extended-grace behaviour in V1** — the window is a fixed constant, not an incident-time lever |

**Rule 8 is what makes the rest meaningful.** An application session that renews
without a fresh token makes V15's five-minute revocation window fictional: a
revoked user would keep working until the application's own cookie expired.
Binding session continuation to successful refresh is what makes the revocation
window real — and it is precisely that binding which creates the outage problem
grace then bounds.

**Rule 9 matters more than it looks.** An operator-adjustable grace window would
be adjusted upward during an incident, under pressure, by whoever is on call —
which is exactly when revocation lag is least acceptable and judgement is worst.
A fixed constant cannot be widened in the moment.

### 11.2 What grace does not cover

Claims are **not** subject to grace because they are not fetched at refresh:
`name`, `given_name`, `family_name` and `preferred_username` come from the grant
record established at authorization. Only `status` and `credentials_changed_at`
require freshness, which is what the cache holds. This narrows the graced
surface from "identity" to "revocation state".

### 11.3 Security implications, stated plainly

A password change, recovery, or deletion made shortly before an Account outage
goes **unenforced for up to 15 minutes** — and only for grants that already
exist. Exploiting it requires already holding a valid refresh token, meaning the
session is already compromised.

For calibration: V15 already accepts a 5-minute unenforced window
unconditionally after global logout. Grace is 3× that, in a rare condition,
rather than a new category of risk.

**Every graced refresh is audited, and sustained grace use raises an alert** —
its presence means revocations are lagging, which is operationally significant
independent of any individual session.

The 15-minute constant is the one **reversible** parameter in this contract; if
operational data shows Account outages routinely exceed it, it can be revised by
contract amendment. It cannot be revised at incident time (rule 9).

---

## 12. Open questions

| # | Question | Blocks | Owner |
| --- | --- | --- | --- |
| **X23** | WebAuthn user verification — required or preferred | Ceremony | Auth |
| **X24** | Maximum passkeys per account | Registration | Joint |
| **X25** | Registration handoff mechanism — scope, ACR, or redirect contract | Registration | Joint |
| **X26** | Provider and database timeout budgets — reduced by §0.5 | Correctness | Joint |
| **X27** | Rate-limit thresholds on both sides | Brute-force defence | Joint |
| **X28** | Audit retention on both sides | Compliance | Joint |
| **X29** | Break-glass concrete mechanism | Operational readiness | Operator |
| **X31** | Whether `/userinfo` exists | Discovery document | Auth |
| **X33** | A federated subject resolving to a `deleted` account — refuse permanently, or create a new account for the same person | §5.10 | Joint |
| **X34** | Whether a person may unlink their only remaining sign-in method, and what happens if they do | §6.3, recovery | Joint |
| **X35** | What Auth does when a provider asserts a subject already linked, but with a different verified email — silently update, or treat as a security event | §5.10 | Joint |
| **X36** | Migration of the four surfaces signing in with Google today — Forge's `users`/`accounts`/`sessions`, and the static sites' browser-side client | Cutover | Joint |
| **X37** | Whether Account's own sign-in (V5, Account as an OIDC client of Auth) may itself be federated, or must remain password/passkey | Bootstrap ordering | Joint |

### Note — X32 is resolved

X32 was the first thing federation touched and it blocked everything downstream,
so it is resolved in §6.4 rather than left to a migration. Both columns become
nullable; neither is invented. X34 inherits the consequence — with both nullable,
an unlink can leave an account unreachable, which is why §6.4 states that an
account must retain at least one usable way in.

### Note — the recovery gap, and what closing it now requires

**[FACT]** Account today holds `user_id`, names, `password_hash` and status —
**no email, no phone, no recovery codes.** A `user_id` *may* be an email address,
but it is unverified and may not be one. A user who forgets their password and
has no passkey is permanently locked out.

§7.5 resolves the model. **It does not close the gap**, because every part of it
requires schema that is not authorized: the `recovery_codes` table (§6.1), two
`account_event_type` values (§6.2), and the idempotency store.

Until that authorization exists, **the lockout case remains live**, and it
sharpens as passkeys are promoted — a lost device becomes a lost account.
Recovery-code support should land **before** passkeys become a primary factor,
not after.

---

## 15. What one deployable removes **[RESOLVED]** — §0.5

Retained in full: §1 ownership (V6–V10, V24–V28), §2 lifetimes, §4 revocation,
§5's operations and their semantics, §6 schema designs, §7 ceremonies, §9.5
scopes and claims, §10 break-glass, §12's remaining questions.

Deferred, because each existed to protect a network hop that no longer exists:

| | Was | Now |
| --- | --- | --- |
| **§3** service authentication | Asymmetric signed assertions, `private_key_jwt`, key custody and rotation between two services | **Not required in V1.** The caller is the same process. §3 is retained as the specification to implement *if* the halves are ever split, and its `cap:` names stay as the module's internal permission vocabulary |
| **§11.1** outage grace | 15-minute bounded grace for cached security state during an Account outage | **Not required in V1.** The account half cannot be unreachable from the authentication half without the whole service being down. §11.2 and §11.3 stand |
| **§8** ceremony-write consistency | Cross-service write ordering | **Reduced to a transaction.** The guarantee is unchanged; the mechanism is the database's |
| **§9.2** timeouts | Per-call budgets across the interface | **Reduced.** Timeouts against the *provider* (§7.6) and the database remain and are still correctness, not tuning |

Closed by the same change:

| # | Was | Disposition |
| --- | --- | --- |
| **X21** | Private interface network topology and hostname | **Closed.** There is no network topology. One origin, `account.harithkavish.com` |
| **X22** | Replay nonce-cache location | **Closed.** No replayable network call exists. The provider nonce of §7.6 is separate and remains |
| **X26** | Timeouts, retry budgets, circuit-breaker thresholds | **Reduced to provider and database.** No inter-service budget to agree |
| **X30** | Auth hosting model | **Closed.** Auth is not separately hosted. Key custody is now only the token-signing key |

**What this does not do.** It does not merge the *data*. The account half owns
`users`, `user_identities`, `passkeys` and `recovery_codes`; the authentication
half owns sessions, codes and tokens, and reaches account data only through §5's
operations. A schema is not a licence to read across the boundary, and the first
query that does is the point at which splitting later stops being a refactor.

---

## 13. Implementation boundary

**Schema changes are authorized. Nothing else is.** **[RESOLVED — owner, 2026-08-29]**

Item 4 below is granted: the `passkeys`, `recovery_codes` and `user_identities`
tables, the idempotency store, the four `account_event_type` values, and making
`users.password_hash` and `users.user_id` nullable (§6.4). This was the single
gate every other piece of work stood behind, and it belonged to the owner alone.

Everything else in this section still authorizes no implementation.

Not authorized: any Auth implementation; any OIDC endpoint, flow or discovery
document; any WebAuthn code; **any provider flow, client registration or
federated ceremony**; **creating the `passkeys`, `recovery_codes` or
`user_identities` tables, or any other schema change**; adding any
`account_event_type` value;
generating or storing any recovery code; the private interface on either side;
generating any key or certificate; registering any client; any deployment; any
change to Account's application code.

**Current state, unchanged.** Account **[FACT]**: account creation, no login, no
sessions, no calls to `auth.harithkavish.com`. Auth **[FACT]**: static export, no
authentication, no credentials, no sessions, no tokens, no calls to Account.

### Before implementation may begin

1. ~~**Commit Account's `docs/`** so Auth can read the interface
   specification.~~ **[FACT] Done.** All three documents are on Account's `main`
   and readable by Auth. §0.1 is stale: **U6 is unblocked**, and Auth may not
   know it.
2. ~~**X30, Auth hosting**~~ **Closed by §0.5.** Auth is not separately hosted;
   atomicity is the database's.
3. **X26** — reduced by §0.5 to provider and database timeouts, which remain
   correctness rather than tuning.
4. ~~A **schema-change authorization**~~ **Granted (2026-08-29)** — see above.
   The ordering constraint it carried still binds: **recovery must land before
   passkeys or federation become a primary factor.** A federated-only account has
   exactly one way in, and it is one the ecosystem does not control.
5. ~~**X32**~~ **Resolved (§6.4).** Both columns become nullable. The migration
   that makes them so is itself unauthorized until item 4 is granted.
5. This document reviewed and accepted by both projects.
