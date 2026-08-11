# Account ↔ Auth Private Service Interface — Design

The private, non-public service interface between the **HarithKavish Account
Platform** and the **HarithKavish Auth Platform**.

| | |
| --- | --- |
| Document status | **SUPERSEDED** by [`account-auth-canonical-contract.md`](./account-auth-canonical-contract.md) v1.2 |
| Retained for | The rationale behind each requirement. The canonical contract carries the binding decisions. |
| Implementation status | See the canonical contract §13. |

> **Superseded — read the canonical contract instead.**
>
> This document was the Account-side design input to reconciliation. Where it
> and the canonical contract differ, **the canonical contract governs.** The
> substantive divergences, all resolved there:
>
> | This document | Canonical contract |
> | --- | --- |
> | 8 operations, including a separate status operation and an Account→Auth lifecycle channel | **7 operations.** Status folded into lookup (X3); lifecycle channel removed in favour of pull-based `credentials_changed_at` (X4, X5) |
> | Service authentication left open | **Signed service assertions** (X12) |
> | Passkey schema deferred | **Specified**, §6 |
> | No recovery mechanism | **Recovery codes**, §6.1 and §7.5 |
> | Failure behaviour open at refresh | **Bounded 15-minute grace**, §11.1 |
>
> It is kept because it records *why* each requirement exists, which the
> canonical contract compresses.

This document defines *what the interface must guarantee*. It does not define
paths, payload encodings, or wire formats, and it does not authorize building
any of it.

---

## How to read this document

| Marker | Meaning |
| --- | --- |
| **[REQUIRED]** | A binding requirement on the eventual implementation. |
| **[RESOLVED]** | Inherited from the contract; architecturally settled. |
| **[OPEN QUESTION]** | Genuinely undecided. Must not be resolved by implementation default. |

**Nothing here is implemented.** Where this document says "must", it constrains
future work; it does not describe present behaviour.

---

## Contents

