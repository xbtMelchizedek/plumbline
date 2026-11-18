# Plumbline

Tested patches for two open FLOP client/SDK issues filed by
[@almondous](https://github.com/almondous). A plumbline checks whether a
measurement still refers to the thing you asked for: a receipt for the
requested ID, a balance for the selected account.

This is a standalone package and patches against published npm releases,
offered for:

- [flop-labs/network#321](https://github.com/flop-labs/network/issues/321) —
  `getCredentialReceipt` accepts a valid-shaped receipt for a different
  request ID (`@flop-labs/client@0.2.2`, still the latest release).
- [flop-labs/network#44](https://github.com/flop-labs/network/issues/44) —
  `useBalance` can display a previous account's balance after an address
  or client switch (`@flop-labs/sdk@0.4.0`). The `dist/react/hooks.js`
  file in `@flop-labs/sdk@0.6.0` (current latest) is byte-identical, so
  the same patch applies.

The TypeScript sources live in private `flop-labs/flop-core`
(`sdk/client` and `sdk/typescript`) and are not publicly readable, so
this is not a fork of that tree. @almondous already pointed maintainers
at `sdk/typescript/src/react/hooks.ts` for the source-equivalent of #44.

Status: community offer. Offline only. This repository does not call a
live FLOP endpoint, and it does not sign or submit anything on any chain.

## What the patches do

**#321.** After normal shape validation, compare `receipt.request_id` to
the requested ID with exact equality. No normalization, retry, or
paid-work replay. A mismatch raises `FlopValidationError`.

**#44.** Give `useBalance` a query identity, an effect-generation guard,
and response ordering. In-flight results from an earlier address or
client cannot overwrite the current balance, error, or loading state.
A stale `refetch` callback cannot start another RPC. A same-query
response is ignored only if a newer response has already been applied,
so a slow poll is not starved when a later request is still pending.

Both candidate patches, and the offline harnesses that exercise them,
were published by @almondous on the issues. This repository pins the
npm tarballs, checks their integrity, applies those patches, and
re-runs the harnesses.

## Checks

```bash
npm ci
npm run check
```

That runs typecheck, unit tests for the source-equivalent helpers,
a secret scan, and `scripts/apply-and-test.mjs`:

1. Download the official npm tarballs (no install/lifecycle scripts).
2. Verify pinned sha512 integrity and the SHA-256 of the patched files.
3. Apply the #321 and #44 patches.
4. Confirm the patched client `dist/index.js` matches the candidate
   SHA-256 published on #321.
5. Run the 26-check receipt harness (13 original + 13 candidate).
6. Run the 11-check `useBalance` suite against the patched hooks from
   both SDK 0.4.0 and 0.6.0.
7. Confirm the unpatched 0.6.0 hooks still fail the late-overwrite
   control, so the defect has not been fixed in the current release.

All I/O in the harnesses is injected. A real `fetch` is forbidden.

## Source-equivalent helpers

`src/` restates the two rules independently of the published bundles,
for review and for a future `flop-core` port:

- `assertReceiptMatchesRequest` — exact `request_id` correlation.
- `createQueryGuard` — generation and applied-id rules used by the
  #44 hook patch.

## License

Source in `src/` is MIT, Copyright (c) 2026 xbtMelchizedek. The patches
are modifications of `@flop-labs/client@0.2.2` and `@flop-labs/sdk`
0.4.0/0.6.0 (MIT OR Apache-2.0, Copyright (c) 2025-2026 The FLOP
Network Contributors). See `LICENSE` and `NOTICE`.
