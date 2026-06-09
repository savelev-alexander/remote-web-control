# Changelog

All notable changes to **qr-embed-remote** are documented here. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] — Initial release

First public release.

### Added
- IIFE bundle (`dist/qr-remote.iife.js`) installing `window.QRRemote.init`.
- ESM (`dist/qr-remote.mjs`) and CJS (`dist/qr-remote.cjs`) builds with
  sourcemaps.
- TypeScript declaration files (`dist/*.d.ts`) with `.d.ts.map`.
- Public API: `init(opts) → QRRemoteHandle` exposing `register`,
  `unregister`, `showQR`, `hideQR`, `destroy`, `sessionId`.
- Five widget kinds — `button`, `input`, `select`, `toggle`, `slider` —
  with synchronous `register()` validation that mirrors the server's
  whitelist limits (id pattern, label/group/options lengths, finite
  slider bounds).
- Built-in QR rendering via `qrcode-generator` (vanilla SVG, no canvas).
- Floating + embedded overlay modes with Escape / backdrop-click
  dismissal.
- Polling with exponential backoff and AbortController-aware stop.
- Debounced registry flush with single retry and automatic
  cancellation of the retry on the next successful flush.
- Transparent session-lost recovery: descriptors migrate to the new
  session, `register()`/`unregister()` calls made during recovery are
  buffered and replayed, and the `QRRemoteHandle` reference stays valid.
- `persistSession` option: `'tab'` (sessionStorage, default — multi-tab
  safe), `'origin'` (localStorage), `'none'` (always fresh).
- `onMessage` option and `HostMessage` type: delivers addressless
  commands (`SHOW_MSG` / `ALERT` / `PLAY_SOUND`) to the host page;
  errors thrown inside the callback are isolated from the poll loop.
- Kind-aware wire serialization so only relevant fields ship to the
  server per element type.
- 52-spec vitest suite covering parsing, dispatch routing (including
  sync/async `onMessage` delivery), registry debounce/version/retry/serialization,
  session cache modes, init validation, re-init buffering.