- [1. Purpose, scope and direction](#1-purpose-scope-and-direction)
- [2. Security invariants](#2-security-invariants)
- [3. The permitted data surface](#3-the-permitted-data-surface)
- [4. Service-to-service authentication](#4-service-to-service-authentication)
- [5. Request authentication](#5-request-authentication)
- [6. Authorization and audience](#6-authorization-and-audience)
- [7. Replay protection](#7-replay-protection)
- [8. Idempotency](#8-idempotency)
- [9. Rate limiting](#9-rate-limiting)
- [10. Auditing](#10-auditing)
- [11. Error semantics](#11-error-semantics)
- [12. API versioning](#12-api-versioning)
- [13. Timeouts](#13-timeouts)
- [14. Failure behaviour](#14-failure-behaviour)
- [15. Logging requirements](#15-logging-requirements)
- [16. Operations](#16-operations)
- [17. The WebAuthn registration failure case](#17-the-webauthn-registration-failure-case)
- [18. Open questions](#18-open-questions)
- [19. Implementation boundary](#19-implementation-boundary)

---

## 1. Purpose, scope and direction

### What this interface is for

Auth performs authentication ceremonies but owns no identity data. Account owns
identity data but performs no authentication. This interface is the only
channel between them.

### Direction **[REQUIRED]**

The interface is **not symmetric**, and conflating its two directions is a
security error. There are two distinct channels:

| Channel | Caller | Callee | Operations |
| --- | --- | --- | --- |
| **A → C** | **Auth** | **Account** | Operations 1–7. Auth asks Account questions and makes narrowly permitted passkey mutations. |
| **C → A** | **Account** | **Auth** | Operation 8 only. Account informs Auth of lifecycle events. |

**Account never authenticates users. Auth never stores identity.** Neither
channel may be used to acquire the other's authority (§2).

### Not in scope

- Any user-facing surface of either platform
- The OIDC protocol surface (`/authorize`, `/token`, `/jwks`, `/userinfo`,
  `/end-session`) — that is Auth's public interface, defined in the contract §8
- **Account's own OIDC client credentials.** Account is a first-party client of
  Auth (contract R4). Those credentials are a *separate* thing from this
  interface's service credentials and must never be interchangeable (§2).

### Reachability **[REQUIRED]**

Not reachable from the public internet. Not routable from any user-facing
origin. Not discoverable from Account's public site. Network-level restriction
is required **in addition to** authentication, not instead of it.

---

## 2. Security invariants

These hold unconditionally. An implementation that violates one is wrong,
regardless of what else it achieves.

| # | Invariant | Enforced by |
| --- | --- | --- |
| **I1** | **`password_hash` never leaves Account.** No operation returns it, in whole, in part, or in derived form. | §3, Op 1 |
| **I2** | **The plaintext password is never logged, persisted or returned.** It exists only for the duration of a verification. | §10, §15, Op 1 |
| **I3** | **Auth cannot enumerate accounts.** No operation reveals whether an account exists except as a side effect of a *successful* authentication. | §11, Op 1–3 |
| **I4** | **Auth cannot retrieve password hashes.** There is no operation that returns credential material. | §3 |
| **I5** | **Auth cannot retrieve arbitrary Account data.** Only the fixed claim set and status are readable. | §3, Op 2–3 |
| **I6** | **Account cannot mint Auth tokens.** Account holds no token signing key and no operation causes token issuance. | §1, §6 |
| **I7** | **Account cannot impersonate an application.** Account's service identity is distinct from any OIDC client identity, including its own. | §4, §6 |
| **I8** | **Auth cannot modify arbitrary Account records.** The writable surface is an explicit allow-list of three passkey operations. | §3 |
| **I9** | **Passkey records remain owned by Account.** Auth holds no durable copy. | Op 4–7 |
| **I10** | **Auth owns WebAuthn ceremony state.** Challenges, and the in-flight ceremony, never live in Account. | §17, Op 4 |
| **I11** | **Every service request is authenticated.** No anonymous or network-trust-only access. | §4, §5 |
| **I12** | **Requests are audience-bound.** A request for one service, environment or operation class cannot be replayed against another. | §6 |
| **I13** | **Replay protection is mandatory** on every request. | §7 |
| **I14** | **Sensitive mutations require idempotency** wherever a retry is possible. | §8, §17 |

### On I3 — what "cannot enumerate" requires concretely

The anti-enumeration invariant is easy to state and easy to violate by
accident. It requires all of:

- **Verification failures are uniform.** "No such account" and "wrong password"
  must be indistinguishable to the caller — same error, same shape, same
  latency class. Account must perform equivalent work on a missing account as on
  a present one, so that timing does not leak existence.
- **Lookups are by opaque identifier only.** Identity and status lookups accept
  the account UUID, never the user ID. Auth may only look up an account it has
  already legitimately learned of.
- **No list, search, filter, count or pagination operation exists** anywhere in
  this interface. Not for accounts, not for passkeys across accounts.
- **Nothing reveals aggregate facts** — no totals, no "user ID available"
  probe, no differential error for a well-formed but unknown identifier.

> **Note on the internal audit trail.** I3 constrains what *Auth learns*. It
> does not constrain what *Account records about itself*. Account's own audit
> may distinguish "unknown account" from "bad password" — that distinction is
> operationally valuable and never crosses the boundary (§10).

---

## 3. The permitted data surface

An allow-list, not a deny-list. Anything not listed is forbidden. **[REQUIRED]**

| Account data | Auth may read | Auth may write |
| --- | --- | --- |
| `password_hash` | **Never** | **Never** |
| Plaintext password | Submits it for verification (Op 1); receives it back never | **Never** |
| `id` (account UUID) | Yes — returned on successful verification only | Never |
| `user_id` | Yes — as `preferred_username`, by UUID | **Never** |
| `first_name`, `last_name` | Yes — as claims, by UUID | **Never** |
| `status` | Yes — by UUID | **Never** |
| `created_at`, `updated_at`, deletion timestamps | **Never** | **Never** |
| Passkey credential records | Yes (Op 5) | **Create, delete, counter-update only** (Op 4, 6, 7) |
| `account_events` | **Never** | **Never** — Account writes its own audit |
| Any other table or column, present or future | **Never** | **Never** |

**Auth's total mutation authority over Account is three operations on one
concept.** It cannot change a name, a user ID, a password or a status. Account
status transitions are driven by the user through Account's own surfaces, never
by Auth.

---

## 4. Service-to-service authentication

**[RESOLVED]** that the mechanism must be strong: a static bearer secret in a
header, alone, is **not sufficient**.

**[OPEN QUESTION]** which mechanism. The two candidates are compared here. **This
document does not choose between them.**

### Candidate A — mutual TLS

Both sides present certificates; the TLS channel itself carries identity.

| | |
| --- | --- |
| **Strengths** | Authentication below the application layer, so application code cannot forget it. No credential in the request payload to leak into a log. Channel binding is inherent. Mature, well-understood operationally. |
| **Weaknesses** | Certificate issuance, distribution, rotation and expiry monitoring are a standing operational burden. Authenticates the *channel*, not the individual request — per-request replay protection and audience binding must still be added separately (§6, §7). |
| **Platform constraint** | **Account currently runs on a platform that terminates TLS at the edge.** Whether a client certificate can be presented to, and verified by, the application is a hard prerequisite that must be established before this option can be chosen. This is not a preference question — it may simply be unavailable. |

### Candidate B — signed service assertions

The caller presents a short-lived assertion signed with its private key,
verified against a published public key.

| | |
| --- | --- |
| **Strengths** | Works over ordinary HTTPS through any proxy, CDN or edge platform — no dependence on TLS termination behaviour. Naturally per-request: audience, expiry, unique identifier and a request-body digest can all be bound into the assertion, satisfying §6 and §7 in the same construct. **Reuses machinery the ecosystem has already committed to** — asymmetric signing with published keys and rotation (contract R23). |
| **Weaknesses** | Verification is application code, and application code can be written wrongly — algorithm confusion, missing audience checks, absent expiry validation are all classic failures. Requires reasonable clock synchronisation. Requires a replay cache for assertion identifiers (§7). Private key custody on both sides. |
| **Platform constraint** | None material. |

### Candidate C — both

mTLS for the channel, signed assertions for per-request binding. Strictly
stronger than either alone; strictly more operational surface. Listed because it
is a legitimate answer, not because it is recommended here.

### Decision inputs **[REQUIRED before choosing]**

1. **Can Account's hosting platform expose and verify a client certificate?**
   If not, Candidate A is eliminated on feasibility, not merit.
2. Where do private keys and certificates live, and how are they rotated
   without downtime?
3. Does the chosen mechanism satisfy §6 and §7 by itself, or must they be
   layered on top?

Whichever is chosen, the requirements in §5, §6 and §7 must all be met.

---

## 5. Request authentication

**[REQUIRED]** on every request, on both channels, without exception.

- **No anonymous access.** No health, status or diagnostic path on this
  interface may be unauthenticated.
- **Network position is not authentication.** Being inside the network boundary
  establishes nothing on its own. The network restriction (§1) and the
  authentication requirement are independent controls; neither substitutes for
  the other.
- **The caller's identity must be established before any work is performed** —
  before the request body is parsed, before any lookup, and in particular before
  any password verification is attempted.
- **Failed authentication must consume rate-limit budget** (§9) and be audited
  (§10).
- **Credential compromise must be recoverable** without redeploying either
  platform: rotation must be an operational action, not a code change.
- **Both directions authenticate.** Channel C → A (Op 8) is not exempt because
  it carries no credential material — an unauthenticated revocation channel
  would let an attacker revoke arbitrary sessions, or suppress genuine
  revocations.

---

## 6. Authorization and audience

Authentication establishes *who is calling*. Authorization establishes *what
that caller may do*. Both are required. **[REQUIRED]**

- **Exactly one caller is authorized on channel A → C: the Auth service.** There
  is no second consumer, no admin client, no debugging client.
- **Requests must be audience-bound.** A request must name the service and
  environment it is intended for, and the recipient must reject any request not
  addressed to itself. A request captured in one environment must be useless in
  another.
- **Environment isolation is absolute.** A development or preview credential
  must never be accepted by production, and vice versa. Contract §6 and the
  existing separation of Account's environments make this concrete and
  achievable.
- **Operation-level authorization.** Authorization is per operation, not
  per interface. A credential authorized for identity lookup is not thereby
  authorized to delete a passkey.
- **This interface's credentials must not be accepted at Auth's OIDC
  endpoints**, and Account's OIDC client credentials must not be accepted here
  (invariants I6, I7). They are separate credential domains that happen to
  involve the same two parties.

---

## 7. Replay protection

**Mandatory on every request** (I13), independent of which service
authentication mechanism is chosen. **[REQUIRED]**

Operation 1 makes this non-negotiable: a captured verification request contains
a user's plaintext password. Replay protection limits the window in which a
captured request is useful, and the audit trail (§10) makes replay visible.

Required properties:

| Property | Requirement |
| --- | --- |
| **Freshness** | Every request carries a timestamp or short expiry. Requests outside a narrow acceptance window are rejected. |
| **Uniqueness** | Every request carries a unique identifier. A repeated identifier within the acceptance window is rejected. |
| **Body integrity** | The authenticated envelope must cover the request body, so a captured request cannot be altered and re-sent. |
| **Rejection is loud** | A detected replay is a security event: rejected, audited at high severity, rate-limit-consuming. |

**Replay protection and idempotency are different mechanisms with different
purposes and must not be conflated** (§8).

**[OPEN QUESTION]** — the acceptance window duration, and where the
uniqueness cache lives. Account already operates a Redis instance suitable for
this; whether it is reused, and how its availability affects fail-closed
behaviour (§14), is undecided.

---

## 8. Idempotency

Where a retry is possible, a repeat must not cause a second effect (I14).
**[REQUIRED]**

### The distinction from replay protection

They pull in opposite directions and both are required:

| | Replay protection | Idempotency |
| --- | --- | --- |
| Purpose | Reject a **hostile** repeat | Absorb a **legitimate** retry safely |
| Response to a repeat | **Reject** | **Return the original outcome** |
| Scope | Every request | Mutating operations |

A retry after a timeout is legitimate and must succeed idempotently. A captured
request re-sent by an attacker must be rejected. **The distinguishing factor is
the caller's intent expressed through an idempotency key**, not the fact of
repetition — so a retry must reuse the *same* idempotency key while carrying a
*fresh* replay-protection envelope.

### Requirements

- **Every mutating operation carries a caller-generated idempotency key.**
- **A repeat with the same key and same parameters returns the original
  outcome**, including the original identifiers, without performing the effect
  twice.
- **A repeat with the same key and different parameters is a conflict** and
  must be rejected, not silently applied.
- **Idempotency records must outlive the caller's entire retry budget** (§13).
- **Natural idempotency should be preferred where it exists.** Passkey creation
  has a natural key — the credential ID is globally unique and authenticator-
  generated (§17). Counter updates are naturally idempotent if applied
  monotonically (Op 7). Explicit keys complement these; they do not replace
  them.

---

## 9. Rate limiting

**[REQUIRED]**, and independent of the public site's limits. Exhausting the
public signup limiter must not affect this interface, and vice versa.

| Dimension | Requirement |
| --- | --- |
| **Per operation** | Verification requires a far tighter limit than identity lookup. One limit for the whole interface is insufficient. |
| **Per account** | Repeated verification failures against a single account must throttle, independently of total request volume. This is the online-guessing control. |
| **Per caller** | A global ceiling for the Auth service, bounding damage from a compromised or looping caller. |
| **Failed authentication and detected replay** | Consume budget (§5, §7). |

**Rate limiting must not become an enumeration oracle** (I3): a limit response
must not reveal whether the account in question exists.

**[OPEN QUESTION]** — concrete thresholds and windows, and the relationship
between this per-account throttle and any user-facing lockout policy. A lockout
policy is a product decision with real denial-of-service implications and is not
settled here.

---

## 10. Auditing

### What must be audited **[REQUIRED]**

| Event | Severity |
| --- | --- |
| Every credential verification attempt, with outcome | High |
| Every passkey creation, deletion and counter update | High |
| Every service authentication failure | High |
| Every detected replay | High |
| Every rate-limit rejection | Medium |
| Every identity and status lookup | Low, but recorded |
| Every lifecycle event sent to Auth, with delivery outcome | Medium |

### What every audit record must contain

Caller identity; operation; correlation identifier (§15); timestamp; outcome;
and the account UUID **where one is known**.

### What no audit record may ever contain **[REQUIRED]**

- **The plaintext password** (I2) — not truncated, not hashed, not "redacted"
  in a way that preserves length or shape
- **`password_hash`** or any part of it (I1)
- Service credentials, assertion values, or session material

> **The user ID presented in a failed verification requires care.** Recording it
> is operationally useful and reveals nothing Account does not already hold —
> but it must be treated as user-supplied and potentially another person's
> identifier. **[OPEN QUESTION]** whether failed-attempt identifiers are
> recorded in full, and for how long.

### Where audit records live

Account's existing `account_events` table is **not** the right home for
interface auditing. It is a user-facing account-lifecycle trail with a fixed,
schema-constrained event vocabulary and a nullable subject. Service-interface
auditing has different retention, different access controls, and different
volume.

**[OPEN QUESTION]** — where interface audit records live. Note that using
`account_events` would require a schema change, which is **not authorized**
(§19).

---

## 11. Error semantics

### The distinction that matters most **[REQUIRED]**

> **"This credential is wrong" and "I could not determine whether this
> credential is wrong" must be different, unambiguous outcomes.**

Collapsing them is the single most dangerous error-handling mistake available
here. A verification that fails because Account is unreachable must never be
reported as, or coerced into, a failed authentication — nor the reverse. Auth
must be able to distinguish them without inference, and must behave differently
for each (§14).

### Categories

| Category | Retryable | Notes |
| --- | --- | --- |
| Authentication failed (service) | No | Fix credentials; do not retry blindly |
| Not authorized | No | |
| Malformed request | No | |
| Replay detected | No | Security event |
| Idempotency conflict | No | Same key, different parameters (§8) |
| Rate limited | Yes, after a delay | Must carry retry guidance |
| Not found | No | Must be uniform (I3) |
| Conflict | Depends on operation | See Op 4 |
| Internal error | Yes, with backoff | |
| Unavailable / timeout | Yes, with backoff | The §17 case |

**Retryability must be explicit in the response, not inferred from a status
code.** The passkey registration case (§17) depends entirely on the caller
knowing whether a retry is safe and expected.

### What error responses must never reveal **[REQUIRED]**

Whether an account exists (I3); any credential material; internal identifiers,
query fragments, stack traces or dependency names; or which layer failed in
enough detail to map Account's internals.

---

## 12. API versioning

**[REQUIRED]**

- **Every request states the interface version it targets.** The recipient
  rejects versions it does not implement rather than guessing.
- **Within a version, changes are additive only.** Adding an optional field is
  permitted. Removing a field, renaming one, narrowing a type, changing a
  default, or altering the meaning of an existing value is a breaking change.
- **Breaking changes require a new version**, and both versions must be served
  simultaneously for long enough to migrate — the two platforms deploy
  independently and will never be in lockstep.
- **Version negotiation must not be silent.** A version mismatch is an explicit,
  audited error, never a fallback to a default.
- **Security-relevant semantics are never changed within a version.** Tightening
  a rule is a new version, so that an older caller cannot continue under the old
  interpretation unnoticed.

**[OPEN QUESTION]** — the concrete versioning mechanism, and the deprecation
window. Both platforms must agree before either ships.

---

## 13. Timeouts

**[REQUIRED]**

- **Every request has an explicit client-side timeout.** No unbounded waits.
- **Connect, read and total timeouts are set separately**; a total-only timeout
  hides a slow-dependency failure mode.
- **Verification's timeout must accommodate deliberate slowness.** Argon2id is
  intentionally expensive — that is its purpose. A timeout tuned for a trivial
  lookup will fail verification under normal conditions and, worse, will fail it
  intermittently under load. Its timeout must be derived from measured hashing
  cost plus headroom, not from a generic default.
- **The timeout budget must fit inside the user-facing request budget.** A login
  that has already exceeded what a user will wait for should fail cleanly rather
  than complete into an abandoned request.
- **Retries are bounded and use backoff with jitter.**
- **Only idempotent operations may be retried** — and mutating operations only
  when carrying an idempotency key (§8).
- **The retry budget must be shorter than the idempotency record's lifetime**
  (§8), or a late retry will be treated as a new request.

**[OPEN QUESTION]** — concrete timeout values and retry budgets. These depend on
measured Argon2id cost on production hardware and on the eventual hosting
topology, neither of which is settled. **They must not be defaulted into
existence.**

---

## 14. Failure behaviour

### Fail closed **[REQUIRED]**

**If Account cannot be reached, or returns an ambiguous result, authentication
does not succeed.** There is no degraded mode in which authentication proceeds
on partial information.

### Behaviour by operation

| Operation | If Account is unavailable |
| --- | --- |
| Credential verification | **Authentication fails.** Reported to the user as a service problem, **not** as a wrong password — the distinction is honest and prevents a user from changing a password that was never wrong. |
| Identity lookup | Token issuance fails. No token with guessed or stale claims. |
| Status check | **Fail closed** at authentication. On refresh, behaviour depends on contract OQ2, still open. |
| Passkey lookup | Passkey authentication fails. **Must not fall back to password** — a silent downgrade of authentication strength is a security regression. |
| Passkey create | See §17. |
| Passkey delete | Fails. Must not report success. A user told a credential was removed when it was not is a security failure. |
| Counter update | See Op 7 — the one place where best-effort may be acceptable, and it is **[OPEN QUESTION]**. |

### The prohibition **[REQUIRED]**

**No fallback authentication path may be introduced in response to any failure
mode described here.** Contract §16 states this for the ecosystem; it applies
with full force to this interface. An outage is not a justification for a second
way in.

---

## 15. Logging requirements

### Never logged, on either side **[REQUIRED]**

- **The plaintext password** (I2) — in any form, at any level, including debug
  builds and error paths. Request-body logging must be impossible to enable for
  the verification operation, not merely disabled by configuration.
- **`password_hash`** (I1)
- Service credentials, assertion values, private keys, certificates
- Passkey **private** material — which neither party ever possesses

### Always logged

- A **correlation identifier**, generated at the start of a user-facing flow at
  Auth, propagated across the interface, echoed in Account's response, and
  present in both platforms' records. Without it, an incident spanning both
  platforms cannot be reconstructed.
- Operation, version, caller identity, outcome, duration.

### Structural requirements

- **Error paths are the highest-risk logging site.** An exception handler that
  serialises the request context for diagnostics is the most likely route by
  which a plaintext password reaches a log. Verification's request body must be
  structurally excluded from error serialisation.
- Logs crossing a trust boundary — to an aggregator or third-party provider —
  carry the same prohibitions.
- **Operational logs and audit records are different things** (§10) with
  different retention and access. Do not conflate them.

---

## 16. Operations

Eight operations. Nothing outside this set exists on this interface.

---

### Operation 1 — Credential verification

| | |
| --- | --- |
| **Caller** | Auth (channel A → C) |
| **Purpose** | Determine whether a presented plaintext password matches Account's stored Argon2id hash for a given user identifier. |
| **Allowed input** | The user-supplied login identifier; the plaintext password; interface version; correlation identifier; replay envelope. |
| **Forbidden input** | Any hash or partial hash. Any request for the stored hash. Any wildcard, list, pattern or "verify against any account" form. Any parameter that would alter hashing parameters or bypass verification. |
| **Output — success** | A positive verdict, **the account UUID**, and the account status (§14 of the contract). |
| **Output — failure** | A **single uniform negative result** covering both "no such account" and "wrong password", indistinguishable in content, shape and latency class (I3). |
| **Authentication** | Required (§4, §5). Established **before** the password is read from the request. |
| **Authorization** | Auth service principal only; audience-bound (§6). |
| **Idempotent?** | **In effect, yes** — repeating produces the same verdict and creates no durable state. **But not free**: each call consumes rate-limit budget (§9) and produces an audit record (§10). It must not be retried casually. |
| **Replay-sensitive?** | **Extremely.** This is the highest-value request on the interface: a captured request contains a user's plaintext password. Replay protection is mandatory and non-negotiable (§7). |
| **Audit** | Every attempt: caller, correlation ID, timestamp, outcome, account UUID where known. **Never the password** (I2). Account's internal record may distinguish "unknown account" from "bad password"; that distinction must never cross the boundary. |
| **Failure behaviour** | Unreachable or ambiguous ⇒ **not a failed authentication** but an inability to authenticate (§11, §14). Auth must surface a service error, must not report a wrong password, and must not fall back. |

**Additional requirements:**

- **Equivalent work on a missing account.** Account must perform a comparable
  hashing operation when no account matches, so response time does not disclose
  existence.
- **The plaintext is held in memory only**, for the duration of the operation,
  and is never written anywhere (I2).
- **Rehash-on-verify**, if Argon2 parameters are ever raised, happens inside
  Account and is invisible across the interface.

---

### Operation 2 — Account identity lookup

| | |
| --- | --- |
| **Caller** | Auth (channel A → C) |
| **Purpose** | Retrieve the minimal claim set for token issuance. |
| **Allowed input** | **The account UUID only.** Interface version; correlation identifier; replay envelope. |
| **Forbidden input** | **The user ID as a lookup key** — that would be an enumeration oracle (I3). Any list, filter, search, pattern, range or pagination parameter. Any field-selection parameter that could widen the response. |
| **Output** | Exactly the contract's fixed claim set: `sub`, `name`, `given_name`, `family_name`, `preferred_username`. **Nothing else** (I5). |
| **Authentication** | Required. |
| **Authorization** | Auth service principal; audience-bound. |
| **Idempotent?** | Yes — read-only, no state change. |
| **Replay-sensitive?** | Low — carries no credential and reveals only data Auth is already entitled to. Replay protection still applies uniformly (§7). |
| **Audit** | Recorded at low severity. Anomalous volume is a signal worth alerting on. |
| **Failure behaviour** | Unavailable ⇒ token issuance fails. **No token may be issued with stale, cached or partial claims.** |

**Note:** lookup by UUID only is the structural control behind I3. Auth can only
ask about accounts it has already legitimately learned of — from a successful
verification (Op 1) or an existing grant.

---

### Operation 3 — Account status

| | |
| --- | --- |
| **Caller** | Auth (channel A → C) |
| **Purpose** | Apply the contract's V1 authentication matrix: `active` → allowed; `deletion_requested` → **allowed**, so the user can cancel; `deleted` → refused. |
| **Allowed input** | The account UUID only; version; correlation ID; replay envelope. |
| **Forbidden input** | The user ID as a key. Any list or bulk form. Any parameter implying a status *change* — Auth cannot write status (I8). |
| **Output** | Exactly one of `active`, `deletion_requested`, `deleted`. No timestamps, no reason, no history. |
| **Authentication** | Required. |
| **Authorization** | Auth service principal; audience-bound. |
| **Idempotent?** | Yes — read-only. |
| **Replay-sensitive?** | Low. Uniform protection still applies. |
| **Audit** | Recorded. Status checks that precede a refusal are of particular interest. |
| **Failure behaviour** | **Fail closed at authentication.** For refresh, the required behaviour depends on contract OQ2 (per-refresh check versus pushed revocation), which is still open — this operation's role in refresh cannot be finalised until that is. |

**[OPEN QUESTION]** — whether status is a distinct operation or is folded into
Operation 2. Folding reduces round trips on the login path; separating keeps a
frequently-polled check cheap and independently rate-limited. **Not resolved
here.**

---

### Operation 4 — Passkey credential creation

| | |
| --- | --- |
| **Caller** | Auth (channel A → C), **after** it has completed and verified a WebAuthn registration ceremony as Relying Party (RP ID `auth.harithkavish.com`). |
| **Purpose** | Persist the credential record that Account owns (I9). |
| **Allowed input** | Account UUID; credential ID; credential public key; initial signature counter; authenticator transports; authenticator model identifier; a user-supplied label; **an idempotency key** (§8); version; correlation ID; replay envelope. |
| **Forbidden input** | Any private key material — which does not exist and is never possessed by either party. **WebAuthn ceremony state** — challenges and in-flight ceremony data belong to Auth alone (I10) and must never be persisted in Account. Any parameter that would modify non-passkey account data (I8). |
| **Output** | The stored record's identifier, **and an explicit indicator of whether this call created the record or found it already present**. That indicator is what makes safe retry possible (§17). |
| **Authentication** | Required. |
| **Authorization** | Auth service principal; audience-bound. Auth may create a credential **only** for the account UUID it names, and creation is permitted only as the result of a completed ceremony. |
| **Idempotent?** | **MUST BE.** This is the most idempotency-critical operation on the interface. See §17. |
| **Replay-sensitive?** | Yes — a mutation. Replay protection rejects hostile repeats; idempotency absorbs legitimate retries (§8). |
| **Audit** | High severity. Adding an authentication factor is a security-relevant change to the account. Account should also record a user-visible lifecycle event — **but see the schema constraint below.** |
| **Failure behaviour** | **§17 in full.** The response must state unambiguously whether a retry is safe. |

**Structural requirements:**

- **The credential ID is the natural idempotency key.** It is generated by the
  authenticator and globally unique. A uniqueness constraint on it is the
  mechanism that makes duplicate creation impossible rather than merely
  unlikely.
- **A credential ID already bound to a *different* account must be rejected**,
  never reassigned. A credential belongs to exactly one account.
- **A credential ID already bound to the *same* account is a successful
  idempotent repeat**, not an error (§17).

> **Schema note.** No `passkeys` table exists, and creating one is **not
> authorized** (§19). The `account_event_type` enum also has no passkey-related
> value, so a user-visible passkey lifecycle event would require a schema
> change. Both are deferred; neither is resolved by this document.

---

### Operation 5 — Passkey credential lookup

| | |
| --- | --- |
| **Caller** | Auth (channel A → C), to verify an assertion or to render management UI. |
| **Purpose** | Retrieve stored public keys and metadata needed to verify a WebAuthn assertion. |
| **Allowed input** | **Either** an account UUID (when the user is already identified) **or** a credential ID (for discoverable-credential sign-in, where the credential identifies the user). Version; correlation ID; replay envelope. |
| **Forbidden input** | Any form that returns credentials across accounts. Any list, filter, search or pagination over the credential set as a whole. Any partial or prefix match on credential ID. |
| **Output** | For the identified account: credential ID, public key, current counter, transports, label, creation time. Public keys are not secret; **no other account's data, and no non-passkey account data, may be returned** (I5). |
| **Authentication** | Required. |
| **Authorization** | Auth service principal; audience-bound. |
| **Idempotent?** | Yes — read-only. |
| **Replay-sensitive?** | Low. Uniform protection applies. |
| **Audit** | Recorded. Lookups by credential ID that miss are of particular interest — a burst is a probing signal. |
| **Failure behaviour** | Unavailable ⇒ **passkey authentication fails**. It must **not** silently fall back to password authentication: that is an unannounced downgrade of authentication strength. |

**Note on lookup by credential ID.** Discoverable credentials require it — the
authenticator supplies a credential ID and no user identifier. This is
acceptable within I3 because credential IDs are high-entropy and unguessable,
but it demands: a **uniform miss response**, no timing differential, and its own
rate limit (§9).

---

### Operation 6 — Passkey credential deletion

| | |
| --- | --- |
| **Caller** | Auth (channel A → C), after a user removes a passkey through Auth-hosted management (contract R10). |
| **Purpose** | Remove a credential record Account owns. |
| **Allowed input** | Account UUID; credential ID; **idempotency key**; version; correlation ID; replay envelope. |
| **Forbidden input** | Any bulk or wildcard deletion. Any form that deletes by account alone without naming a credential. Any parameter touching non-passkey data (I8). |
| **Output** | Confirmation, **and whether the credential existed before the call**. |
| **Authentication** | Required. |
| **Authorization** | Auth service principal; audience-bound. The credential must belong to the named account — a mismatch is a rejection, not a no-op. |
| **Idempotent?** | **Yes, and required to be.** Deleting an already-deleted credential **succeeds**; it must not error. Retry after a timeout must converge. |
| **Replay-sensitive?** | Yes — destructive. Replay protection plus idempotency (§8). |
| **Audit** | **High severity.** Removing an authentication factor is exactly the action an attacker performs after account takeover, and exactly the action a user needs a record of. |
| **Failure behaviour** | Ambiguous outcome ⇒ **must not report success.** A user told a credential was removed when it was not may believe a lost device is no longer a risk. |

**Note.** Account may also delete its own credential records directly — e.g.
during account deletion. That is internal and requires no interface operation.
This operation exists solely for Auth-initiated removal.

---

### Operation 7 — Passkey sign-counter update

| | |
| --- | --- |
| **Caller** | Auth (channel A → C), after a successful assertion. |
| **Purpose** | Persist the authenticator's signature counter, the WebAuthn mechanism for detecting cloned authenticators. |
| **Allowed input** | Account UUID; credential ID; new counter value; last-used timestamp; version; correlation ID; replay envelope. |
| **Forbidden input** | Any change to the public key, credential ID, or account binding. This operation updates a counter and a timestamp; it is not a general credential-update operation. |
| **Output** | Confirmation and the stored counter value after the call. |
| **Authentication** | Required. |
| **Authorization** | Auth service principal; audience-bound; credential must belong to the named account. |
| **Idempotent?** | **Yes, if applied monotonically** — storing the greater of the current and submitted values makes repeats harmless and retries safe. Monotonic application is **[REQUIRED]** regardless of the policy question below. |
| **Replay-sensitive?** | Yes — but monotonic application bounds the harm: a replayed **older** counter must never lower the stored value. |
| **Audit** | Recorded. **A counter regression is a security signal** — potential authenticator cloning — and must be audited at high severity even if it is not enforced. |
| **Failure behaviour** | **[OPEN QUESTION]** — see below. |

> **[OPEN QUESTION] — the counter policy, and it is genuinely difficult.**
>
> The assertion has already succeeded when this call is made. If the update
> fails, Auth must choose between failing an authentication that was
> cryptographically valid, or accepting it and losing cloning-detection
> fidelity.
>
> The tension is real in both directions: some authenticators legitimately do
> not increment counters at all, so strict enforcement causes false positives;
> but treating updates as best-effort weakens the only cloning signal WebAuthn
> provides.
>
> **Whether counters are enforced, what a regression means, and whether a failed
> update blocks authentication must be decided together.** This document does
> not decide them.

---

### Operation 8 — Account lifecycle and revocation information

**Note the direction: this is the only operation on channel C → A.** Account is
the caller; Auth is the recipient.

| | |
| --- | --- |
| **Caller** | **Account** (channel C → A) |
| **Purpose** | Inform Auth of account lifecycle changes so it can revoke sessions and token families. |
| **Allowed input** | Event identifier; event type; account UUID; occurrence timestamp; a monotonic sequence or version for ordering; correlation ID; replay envelope. |
| **Forbidden input** | Any credential material. Any profile data beyond the account UUID — this channel conveys *that something happened*, not *what the account now contains*. Any instruction to Auth beyond the defined event vocabulary; Account must not be able to direct Auth's behaviour arbitrarily (I6). |
| **Output** | Acknowledgement of durable receipt. |
| **Authentication** | **Required — in this direction too** (§5). An unauthenticated revocation channel would allow forged revocation of arbitrary sessions, or suppression of genuine ones. |
| **Authorization** | Account service principal; audience-bound to Auth. |
| **Idempotent?** | **Must be.** Delivery is at-least-once; the same event identifier delivered twice must produce one effect. |
| **Replay-sensitive?** | Yes — **and ordering-sensitive**, which is the harder property. A replayed or late-arriving stale event must not undo a newer state; hence the ordering field. |
| **Audit** | Both sides record emission and receipt, including delivery failures and retries. |
| **Failure behaviour** | Undelivered revocation is a **security-relevant backlog**, not a routine queue. It must be retried, must be visible, and must alert if it persists — a revocation that silently never arrives leaves a session alive that should be dead. |

**Event vocabulary and required effect:**

| Event | Effect at Auth |
| --- | --- |
| Password changed | Revoke token families established with the old credential |
| Deletion **requested** | **No authentication change** — the user may still sign in to cancel (contract R11) |
| Deletion **cancelled** | No change — the account was never restricted |
| Account **deleted** | Revoke everything; refuse further authentication and refresh |

These correspond to `account_event_type` values that already exist in Account's
schema **[FACT]**. **No delivery mechanism exists**, and building one is not
authorized (§19).

**[OPEN QUESTION]** — push versus pull. Account pushing to Auth gives prompt
revocation but requires Account to know an Auth endpoint, retry, and hold a
backlog. Auth polling Account inverts the coupling but delays revocation. This
is the same decision as contract OQ2 and must be made once, for both.

---

## 17. The WebAuthn registration failure case

The interface's hardest correctness problem, called out separately because a
plausible implementation gets it wrong and the failure is silent.

### The scenario

1. The user completes a WebAuthn registration ceremony — they touch their
   security key or approve a biometric prompt. **The authenticator has now
   created a credential and stored it on the device. This is irreversible from
   the server's side.**
2. Auth verifies the attestation successfully. As Relying Party, it holds a
   valid, verified credential.
3. Auth calls Operation 4 to persist the record in Account.
4. **That call times out.**

Auth does not know whether Account committed the record. Both are possible.

### Why the obvious responses are wrong

| Response | Failure |
| --- | --- |
| **Retry the whole ceremony** | **The most damaging option.** The authenticator creates a *new* credential with a *different* credential ID. If the first write did commit, the account now holds two credentials, one of which the user never knowingly created and may never be able to use. |
| **Report failure and stop** | If the write did commit, a working credential exists that the user has been told does not. They may discard their password believing they have no passkey, or keep a device they think is unregistered. |
| **Report success optimistically** | If the write did not commit, the user believes they have a passkey they do not have. **This is the most dangerous of the three** — they may remove another factor in reliance on it. |
| **Retry the write with a fresh identifier** | Identical outcome to re-running the ceremony: duplicates. |

### What the protocol must guarantee **[REQUIRED]**

**G1 — The ceremony result must be durable at Auth before the write is
attempted.**
Auth must persist the verified ceremony outcome — credential ID, public key,
initial counter, target account — before calling Operation 4, so that a retry
replays *the write*, never *the ceremony*. **This is the guarantee that makes
every other one possible.** Ceremony state belongs to Auth (I10); this is where
that ownership becomes load-bearing.

**G2 — Retry the write, never the ceremony.**
A failed or ambiguous write must never cause the user to be prompted again.
Re-prompting produces a different credential ID and is the direct cause of
duplicates.

**G3 — Creation is idempotent on the credential ID.**
The credential ID is authenticator-generated and globally unique. A repeated
create for the same account and the same credential ID must **succeed and return
the existing record**, not create a second row and not error. A uniqueness
constraint makes this structural rather than a matter of application care.

**G4 — A credential ID bound to a different account is rejected.**
Idempotency applies only within the same account binding. A credential ID
appearing under a different account is a conflict and an anomaly, never a
reassignment.

**G5 — The response distinguishes "created" from "already existed".**
Both are success. The distinction lets Auth reconcile without guessing and lets
it audit accurately.

**G6 — There is a terminal reconciliation path.**
When retries are exhausted, Auth must resolve ambiguity by **querying**
(Operation 5, by credential ID) rather than assuming. Every registration must
end in a determinate state: registered, or not registered. **"Unknown" must not
be a resting state.**

**G7 — User-visible truth comes from Account, not from the ceremony.**
The interface must not report a passkey as registered until Account has
confirmed persistence. Ceremony success is necessary but not sufficient — the
credential is not registered until the record Account owns exists.

**G8 — Idempotency records outlive the retry budget.**
An idempotency key that expires mid-retry converts a safe retry into a duplicate
(§8, §13).

### The residual case, stated honestly

One case cannot be engineered away: Account commits, the response is lost, Auth
exhausts its retries and reconciliation is *also* unavailable. The user is told
registration failed. They retry from the beginning, producing a second, genuine
ceremony and a second, legitimate credential.

The account now holds two working credentials. **This is untidy but not
unsafe** — both belong to the user, both were created by their authenticator,
neither is attacker-controlled.

The mitigation is not protocol machinery but **management UI**: passkeys must be
listed with enough context — label, creation time, authenticator model — for a
user to recognise and remove a redundant entry. **Registration must be designed
so that its worst realistic failure is a duplicate the user can see and delete,
never a credential they believe in but do not have, and never one they have but
do not know about.**

---

## 18. Open questions

Genuinely undecided. **None may be resolved by implementation default.**

| # | Question | Section |
| --- | --- | --- |
| **P1** | **Service authentication mechanism** — mTLS, signed assertions, or both. **Blocked on a feasibility check**: can Account's hosting platform expose and verify a client certificate at all? | §4 |
| **P2** | **Replay window duration and uniqueness-cache location**, and how that cache's own availability interacts with fail-closed behaviour. | §7 |
| **P3** | **Rate-limit thresholds**, and the relationship between per-account throttling and any user-facing lockout policy. | §9 |
| **P4** | **Where interface audit records live**, given `account_events` is unsuitable and changing it is not authorized. | §10 |
| **P5** | **Whether failed-attempt identifiers are recorded in full**, and their retention. | §10 |
| **P6** | **Versioning mechanism and deprecation window.** | §12 |
| **P7** | **Timeout values and retry budgets**, dependent on measured Argon2id cost and final hosting. | §13 |
| **P8** | **Status as a distinct operation or folded into identity lookup.** | Op 3 |
| **P9** | **Passkey counter policy** — enforced or not; what a regression means; whether a failed update blocks an already-successful authentication. | Op 7 |
| **P10** | **Lifecycle delivery — push or pull.** Same decision as contract OQ2; must be made once for both. | Op 8 |
| **P11** | **Passkey record schema** — fields, and whether a passkey lifecycle event type is added to `account_event_type`. Both require schema changes that are **not authorized**. | Op 4 |

### Inherited from the contract, still open

Contract OQ1 (service auth — same as P1), OQ2 (status enforcement on refresh —
same as P10), OQ3 (remaining token lifetimes), OQ4 (Auth hosting), OQ6 (operator
break-glass mechanism), OQ7 (Account's own client registration), OQ9 (counter
policy — same as P9).

---

## 19. Implementation boundary

**This document does not authorize implementation of anything.**

It is a design artifact. It defines what the interface must guarantee so that
both projects can build against a shared understanding — later, under a separate
authorization.

### Explicitly not authorized

- Implementing any operation described here, on either side
- Creating any endpoint, route, handler or client
- Choosing or configuring a service authentication mechanism
- Issuing certificates, generating service keys, or provisioning credentials
- **Creating a `passkeys` table**, or any schema for passkey records
- **Adding any value to `account_event_type`**, including passkey events
- **Any change to Account's database schema**
- Building the lifecycle delivery mechanism
- Deploying anything
- Modifying Account's application code

### Current state, restated

Account is what the contract §3 describes: account creation, no login, no
sessions, **no communication of any kind with `auth.harithkavish.com`**. Auth
does not exist. This interface does not exist.

### Before implementation may begin

1. **P1 is answered**, including the platform feasibility check — it constrains
   everything else about transport and request binding.
2. **P7 and P2 are answered** — timeouts and replay windows are load-bearing for
   correctness, not tuning parameters.
3. **P10 is answered** jointly with contract OQ2 — one decision, both documents.
4. **P9 and P11 are answered** before any passkey work, including the schema
   change that would then need separate authorization.
5. This document is reviewed and accepted by both projects.

Until then, the state of the Account ↔ Auth integration is exactly what Account
displays today: **pending**.
