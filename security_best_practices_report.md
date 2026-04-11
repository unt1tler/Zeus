# Security and Code Quality Review

## Executive Summary

Zeus is feature-rich for a small self-hosted panel, but its security posture is not strong enough for internet exposure without remediation. The biggest issues are:

- the app is pinned to a Next.js version that the loaded security guidance marks as below the patched threshold,
- privileged server actions do not enforce admin authentication inside the action,
- the admin session model uses the raw global secret as the cookie value,
- the Discord OAuth login flow is missing `state` protection.

On code quality, the repo currently ships with type-checking and lint enforcement disabled during builds, there is no visible CI, and `npm run typecheck` already fails on many files.

## High Severity

### ZSP-001: Next.js is pinned below the patched line called out by the loaded security guidance

- Rule ID: `NEXT-SUPPLY-001`
- Severity: High
- Location: `package.json:50`
- Evidence: the app depends on `next: "15.3.3"`.
- Impact: the Next.js security guidance loaded for this review explicitly marks versions older than `15.3.6` in the `15.3.x` line as vulnerable to the React server rendering issue it references. If this app is publicly deployed on that version, the framework itself is a known security risk.
- Fix: upgrade `next` to at least `15.3.6`, preferably the latest supported patched line, then retest the app.
- Mitigation: if you cannot upgrade immediately, do not expose the app publicly.
- False positive notes: if you have a private backport or a forked patched build, verify the exact deployed package version and patch provenance.

### ZSP-002: Privileged server actions do not enforce admin auth inside the action

- Rule ID: `NEXT-AUTH-001`
- Severity: High
- Location:
  - `src/lib/actions.ts:83`
  - `src/lib/actions.ts:174`
  - `src/lib/actions.ts:211`
  - `src/lib/actions.ts:378`
  - `src/lib/actions.ts:458`
  - `src/lib/actions.ts:586`
  - `src/lib/actions.ts:725`
- Evidence:
  - admin-mutating actions such as `createProduct`, `deleteProduct`, `createLicense`, `updateSettings`, `generateNewApiKey`, `addToBlacklist`, and `blacklistUser` mutate server data but never verify the admin session.
  - those actions are imported directly into client components, for example:
    - `src/components/products/ProductClient.tsx:8`
    - `src/components/settings/SettingsForm.tsx:9`
    - `src/components/blacklist/BlacklistClient.tsx:9`
    - `src/components/records/RecordDetailsDialog.tsx:17`
    - `src/components/customers/CustomerProfileClient.tsx:11`
- Impact: middleware and page-level redirects are only UI/route barriers. Server actions are request-facing endpoints and must authorize themselves. As written, any path that can invoke a valid action ID can mutate products, licenses, blacklist state, or rotate the admin API key without a server-side admin check.
- Fix: add a shared `requireAdminSession()` helper and call it at the top of every privileged action before any read or write.
- Mitigation: move privileged mutations behind authenticated route handlers or a dedicated service layer instead of calling data-layer mutations directly from client-imported actions.
- False positive notes: if you believe action IDs are unreachable to untrusted users, treat that only as a temporary obstacle, not a security boundary.

### ZSP-003: The admin session cookie is the raw global secret

- Rule ID: `NEXT-SESS-001`
- Severity: High
- Location:
  - `src/lib/actions.ts:49`
  - `src/middleware.ts:23`
  - `src/app/(dashboard)/layout.tsx:19`
- Evidence:
  - login sets `session` to `process.env.SESSION_SECRET`.
  - middleware authorizes by checking `session.value !== process.env.SESSION_SECRET`.
  - the dashboard layout repeats the same equality check.
- Impact: this turns one long-lived environment secret into a reusable bearer token. Anyone who learns the secret can mint an admin cookie forever until the secret is rotated. There is no per-session identity, no rotation on login, no server-side invalidation, and no separation between a signing secret and a session token.
- Fix: issue an opaque random session ID per login, store session state server-side, and keep the secret only for signing or encryption.
- Mitigation: shorten cookie lifetime and rotate the secret after every suspected exposure, but that is still weaker than real sessions.
- False positive notes: this is still a real weakness even if the app is “single-admin only”.

## Medium Severity

### ZSP-004: Discord OAuth login flow does not use `state`

- Rule ID: `NEXT-CSRF-001`
- Severity: Medium
- Location:
  - `src/app/api/auth/discord/redirect/route.ts:16`
  - `src/app/api/auth/discord/redirect/route.ts:18`
  - `src/app/api/auth/discord/callback/route.ts:12`
- Evidence:
  - the authorization URL includes `client_id`, `redirect_uri`, `response_type`, and `scope`, but no `state`.
  - the callback consumes only `code` and never validates a nonce or state value.
- Impact: this allows OAuth login CSRF or account swapping. An attacker can complete the Discord consent flow for their own account, then cause a victim browser to hit the callback and receive a logged-in cookie for the attacker’s account.
- Fix: generate a random `state`, store it in a signed cookie or session, include it in the authorize URL, and verify it before exchanging the code.
- Mitigation: also consider PKCE if you later broaden the client model.
- False positive notes: this finding stands even though the cookie is `HttpOnly`; the missing `state` is the issue.

### ZSP-005: BuiltByBit webhook authenticity relies on a body secret instead of a signed raw body

