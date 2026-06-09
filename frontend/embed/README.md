# qr-embed-remote

> Drop-in JavaScript library that adds a **QR-paired phone remote** to any existing web page.

[![npm version](https://img.shields.io/npm/v/qr-embed-remote.svg)](https://www.npmjs.com/package/qr-embed-remote)
[![license](https://img.shields.io/npm/l/qr-embed-remote.svg)](./LICENSE)
[![bundle size](https://img.shields.io/badge/gzipped-~12%20KB-blue.svg)](#bundle)

Host page registers a few of its UI elements (buttons, inputs, selects, toggles, sliders). The library renders a QR code. A phone on the same LAN scans the QR — a mobile control panel opens, auto-generated from the registry. Every tap on the phone fires the corresponding `onAction` on the host page.

No LLM, no speech recognition, no framework lock-in. Works in any web app (vanilla, React, Vue, …) with no rewrites.

> **Status: prototype / technology demonstrator.** Sessions live in-memory on the broker — not for production traffic. See [Server](#server) for what the library expects to talk to.

---

## Quick start

### As a `<script>` tag

```html
<link rel="stylesheet" href="https://your-broker.example.com/embed/qr-remote.css">
<script src="https://your-broker.example.com/embed/qr-remote.js"></script>
<script>
  QRRemote.init({ baseUrl: 'https://your-broker.example.com' }).then(remote => {
    remote.register('btn-buy', {
      kind: 'button',
      label: 'Buy now',
      group: 'Cart',
      onAction: () => document.getElementById('buy').click(),
    });

    document.getElementById('show-qr')
      .addEventListener('click', () => remote.showQR());
  });
</script>
```

### As an npm package

```bash
npm install qr-embed-remote
```

```ts
import { init } from 'qr-embed-remote';
import 'qr-embed-remote/style.css';

const remote = await init({ baseUrl: 'https://your-broker.example.com' });

remote.register('vol', {
  kind: 'slider', label: 'Volume', min: 0, max: 100, step: 5,
  onAction: (n) => setVolume(Number(n)),
});

remote.showQR();
```

---

## API

### `init(opts?): Promise<QRRemoteHandle>`

| Option | Type | Default | Notes |
|---|---|---|---|
| `baseUrl` | `string` | `window.location.origin` | URL of the broker server |
| `pollMinMs` | `number` | `1000` | Polling floor in ms (clamped 250..300000) |
| `pollMaxMs` | `number` | `10000` | Backoff ceiling in ms (must be ≥ pollMinMs) |
| `registryFlushMs` | `number` | `200` | Debounce window for registry sync (0..60000) |
| `persistSession` | `'tab' \| 'origin' \| 'none'` | `'tab'` | Where to cache `session_id`. `'tab'` (sessionStorage) isolates tabs of the same origin so they don't trample each other's `/api/registry`. `'origin'` (localStorage) survives tab reloads but should only be used when you control how the page is opened. `'none'` always negotiates a fresh session. |
| `onMessage` | `(msg: HostMessage) => void \| Promise<void>` | — | Receives addressless commands (`SHOW_MSG` / `ALERT` / `PLAY_SOUND`) that aren't bound to a registered element. May be async — it is awaited before the next command. Omit to ignore them. |

Returns a stable `QRRemoteHandle` that survives session-lost recovery: descriptors are migrated into the new session, and `register()`/`unregister()` calls made *during* the recovery are buffered and replayed.

### `QRRemoteHandle`

```ts
interface QRRemoteHandle {
  register(id: string, d: RegistryDescriptor): void;
  unregister(id: string): void;
  showQR(target?: HTMLElement): void;   // floating dialog OR mount inside target
  hideQR(): void;
  destroy(): void;
  readonly sessionId: string;
}
```

`register()` validates input synchronously and throws on bad ids, missing `onAction`, labels longer than 200 characters, more than 32 `options[]` on a `select`, slider without finite `min<max`, etc. — the same limits the server enforces, surfaced as a JS error instead of a 400 round-trip.

### `RegistryDescriptor`

```ts
interface RegistryDescriptor {
  kind: 'button' | 'input' | 'select' | 'toggle' | 'slider';
  label: string;
  group?: string;
  options?: string[];                  // required for kind: 'select'
  min?: number;                        // required for kind: 'slider'
  max?: number;                        // required for kind: 'slider'
  step?: number;                       // optional for kind: 'slider'
  onAction(value?: string | number | boolean): void | Promise<void>;
}
```

`onAction` receives a typed value depending on `kind`:

| kind | argument |
|---|---|
| `button` | _no argument_ |
| `input`, `select` | `string` |
| `toggle` | `boolean` |
| `slider` | `number` |

User errors thrown inside `onAction` are caught and logged via `console.warn` — they will not break the poll loop.

### `HostMessage`

Addressless commands are delivered to the optional `onMessage` callback:

```ts
type HostMessage =
  | { type: 'SHOW_MSG';   text: string }
  | { type: 'ALERT';      level: string; text: string }
  | { type: 'PLAY_SOUND'; sound: string };
```

Errors thrown inside `onMessage` are caught and logged via `console.warn`, just like `onAction`.

---

## Bundle

| Variant | Path | Gzipped |
|---|---|---|
| ESM | `dist/qr-remote.mjs` | ~14 KB |
| CJS | `dist/qr-remote.cjs` | ~12 KB |
| IIFE (`window.QRRemote`) | `dist/qr-remote.iife.js` | ~12 KB |
| CSS | `dist/qr-remote.css` | <1 KB |

Source-maps are shipped alongside.

---

## Server

The library expects a small broker behind `baseUrl` exposing these endpoints. A reference implementation in .NET 8 AOT is in the [companion repo](https://github.com/alexander-savelev/qr-embed-remote).

| Method | Path | Used for |
|---|---|---|
| `POST` | `/api/session` | Create session |
| `POST` | `/api/execute` | Phone enqueues commands (validated by whitelist) |
| `GET` | `/api/poll?session_id=…` | Host page drains command queue |
| `PUT` | `/api/registry/{session_id}` | Host page publishes element snapshot |
| `GET` | `/api/registry/{session_id}` | Phone reads registry |
| `GET` | `/api/server-ip` | LAN-IP hint for the QR URL |

The command DSL is a whitelist:

```
CLICK:<id>
INPUT:<id>:<value>
SELECT:<id>:<value>
TOGGLE:<id>:(true|false)
SLIDE:<id>:<number>
```

---

## React integration

```ts
import { useEffect, useRef } from 'react';
import { init, type QRRemoteHandle } from 'qr-embed-remote';
import 'qr-embed-remote/style.css';

export function useQRRemote() {
  const ref = useRef<QRRemoteHandle | null>(null);
  useEffect(() => {
    let handle: QRRemoteHandle | null = null;
    init().then(h => { handle = h; ref.current = h; });
    return () => handle?.destroy();
  }, []);
  return ref;
}
```

---

## Session lifecycle

1. `init()` calls `POST /api/session` and caches the id (by default in `sessionStorage`, key `qrremote.session.<origin>`; controlled by `persistSession`).
2. Each `register/unregister` triggers a debounced (200 ms) `PUT /api/registry/{sid}` with an incrementing `version`.
3. The poll loop pulls `/api/poll` every second; failures back off up to `pollMaxMs`.
4. If the server forgets the session (TTL expiry, restart) the library transparently re-establishes a fresh session and migrates the previously-registered descriptors. The `QRRemoteHandle` reference returned to your code stays valid.

---

## Browser support

Modern evergreen browsers with native `fetch`, `AbortController`, `Map`, ES2020. Safari 14+, Chrome 80+, Firefox 78+, Edge 80+.

---

## License

MIT © Alexander Savelev. See [LICENSE](./LICENSE).
