# Contributing

This is a standalone offer for
[flop-labs/network#321](https://github.com/flop-labs/network/issues/321)
and
[flop-labs/network#44](https://github.com/flop-labs/network/issues/44).
The package sources in `flop-labs/flop-core` are not public, so work
happens here.

## Checks

```bash
npm ci
npm run check
```

That runs `tsc --noEmit`, the unit tests, a secret scan, and the
pinned-tarball patch/harness script. Nothing in this repository is
executed against a live network.

## Rules

- Credit [@almondous](https://github.com/almondous). The patches and
  harnesses come from their issues. Keep changes to those files
  minimal and described.
- Do not vendor published `dist/` files into git. Download them at
  check time and verify the pinned hashes.
- Do not sign, transfer, or submit anything on any chain from this
  repository. Do not call a live FLOP gateway, faucet, or RPC.
- Keys and secrets never go in git, issues, logs, or the console.
- Keep each patch scoped to the filed issue. `useHtlc` in the same
  hooks file appears to share the unguarded in-flight pattern; that
  is a related observation, not part of the #44 patch.