- Rule ID: `NEXT-WEBHOOK-001`
- Severity: Medium
- Location:
  - `src/app/api/webhooks/builtbybit/route.ts:21`
  - `src/app/api/webhooks/builtbybit/route.ts:23`
  - `src/app/api/webhooks/builtbybit/placeholder/route.ts:17`
  - `src/app/api/webhooks/builtbybit/placeholder/route.ts:23`
- Evidence:
  - both webhook handlers parse JSON first and compare `body.secret` to a stored shared secret.
  - neither handler validates a signature over the raw body or checks a timestamp/nonce.
- Impact: authenticity depends entirely on a static shared value inside the payload. That is weaker than standard webhook verification and offers no replay protection.
- Fix: verify a provider signature header over the raw request body. If the upstream system cannot do that, add your own HMAC plus timestamp and reject stale or replayed requests.
- Mitigation: keep the endpoint secret long and random, rotate it periodically, and rate-limit the route.
- False positive notes: if the upstream service does not support signed webhooks, document that limitation explicitly.

### ZSP-006: IP-based rate limits trust spoofable forwarding headers

- Rule ID: `NEXT-DOS-001`
- Severity: Medium
- Location:
  - `src/middleware.ts:11`
  - `src/lib/auth.ts:20`
  - `src/lib/actions.ts:35`
  - `src/app/api/validate/route.ts:90`
- Evidence:
  - middleware derives the client IP from `request.ip`, `x-real-ip`, or `x-forwarded-for`.
  - login throttling, admin API throttling, and validation API throttling all trust the propagated IP value.
- Impact: on self-hosted deployments without a trusted reverse proxy stripping and setting these headers, an attacker can send arbitrary `X-Forwarded-For` values and bypass per-IP throttles.
- Fix: trust only platform-provided client IP metadata behind a known proxy, or terminate traffic at a reverse proxy that rewrites forwarding headers.
- Mitigation: pair IP limits with user/account/key-based limits so spoofing one dimension is not enough.
- False positive notes: if you always deploy behind a trusted proxy that sanitizes these headers, verify that operationally.

### ZSP-007: Build-time quality gates are disabled, and the repo currently fails its own type-check

- Rule ID: `Q-BUILD-001`
- Severity: Medium
- Location:
  - `next.config.ts:4`
  - `next.config.ts:8`
  - `package.json:7`
  - `package.json:9`
  - `package.json:10`
- Evidence:
  - `next.config.ts` sets `typescript.ignoreBuildErrors = true` and `eslint.ignoreDuringBuilds = true`.
  - `build` runs `next build`, so production builds can pass while type and lint problems are ignored.
  - `npm run typecheck` currently fails with many errors, including `src/middleware.ts:11`, `src/app/api/validate/route.ts:103`, and multiple errors in `src/components/client/DarkVeil.tsx`.
  - `npm run lint` does not run a configured lint pass; it opens Next’s first-run ESLint setup prompt instead.
- Impact: broken or unsafe code can ship unnoticed, and the repo currently has no enforced static safety net.
- Fix: remove the ignore flags, commit a real ESLint config, and make typecheck plus lint mandatory in CI.
- Mitigation: until then, treat every deploy as manually verified.
- False positive notes: none; the command output reproduced the failures during this review.

## Low Severity / Maintainability

### ZSP-008: The storage layer is duplicated in TypeScript and CommonJS with manual sync expectations

- Rule ID: `Q-ARCH-001`
- Severity: Low
- Location:
  - `src/lib/data.ts:1`
  - `src/lib/data-access.js:1`
- Evidence:
  - `src/lib/data-access.js` explicitly says it mirrors `data.ts` and that changes must be manually kept in sync.
  - both files implement overlapping locking, caching, JSON IO, and Discord-user-fetch logic.
- Impact: this is a maintainability trap. Security or data-integrity fixes can land in one path and silently miss the other, especially because the web app and bot use different implementations.
- Fix: centralize shared storage logic in one implementation consumed by both runtimes, or generate the CommonJS wrapper from one source.
- Mitigation: if you keep both, add tests that assert identical behavior for key operations.
- False positive notes: none; the duplication is explicit in the code comment.

### ZSP-009: There is no visible automated test or CI pipeline in the repository root

- Rule ID: `Q-TEST-001`
- Severity: Low
- Location:
  - `package.json:5`
  - repository root: `.github` missing
- Evidence:
  - `package.json` has no `test` script.
  - there is no visible `.github` workflow directory in the repository root.
- Impact: regressions in auth, webhook handling, and file-backed data updates are likely to be caught late or not at all.
- Fix: add basic CI with `npm ci`, `npm run typecheck`, lint, and a small suite covering auth, webhook validation, and license mutations.
- Mitigation: at minimum, add smoke tests around login, admin API auth, and the validation route.
- False positive notes: if CI lives outside the repo, document it in `README.md`.

## Overall Assessment

- Security: below production-ready. The framework version, auth model, and missing server-side authorization checks need attention first.
- Code quality: mixed. The project is ambitious and has clear product coverage, but build safety nets are effectively disabled and static analysis is already failing.
- Maintainability: fair at best. The file-backed architecture is simple, but duplicated data layers and missing automation will make the code harder to trust as it grows.

## Recommended Remediation Order

1. Upgrade Next.js to a patched supported version.
2. Add a mandatory `requireAdminSession()` check to every privileged server action.
3. Replace the static-secret admin cookie with real per-session authentication.
4. Add OAuth `state` validation for the Discord login flow.
5. Harden webhook verification and replay handling.
6. Re-enable type/lint gates and add CI before making more feature changes.
